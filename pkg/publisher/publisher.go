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
	v2car "github.com/ipld/go-car/v2"
	v2storage "github.com/ipld/go-car/v2/storage"
	"github.com/ipld/go-ipld-prime"
	"github.com/ipld/go-ipld-prime/fluent"
	cidlink "github.com/ipld/go-ipld-prime/linking/cid"
	"github.com/ipld/go-ipld-prime/node/basicnode"
	"github.com/multiformats/go-multicodec"
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

	// log.Default().Printf("Adding %s to IPFS...\n", dir)

	ipfsPath, err := p.ipfsClient.Unixfs().Add(ctx, node, options.Unixfs.CidVersion(1))
	if err != nil {
		return cid.Cid{}, fmt.Errorf("adding dir to ipfs: %v", err)
	}

	// log.Default().Printf("%s added to ipfs with cid %s\n", dir, ipfsPath.Cid().String())

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

// CidToCarStorage writes a car file from a cid and uploads it to car storage service.
func (p *Publisher) CidToCarStorage(ctx context.Context, c cid.Cid) (cid.Cid, error) {
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
	// log.Default().Printf("%s uploaded to car storage service", res.String())
	return res, nil
}

// RendersIndexToCarStorage creates a car index from the saved Rigs and adds it to car storage service.
func (p *Publisher) RendersIndexToCarStorage(ctx context.Context) (cid.Cid, error) {
	rigs, err := p.localStore.Rigs(ctx)
	if err != nil {
		return cid.Undef, fmt.Errorf("querying local store for rigs: %v", err)
	}

	out, err := os.Create("my.car")
	if err != nil {
		return cid.Cid{}, fmt.Errorf("creating file: %v", err)
	}
	defer func() {
		_ = out.Close()
	}()

	dummy, err := cid.Decode("bafybeidpcvznz6jbsanyw4xn7vomhqkkbkfinf7p72tf6pjsik4vhs3hvy")
	if err != nil {
		return cid.Cid{}, fmt.Errorf("creating dummy cid: %v", err)
	}

	writableCar, err := v2storage.NewWritable(out, []cid.Cid{dummy}, v2car.WriteAsCarV1(true))
	if err != nil {
		return cid.Cid{}, fmt.Errorf("creating writable car: %v", err)
	}

	// Setup a LinkSystem
	ls := cidlink.DefaultLinkSystem()
	ls.SetWriteStorage(writableCar)
	lp := cidlink.LinkPrototype{Prefix: cid.Prefix{
		Version:  1,
		Codec:    uint64(multicodec.DagPb),
		MhType:   uint64(multicodec.Sha2_256),
		MhLength: 32,
	}}

	var innerError error
	n := fluent.MustBuildMap(basicnode.Prototype.Map, 1, func(fma fluent.MapAssembler) {
		fma.AssembleEntry("Links").CreateList(int64(len(rigs)), func(fla fluent.ListAssembler) {
			for ii, rig := range rigs {
				c, err := cid.Decode(*rig.RendersCid)
				if err != nil {
					innerError = fmt.Errorf("decoding rig cid string %d: %v", rig.RendersCid, err)
					break
				}
				fla.AssembleValue().CreateMap(2, func(fma fluent.MapAssembler) {
					fma.AssembleEntry("Name").AssignString(fmt.Sprintf("%d", ii))
					fma.AssembleEntry("Hash").AssignLink(cidlink.Link{Cid: c})
				})
			}
		})
	})
	if innerError != nil {
		return cid.Cid{}, fmt.Errorf("assembing node: %v", err)
	}

	// Write the single block
	link, err := ls.Store(ipld.LinkContext{}, lp, n)
	if err != nil {
		return cid.Cid{}, fmt.Errorf("writing node to store: %v", err)
	}
	log.Default().Println("Wrote single block to CAR:", link.String())

	log.Default().Println("Link cid: ", link.(cidlink.Link).Cid.String())

	if err := v2car.ReplaceRootsInFile("my.car", []cid.Cid{link.(cidlink.Link).Cid}); err != nil {
		log.Default().Println("error replacing cid ", err)
	}

	// reader, writer := io.Pipe()
	// jobs := []wpool.Job{
	// 	{
	// 		ID:   1,
	// 		Desc: "encode ipld",
	// 		ExecFn: func(ctx context.Context) (interface{}, error) {
	// 			if err := dagpb.Encode(n, writer); err != nil {
	// 				return nil, fmt.Errorf("encoding ipld: %v", err)
	// 			}
	// 			_ = writer.Close()
	// 			return nil, nil
	// 		},
	// 	},
	// 	{
	// 		ID:   2,
	// 		Desc: "upload ipld car",
	// 		ExecFn: func(ctx context.Context) (interface{}, error) {
	// 			r := bufio.NewReader(reader)
	// 			buf := make([]byte, 256)
	// 			var res []byte
	// 			for {
	// 				_, err := r.Read(buf)
	// 				if err != nil {
	// 					if err != io.EOF {
	// 						fmt.Println(err)
	// 					}
	// 					break
	// 				}
	// 				res = append(res, buf...)
	// 				if err != nil {
	// 					return nil, fmt.Errorf("writing buffer to file: %v", err)
	// 				}
	// 			}
	// 			block := blocks.NewBlock(res)

	// 			f, err := os.Create("my.car")
	// 			defer f.Close()
	// 			if err != nil {
	// 				return nil, fmt.Errorf("creating car file: %v", err)
	// 			}

	// 			carRw, err := blockstore.OpenReadWriteFile(f, []cid.Cid{block.Cid()}, blockstore.WriteAsCarV1(true))
	// 			if err != nil {
	// 				return nil, fmt.Errorf("opening car file rw: %v", err)
	// 			}

	// 			if err := carRw.Put(ctx, block); err != nil {
	// 				return nil, fmt.Errorf("putting block: %v", err)
	// 			}

	// 			if err := carRw.Finalize(); err != nil {
	// 				return nil, fmt.Errorf("finalizing car: %v", err)
	// 			}

	// 			c, err := p.carStorage.PutCar(ctx, f)
	// 			if err != nil {
	// 				return nil, fmt.Errorf("uploading ipld: %v", err)
	// 			}

	// 			return c, nil
	// 		},
	// 	},
	// }

	// ctx, cancel := context.WithCancel(ctx)
	// defer cancel()

	// pool := wpool.New(2, rate.Inf)
	// go pool.GenerateFrom(jobs)
	// go pool.Run(ctx)
	// var res cid.Cid
	// for r := range pool.Results() {
	// 	if r.Err != nil {
	// 		return cid.Cid{}, fmt.Errorf("executing job %d, %s: %v", r.ID, r.Desc, r.Err)
	// 	}
	// 	if r.ID == 2 {
	// 		res = r.Value.(cid.Cid)
	// 	}
	// }
	// if err := p.localStore.TrackCid(ctx, "renders", res.String()); err != nil {
	// 	return cid.Undef, fmt.Errorf("tracking renders cid: %v", err)
	// }
	return cid.Cid{}, nil
}

