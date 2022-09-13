package nftstorage

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const baseURL = "https://api.nft.storage"

// Client is an NFT.storage client.
type Client struct {
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new Client.
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey:     apiKey,
		httpClient: &http.Client{},
	}
}

type uploadResponseValue struct {
	Cid string `json:"cid"`
}

type uploadResponseError struct {
	Name    string `json:"name"`
	Message string `json:"message"`
}

type uploadResponse struct {
	OK    bool                 `json:"ok"`
	Value uploadResponseValue  `json:"value,omitempty"`
	Error *uploadResponseError `json:"error,omitempty"`
}

// UploadCar uploads a car file.
func (c *Client) UploadCar(ctx context.Context, payload io.Reader) (string, error) {
	req, err := http.NewRequest("POST", baseURL+"/upload", payload)
	if err != nil {
		return "", fmt.Errorf("creating request: %v", err)
	}
	req = req.WithContext(ctx)
	c.setAuthHeader(req)
	req.Header.Set("Content-Type", "application/car")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("executing request: %v", err)
	}
	defer func() {
		_ = res.Body.Close()
	}()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", fmt.Errorf("reading response body: %v", err)
	}

	uploadResponse := &uploadResponse{}
	if err := json.Unmarshal(body, uploadResponse); err != nil {
		return "", fmt.Errorf("unmarshaling response: %v", err)
	}

	if uploadResponse.Error != nil {
		return "", fmt.Errorf("%s: %s", uploadResponse.Error.Name, uploadResponse.Error.Message)
	}

	return uploadResponse.Value.Cid, nil
}

func (c *Client) setAuthHeader(req *http.Request) {
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
}
