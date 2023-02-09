package publisher

import (
	"context"
	"fmt"
	"io"
	"io/fs"
	"io/ioutil"
	"log"
	"os"
	"path"
	"strconv"
	"time"

	"github.com/alanshaw/go-carbites"
	"github.com/ipfs/go-cid"
	ipfsfiles "github.com/ipfs/go-ipfs-files"
	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/ipfs/interface-go-ipfs-core/options"
	"github.com/ipld/go-car"
	"github.com/ipld/go-ipld-prime/codec/dagcbor"
	"github.com/ipld/go-ipld-prime/datamodel"
	"github.com/ipld/go-ipld-prime/fluent/qp"
	cidlink "github.com/ipld/go-ipld-prime/linking/cid"
	"github.com/ipld/go-ipld-prime/node/basicnode"
	"github.com/tablelandnetwork/rigs/pkg/carstorage"
	"github.com/tablelandnetwork/rigs/pkg/storage/local"
	"github.com/tablelandnetwork/rigs/pkg/wpool"
	"golang.org/x/time/rate"
)

// Publisher publishes Rigs data.
type Publisher struct {
	localStore local.Store
	ipfsClient *httpapi.HttpApi
	carStorage carstorage.CarStorage
}

// NewPublisher creates a publisher.
func NewPublisher(
	localStore local.Store,
	ipfsClient *httpapi.HttpApi,
	carStorage carstorage.CarStorage,
) *Publisher {
	return &Publisher{
		localStore: localStore,
		ipfsClient: ipfsClient,
		carStorage: carStorage,
	}
}

// DirToIpfs publishes the specified dir to IPFS.
func (p *Publisher) DirToIpfs(ctx context.Context, dir string) (cid.Cid, error) {
	fi, err := os.Stat(dir)
	if err != nil {
		return cid.Cid{}, fmt.Errorf("stating dir: %v", err)
	}

	node, err := ipfsfiles.NewSerialFile(dir, false, fi)
	if err != nil {
		return cid.Cid{}, fmt.Errorf("creating node from dir: %v", err)
	}

	log.Default().Printf("Adding %s to IPFS...\n", dir)

	ipfsPath, err := p.ipfsClient.Unixfs().Add(ctx, node, options.Unixfs.CidVersion(1))
	if err != nil {
		return cid.Cid{}, fmt.Errorf("adding dir to ipfs: %v", err)
	}

	log.Default().Printf("%s added to ipfs with cid %s\n", dir, ipfsPath.Cid().String())

	return ipfsPath.Cid(), nil
}

// CidToCarChunks publishes the cid already in IPFS to nft.storage.
func (p *Publisher) CidToCarChunks(ctx context.Context, dirCid cid.Cid) (string, error) {
	tmpDir, err := os.MkdirTemp("", "rigs-uploader")
	if err != nil {
		_ = os.RemoveAll(tmpDir)
		return "", fmt.Errorf("making tmp dir: %v", err)
	}

	log.Default().Printf("writing car chunks to %s", tmpDir)

	carReader, carWriter := io.Pipe()

	jobs0 := []wpool.Job{
		{
			ID:   1,
			Desc: "write car",
			ExecFn: func(ctx context.Context) (interface{}, error) {
				if err := car.WriteCar(ctx, p.ipfsClient.Dag(), []cid.Cid{dirCid}, carWriter); err != nil {
					return nil, fmt.Errorf("writing car: %v", err)
				}
				_ = carWriter.Close()
				return nil, nil
			},
		},
		{
			ID:   2,
			Desc: "create splitter",
			ExecFn: func(ctx context.Context) (interface{}, error) {
				targetSize := 1000 * 1000 * 99 // < 100MB chunks
				strategy := carbites.Treewalk
				s, err := carbites.Split(carReader, targetSize, strategy)
				if err != nil {
					return nil, fmt.Errorf("creating splitter: %v", err)
				}
				return s, nil
			},
		},
	}

	var s carbites.Splitter

	ctx0, cancel0 := context.WithCancel(ctx)
	defer cancel0()

	p0 := wpool.New(2, rate.Inf)
	go p0.GenerateFrom(jobs0)
	go p0.Run(ctx0)
	for r := range p0.Results() {
		if r.Err != nil {
			_ = os.RemoveAll(tmpDir)
			return "", fmt.Errorf("executing job %d, %s: %v", r.ID, r.Desc, r.Err)
		}
		log.Default().Printf("processed job %d. %s\n", r.ID, r.Desc)
		if r.ID == 2 {
			s = r.Value.(carbites.Splitter)
		}
	}

	var c int
	for {
		car, err := s.Next()
		if err != nil {
			if err == io.EOF {
				break
			}
			_ = os.RemoveAll(tmpDir)
			return "", fmt.Errorf("iterating splitter: %v", err)
		}
		log.Default().Printf("writing car chunk %d\n", c)
		b, err := io.ReadAll(car)
		if err != nil {
			_ = os.RemoveAll(tmpDir)
			return "", fmt.Errorf("reading car chunk: %v", err)
		}
		if err := os.WriteFile(fmt.Sprintf("%s/chunk-%d.car", tmpDir, c), b, 0o644); err != nil {
			_ = os.RemoveAll(tmpDir)
			return "", fmt.Errorf("writing car chunk to file: %v", err)
		}
		c++
	}
	return tmpDir, nil
}

