package dirpublisher

import (
	"context"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"path"
	"time"

	"github.com/alanshaw/go-carbites"
	"github.com/ipfs/go-cid"
	ipfsfiles "github.com/ipfs/go-ipfs-files"
	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/ipfs/interface-go-ipfs-core/options"
	"github.com/ipld/go-car"
	"github.com/tablelandnetwork/rigs/pkg/nftstorage"
	"github.com/tablelandnetwork/rigs/pkg/storage/local"
	"github.com/tablelandnetwork/rigs/pkg/wpool"
	"golang.org/x/time/rate"
)

// DirPublisher publishes a directory to nft.storage.
type DirPublisher struct {
	localStore local.Store
	ipfsClient *httpapi.HttpApi
	nftStorage *nftstorage.Client
}

// NewDirPublisher creates a DirPublisher.
func NewDirPublisher(
	localStore local.Store,
	ipfsClient *httpapi.HttpApi,
	nftStorage *nftstorage.Client,
) *DirPublisher {
	return &DirPublisher{
		localStore: localStore,
		ipfsClient: ipfsClient,
		nftStorage: nftStorage,
	}
}

// DirToIpfs publishes the specified dir to IPFS.
func (dp *DirPublisher) DirToIpfs(ctx context.Context, dir, label string) (cid.Cid, error) {
	fi, err := os.Stat(dir)
	if err != nil {
		return cid.Cid{}, fmt.Errorf("stating dir: %v", err)
	}

	node, err := ipfsfiles.NewSerialFile(dir, false, fi)
	if err != nil {
		return cid.Cid{}, fmt.Errorf("creating node from dir: %v", err)
	}

	log.Default().Println("Adding folder to IPFS...")

	ipfsPath, err := dp.ipfsClient.Unixfs().Add(ctx, node, options.Unixfs.CidVersion(1))
	if err != nil {
		return cid.Cid{}, fmt.Errorf("adding dir to ipfs: %v", err)
	}

	if err := dp.localStore.TrackCid(ctx, label, ipfsPath.Cid().String()); err != nil {
		return cid.Cid{}, fmt.Errorf("tracking cid: %v", err)
	}

	log.Default().Printf("Folder added with cid %s\n", ipfsPath.Cid().String())

	return ipfsPath.Cid(), nil
}

// CidToCarChunks publishes the cid already in IPFS to nft.storage.
func (dp *DirPublisher) CidToCarChunks(ctx context.Context, dirCid cid.Cid) (string, error) {
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
				if err := car.WriteCar(ctx, dp.ipfsClient.Dag(), []cid.Cid{dirCid}, carWriter); err != nil {
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
L0:
	for {
		select {
		case r, ok := <-p0.Results():
			if !ok {
				continue
			}
			if r.Err != nil {
				_ = os.RemoveAll(tmpDir)
				return "", fmt.Errorf("executing job %d, %s: %v", r.ID, r.Desc, r.Err)
			}
			log.Default().Printf("processed job %d. %s\n", r.ID, r.Desc)
			if r.ID == 2 {
				s = r.Value.(carbites.Splitter)
			}
		case <-p0.Done:
			break L0
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
func (dp *DirPublisher) CarChunksToNftStorage(
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
					res, err := dp.nftStorage.UploadCar(ctx, f)
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
L1:
	for {
		select {
		case r, ok := <-p1.Results():
			if !ok {
				continue
			}
			if r.Err != nil {
				return fmt.Errorf("executing job %d, %s: %v", r.ID, r.Desc, r.Err)
			}
			log.Default().Printf("processed job %d: %s, %v", r.ID, r.Desc, r.Value)
		case <-p1.Done:
			break L1
		}
	}
	_ = os.RemoveAll(tmpDir)
	return nil
}