// RendersToCarStorage publishes a directory of renders to car storage service.
func (p *Publisher) RendersToCarStorage(
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
			c2, err := p.CidToCarStorage(ctx, c)
			if err != nil {
				return nil, fmt.Errorf("uploading car to car storage service: %v", err)
			}
			if !c.Equals(c2) {
				return nil, fmt.Errorf("ipfs cid %s is not equal to car storage service cid %s", c.String(), c2.String())
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
			Desc:   path.Join(rendersPath, folder.Name()),
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
		if r.Err != nil {
			return fmt.Errorf("executing job %d (%s): %v", r.ID, r.Desc, r.Err)
		}
		fmt.Printf("%d/%d. finished job %d (%s) with cid %v\n", count, len(jobs), r.ID, r.Desc, r.Value)
		count++
	}
	return nil
}

// UpdateCarStorageDeals updates the local db with the latest storage deals from car storage service.
func (p *Publisher) UpdateCarStorageDeals(ctx context.Context, concurrency int, rateLimit rate.Limit) error {
	execFn := func(rig local.Rig) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			c, err := cid.Decode(*rig.RendersCid)
			if err != nil {
				return nil, fmt.Errorf("decoding rig cid: %v", err)
			}
			s, err := p.carStorage.Status(ctx, c)
			if err != nil {
				return nil, fmt.Errorf("getting car storage service status: %v", err)
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
			return fmt.Errorf("executing job %d: %v", r.ID, r.Err)
		}
		fmt.Printf("%d/%d. complete\n", count, len(jobs))
		count++
	}
	return nil
}