// CarChunksToNftStorage publishes the car chunks in the specified dir to nft.storage.
func (p *Publisher) CarChunksToNftStorage(
	ctx context.Context,
	tmpDir string,
	concurrency int,
	rateLimit time.Duration,
) error {
	chunks, err := os.ReadDir(tmpDir)
	if err != nil {
		return fmt.Errorf("reading tmp dir: %v", err)
	}

	var jobs1 []wpool.Job
	for i, chunk := range chunks {
		jobs1 = append(jobs1, wpool.Job{
			ID:   wpool.JobID(i),
			Desc: fmt.Sprintf("upload chunk %d", i),
			ExecFn: func(de fs.DirEntry) wpool.ExecutionFn {
				return func(ctx context.Context) (interface{}, error) {
					f, err := os.Open(path.Join(tmpDir, de.Name()))
					if err != nil {
						return nil, fmt.Errorf("opening chunk file: %v", err)
					}
					res, err := p.carStorage.PutCar(ctx, f)
					if err != nil {
						return nil, fmt.Errorf("uploading car chunk: %v", err)
					}
					return res, nil
				}
			}(chunk),
		})
	}

	ctx1, cancel1 := context.WithCancel(ctx)
	defer cancel1()

	p1 := wpool.New(concurrency, rate.Every(rateLimit))
	go p1.GenerateFrom(jobs1)
	go p1.Run(ctx1)
	for r := range p1.Results() {
		if r.Err != nil {
			return fmt.Errorf("executing job %d, %s: %v", r.ID, r.Desc, r.Err)
		}
		log.Default().Printf("processed job %d: %s, %v", r.ID, r.Desc, r.Value)
	}
	_ = os.RemoveAll(tmpDir)
	return nil
}

