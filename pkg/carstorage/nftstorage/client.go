package nftstorage

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/filecoin-project/go-address"
	"github.com/ipfs/go-cid"
	"github.com/tablelandnetwork/rigs/pkg/carstorage"
)

const baseURL = "https://api.nft.storage"

// Client is an NFT.storage client.
type Client struct {
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new Client.
func NewClient(apiKey string) carstorage.CarStorage {
	return &Client{
		apiKey:     apiKey,
		httpClient: &http.Client{},
	}
}

type uploadResponseValue struct {
	Cid string `json:"cid"`
}

type responseError struct {
	Name    string `json:"name"`
	Message string `json:"message"`
}

type uploadResponse struct {
	OK    bool                `json:"ok"`
	Value uploadResponseValue `json:"value,omitempty"`
	Error *responseError      `json:"error,omitempty"`
}

// PutCar uploads a car file.
func (c *Client) PutCar(ctx context.Context, payload io.Reader) (cid.Cid, error) {
	req, err := http.NewRequest("POST", baseURL+"/upload", payload)
	if err != nil {
		return cid.Cid{}, fmt.Errorf("creating request: %v", err)
	}
	req = req.WithContext(ctx)
	c.setAuthHeader(req)
	req.Header.Set("Content-Type", "application/car")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return cid.Cid{}, fmt.Errorf("executing request: %v", err)
	}
	defer func() {
		_ = res.Body.Close()
	}()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return cid.Cid{}, fmt.Errorf("reading response body: %v", err)
	}

	uploadResponse := &uploadResponse{}
	if err := json.Unmarshal(body, uploadResponse); err != nil {
		return cid.Cid{}, fmt.Errorf("unmarshaling response: %v, \n%s", err, string(body))
	}

	if uploadResponse.Error != nil {
		return cid.Cid{}, fmt.Errorf("%s: %s", uploadResponse.Error.Name, uploadResponse.Error.Message)
	}

	resCid, err := cid.Decode(uploadResponse.Value.Cid)
	if err != nil {
		return cid.Cid{}, fmt.Errorf("decoding cid: %v", err)
	}

	return resCid, nil
}

type dealJSON struct {
	ChainDealID       uint64 `json:"chainDealID,omitempty"`
	Miner             string `json:"miner,omitempty"`
	Status            string `json:"status"`
	PieceCid          string `json:"pieceCid,omitempty"`
	BatchRootCid      string `json:"batchRootCid,omitempty"`
	DataModelSelector string `json:"datamodelSelector,omitempty"`
	StatusText        string `json:"statusText"`
	DealActivation    string `json:"dealActivation,omitempty"`
	DealExpiration    string `json:"dealExpiration,omitempty"`
	LastChanged       string `json:"lastChanged"`
}

type statusJSON struct {
	Cid     string     `json:"cid"`
	Size    uint64     `json:"size"`
	Created string     `json:"created"`
	Deals   []dealJSON `json:"deals"`
}

type statusResponse struct {
	OK    bool           `json:"ok"`
	Value statusJSON     `json:"value,omitempty"`
	Error *responseError `json:"error,omitempty"`
}

// Status implements carstorage.CarStorage.Status.
func (c *Client) Status(ctx context.Context, cid cid.Cid) (*carstorage.Status, error) {
	req, err := http.NewRequest("GET", baseURL+"/"+cid.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %v", err)
	}
	req = req.WithContext(ctx)
	c.setAuthHeader(req)
	req.Header.Set("accept", "application/json")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("executing request: %v", err)
	}
	defer func() {
		_ = res.Body.Close()
	}()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response body: %v", err)
	}

	statusResponse := &statusResponse{}
	if err := json.Unmarshal(body, statusResponse); err != nil {
		return nil, fmt.Errorf("unmarshaling response: %v, \n%s", err, string(body))
	}

	if statusResponse.Error != nil {
		return nil, fmt.Errorf("%s: %s", statusResponse.Error.Name, statusResponse.Error.Message)
	}

	status, err := statusJSONToStatus(statusResponse.Value)
	if err != nil {
		return nil, fmt.Errorf("converting response to status: %v", err)
	}

	return status, nil
}

func (c *Client) setAuthHeader(req *http.Request) {
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
}

const iso8601 = "2006-01-02T15:04:05.999Z07:00"

func dealJSONToDeal(dj dealJSON) (*carstorage.Deal, error) {
	d := &carstorage.Deal{}
	d.DealID = dj.ChainDealID
	var err error
	d.StorageProvider, err = address.NewFromString(dj.Miner)
	if err != nil {
		return nil, err
	}
	d.Status = dj.Status
	if dj.PieceCid != "" {
		d.PieceCid, err = cid.Parse(dj.PieceCid)
		if err != nil {
			return nil, err
		}
	} else {
		d.PieceCid = cid.Undef
	}
	if dj.BatchRootCid != "" {
		d.DataCid, err = cid.Parse(dj.BatchRootCid)
		if err != nil {
			return nil, err
		}
	} else {
		d.DataCid = cid.Undef
	}
	d.DataModelSelector = dj.DataModelSelector
	if dj.DealActivation != "" {
		t, err := time.Parse(iso8601, dj.DealActivation)
		if err != nil {
			return nil, err
		}
		d.Activation = &t
	}
	if dj.LastChanged != "" {
		d.Updated, err = time.Parse(iso8601, dj.LastChanged)
		if err != nil {
			return nil, err
		}
	}
	return d, nil
}

func statusJSONToStatus(sj statusJSON) (*carstorage.Status, error) {
	status := &carstorage.Status{}
	var err error
	status.Cid, err = cid.Parse(sj.Cid)
	if err != nil {
		return nil, err
	}
	status.DagSize = sj.Size
	status.Created, err = time.Parse(iso8601, sj.Created)
	if err != nil {
		return nil, err
	}
	var deals []carstorage.Deal
	for _, dealJSON := range sj.Deals {
		deal, err := dealJSONToDeal(dealJSON)
		if err != nil {
			return nil, err
		}
		deals = append(deals, *deal)
	}
	status.Deals = deals
	return status, nil
}
