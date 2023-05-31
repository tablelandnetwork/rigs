package publisher

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/ipfs/go-cid"
	car "github.com/ipld/go-car/v2"
	carstorage "github.com/ipld/go-car/v2/storage"
	dagpb "github.com/ipld/go-codec-dagpb"
	"github.com/ipld/go-ipld-prime"
	"github.com/ipld/go-ipld-prime/datamodel"
	"github.com/ipld/go-ipld-prime/fluent/qp"
	cidlink "github.com/ipld/go-ipld-prime/linking/cid"
	"github.com/multiformats/go-multicodec"
	"github.com/multiformats/go-multihash"
)

// RendersIndexToCar creates a CAR index from the saved Rigs and stores it as a CAR file.
func (p *Publisher) RendersIndexToCar(ctx context.Context, filename string) (cid.Cid, error) {
	rigs, err := p.localStore.Rigs(ctx)
	if err != nil {
		return cid.Undef, fmt.Errorf("querying local store for rigs: %v", err)
	}

	out, err := os.Create(filename)
	if err != nil {
		return cid.Cid{}, fmt.Errorf("creating file: %v", err)
	}
	defer func() {
		_ = out.Close()
	}()

	// new CAR, with a blank root in the header roots in header because we don't have any yet .. we could use
	// a dummy root CID on the right length and then use ReplaceRootsInFile to
	// come back later and fix it up if it was important
	storage, err := carstorage.NewWritable(out, []cid.Cid{blankCid()}, car.WriteAsCarV1(true))
	if err != nil {
		return cid.Cid{}, fmt.Errorf("creating storage writable car: %v", err)
	}

	// Setup a LinkSystem
	ls := cidlink.DefaultLinkSystem()
	ls.SetWriteStorage(storage)
	lp := cidlink.LinkPrototype{Prefix: cid.Prefix{
		Version:  1,
		Codec:    uint64(multicodec.DagPb),
		MhType:   uint64(multicodec.Sha2_256),
		MhLength: 32,
	}}

	cids := make([]cid.Cid, len(rigs))
	for i, rig := range rigs {
		c, err := cid.Decode(*rig.RendersCid)
		if err != nil {
			return cid.Cid{}, fmt.Errorf("decoding cid: %v", err)
		}
		cids[i] = c
	}

	n, err := qp.BuildMap(dagpb.Type.PBNode, -1, func(ma datamodel.MapAssembler) {
		qp.MapEntry(ma, "Data", qp.Bytes([]byte("hello")))
		qp.MapEntry(ma, "Links", qp.List(int64(len(rigs)), func(la datamodel.ListAssembler) {
			for ii, c := range cids {
				qp.ListEntry(la, qp.Map(3, func(ma datamodel.MapAssembler) {
					qp.MapEntry(ma, "Hash", qp.Link(cidlink.Link{Cid: c}))
					qp.MapEntry(ma, "Name", qp.String(fmt.Sprintf("%d", ii)))
					// optional: qp.MapEntry(ma, "Tsize", qp.Int(0))
				}))
			}
		}))
	})
	if err != nil {
		return cid.Cid{}, fmt.Errorf("building map: %v", err)
	}

	// Write the single block
	link, err := ls.Store(ipld.LinkContext{}, lp, n)
	if err != nil {
		return cid.Cid{}, fmt.Errorf("writing node to store: %v", err)
	}
	log.Default().Println("Wrote single block to CAR:", link.String())
	log.Default().Println("Link cid: ", link.(cidlink.Link).Cid.String())

	// we could write more blocks, perhaps using the link we get after the Store
	// operation to join them together into a coherent DAG.

	// important if we're writing a CARv2, not needed for CARv1
	if err := storage.Finalize(); err != nil {
		return cid.Cid{}, fmt.Errorf("finalizing storage: %v", err)
	}

	// close file so we can manipulate it
	if err := out.Close(); err != nil {
		return cid.Cid{}, fmt.Errorf("closing file: %v", err)
	}

	// replace the dummy root with the real one; if we had more than one block
	// we should either put all of those in the roots list (not ideal) or use
	// the single CID that's at the root of
	if err := car.ReplaceRootsInFile(filename, []cid.Cid{link.(cidlink.Link).Cid}); err != nil {
		return cid.Cid{}, fmt.Errorf("replacing roots in file: %v", err)
	}

	// This is disabled because the uplaod endpoints don't accept incomplete DAGs yet.
	// f, err := os.Open(filename)
	// if err != nil {
	// 	return cid.Cid{}, fmt.Errorf("opening file: %v", err)
	// }
	// defer func() {
	// 	_ = f.Close()
	// }()

	// res, err := p.carStorage.PutCar(ctx, f)
	// if err != nil {
	// 	return cid.Cid{}, fmt.Errorf("uploading car: %v", err)
	// }

	return link.(cidlink.Link).Cid, nil
}

// just a blank CID to use as a dummy root, same length as a real CID we're
// going to use with ReplaceRootsInFile.
func blankCid() cid.Cid {
	b := make([]byte, 32)
	mh, _ := multihash.Encode(b, multihash.SHA2_256)
	return cid.NewCidV1(cid.DagProtobuf, mh)
}