// CidToWeb3Storage writes a car file from a cid and uploads it to web3.storage.
func (p *Publisher) CidToWeb3Storage(ctx context.Context, c cid.Cid) (cid.Cid, error) {
	carReader, carWriter := io.Pipe()

	jobs := []wpool.Job{
		{
			ID:   1,
			Desc: "write car",
			ExecFn: func(ctx context.Context) (interface{}, error) {
				if err := car.WriteCar(ctx, p.ipfsClient.Dag(), []cid.Cid{c}, carWriter); err != nil {
					return nil, fmt.Errorf("writing car: %v", err)
				}
				_ = carWriter.Close()
				return nil, nil
			},
		},
		{
			ID:   2,
			Desc: "upload",
			ExecFn: func(ctx context.Context) (interface{}, error) {
				c, err := p.carStorage.PutCar(ctx, carReader)
				if err != nil {
					return nil, fmt.Errorf("uploading car: %v", err)
				}
				return c, nil
			},
		},
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	pool := wpool.New(2, rate.Inf)
	go pool.GenerateFrom(jobs)
	go pool.Run(ctx)
	var res cid.Cid
	for r := range pool.Results() {
		if r.Err != nil {
			return cid.Cid{}, fmt.Errorf("executing job %d, %s: %v", r.ID, r.Desc, r.Err)
		}
		if r.ID == 2 {
			res = r.Value.(cid.Cid)
		}
	}
	log.Default().Printf("%s uploaded to web3.storage", res.String())
	return res, nil
}

// RigsIndexToWeb3Storage creates a dagcbor index from the provided Rigs and adds it to web3.storage.
func (p *Publisher) RigsIndexToWeb3Storage(ctx context.Context, rigs []local.Rig) (cid.Cid, error) {
	n, err := qp.BuildMap(basicnode.Prototype.Any, int64(len(rigs)), func(ma datamodel.MapAssembler) {
		for _, rig := range rigs {
			c, err := cid.Decode(*rig.RendersCid)
			if err != nil {
				log.Default().Printf("error decoding rig cid string: %v", err)
				continue
			}
			qp.MapEntry(ma, fmt.Sprintf("%d", rig.ID), qp.Link(cidlink.Link{Cid: c}))
		}
	})
	if err != nil {
		return cid.Cid{}, fmt.Errorf("building map: %v", err)
	}

	reader, writer := io.Pipe()
	jobs := []wpool.Job{
		{
			ID:   1,
			Desc: "encode ipld",
			ExecFn: func(ctx context.Context) (interface{}, error) {
				if err := dagcbor.Encode(n, writer); err != nil {
					return nil, fmt.Errorf("encoding ipld: %v", err)
				}
				_ = writer.Close()
				return nil, nil
			},
		},
		{
			ID:   2,
			Desc: "upload ipld",
			ExecFn: func(ctx context.Context) (interface{}, error) {
				c, err := p.carStorage.PutCar(ctx, reader)
				if err != nil {
					return nil, fmt.Errorf("uploading ipld: %v", err)
				}
				return c, nil
			},
		},
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	pool := wpool.New(2, rate.Inf)
	go pool.GenerateFrom(jobs)
	go pool.Run(ctx)
	var res cid.Cid
	for r := range pool.Results() {
		if r.Err != nil {
			return cid.Cid{}, fmt.Errorf("executing job %d, %s: %v", r.ID, r.Desc, r.Err)
		}
		if r.ID == 2 {
			res = r.Value.(cid.Cid)
		}
	}
	return res, nil
}

// RendersToWeb3Storage publishes a directory of renders to web3.storage.
func (p *Publisher) RendersToWeb3Storage(
	ctx context.Context,
	rendersPath string,
	concurrency int,
	rateLimit rate.Limit,
) error {
	execFcn := func(rigDir string, rigID int) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			c, err := p.DirToIpfs(ctx, rigDir)
			if err != nil {
				return nil, fmt.Errorf("adding dir to ipfs: %v", err)
			}
			c2, err := p.CidToWeb3Storage(ctx, c)
			if err != nil {
				return nil, fmt.Errorf("uploading car to web3.storage: %v", err)
			}
			if !c.Equals(c2) {
				return nil, fmt.Errorf("ipfs cid %s is not equal to web3.storage cid %s", c.String(), c2.String())
			}
			if err := p.localStore.UpdateRigRendersCid(ctx, rigID, c); err != nil {
				return nil, fmt.Errorf("updating rig id in store: %v", err)
			}
			return c, nil
		}
	}

	var jobs []wpool.Job

	folders, err := ioutil.ReadDir(rendersPath)
	if err != nil {
		return fmt.Errorf("reading renders dir: %v", err)
	}

	for i, folder := range folders {
		if !folder.IsDir() {
			continue
		}
		rigID, err := strconv.Atoi(folder.Name())
		if err != nil {
			return fmt.Errorf("parsing rig dir name to rig id: %v", err)
		}
		jobs = append(jobs, wpool.Job{
			ID:     wpool.JobID(i),
			ExecFn: execFcn(path.Join(rendersPath, folder.Name()), rigID),
		})
	}

	pool := wpool.New(concurrency, rateLimit)
	go pool.GenerateFrom(jobs)
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	go pool.Run(ctx)
	count := 1
	for r := range pool.Results() {
		fmt.Printf("%d/%d. %v\n", count, len(jobs), r.Value)
		if r.Err != nil {
			return fmt.Errorf("executing job: %v", err)
		}
		count++
	}

	rigs, err := p.localStore.Rigs(ctx)
	if err != nil {
		return fmt.Errorf("querying local store for rigs: %v", err)
	}
	c, err := p.RigsIndexToWeb3Storage(ctx, rigs)
	if err != nil {
		return fmt.Errorf("publishing rigs index to web3.storage: %v", err)
	}
	fmt.Printf("uploaded index with cid - %s", c.String())
	return nil
}

// UpdateWeb3StorageDeals updates the local db with the latest storage deals from web3.storage.
func (p *Publisher) UpdateWeb3StorageDeals(ctx context.Context, concurrency int, rateLimit rate.Limit) error {
	execFn := func(rig local.Rig) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			c, err := cid.Decode(*rig.RendersCid)
			if err != nil {
				return nil, fmt.Errorf("decoding rig cid: %v", err)
			}
			s, err := p.carStorage.Status(ctx, c)
			if err != nil {
				return nil, fmt.Errorf("getting web3.storage status: %v", err)
			}
			var deals []local.Deal
			for _, deal := range s.Deals {
				deals = append(deals, local.Deal{
					DealID:            deal.DealID,
					StorageProvider:   deal.StorageProvider.String(),
					Status:            deal.Status,
					PieceCid:          deal.PieceCid.String(),
					DataCid:           deal.DataCid.String(),
					DataModelSelector: deal.DataModelSelector,
					Activation:        deal.Activation,
					Updated:           deal.Updated,
				})
			}
			if err := p.localStore.UpdateRigDeals(ctx, rig.ID, deals); err != nil {
				return nil, fmt.Errorf("updating rig deals in local store: %v", err)
			}
			return nil, nil
		}
	}
	rigs, err := p.localStore.Rigs(ctx)
	if err != nil {
		return fmt.Errorf("querying rigs: %v", err)
	}
	var jobs []wpool.Job
	for _, rig := range rigs {
		jobs = append(jobs, wpool.Job{
			ID:     wpool.JobID(rig.ID),
			ExecFn: execFn(rig),
		})
	}
	pool := wpool.New(concurrency, rateLimit)
	go pool.GenerateFrom(jobs)
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	go pool.Run(ctx)
	count := 1
	for r := range pool.Results() {
		if r.Err != nil {
			return fmt.Errorf("executing job %d: %v", r.ID, err)
		}
		fmt.Printf("%d/%d. complete\n", count, len(jobs))
		count++
	}
	return nil
}
