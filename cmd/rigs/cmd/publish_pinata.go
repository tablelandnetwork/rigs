package cmd

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/tablelandnetwork/rigs/pkg/wpool"
	"golang.org/x/time/rate"
)

func init() {
	publishCmd.AddCommand(pinataCmd)
}

var pinataCmd = &cobra.Command{
	Use:   "pinata",
	Short: "Pin all rig images to Pinata",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		rigs, err := localStore.Rigs(ctx)
		checkErr(err)
		var pinJobs []wpool.Job
		execFcn := func(cid string, name string) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				return pin(ctx, cid, name)
			}
		}
		for i, rig := range rigs {
			pinJobs = append(
				pinJobs,
				wpool.Job{
					ID:     wpool.JobID(i),
					ExecFn: execFcn(rig.Images.String, fmt.Sprintf("%d", rig.ID)),
					Desc:   fmt.Sprintf("%d, %s", rig.ID, rig.Images.String),
				},
			)
		}

		pool := wpool.New(10, rate.Every(time.Millisecond*400))
		go pool.GenerateFrom(pinJobs)
		go pool.Run(ctx)
		count := 1
	Loop:
		for {
			select {
			case r, ok := <-pool.Results():
				if !ok {
					break
				}
				if r.Err != nil {
					fmt.Printf("%d/%d error processing job %d: %v\n", count, len(pinJobs), r.ID, r.Err)
					break
				}
				fmt.Printf("%d/%d pinned %s, %v\n", count, len(pinJobs), r.Desc, r.Value)
			case <-pool.Done:
				fmt.Println("done")
				break Loop
			}
			count++
		}
	},
}

func pin(ctx context.Context, cid string, name string) (string, error) {
	url := "https://api.pinata.cloud/pinning/pinByHash"
	method := "POST"

	ps := fmt.Sprintf(`{
	"hashToPin": "%s",
	"pinataMetadata": {
		"name": "%s"
	},
	"pinataOptions": {
		"hostNodes": [
			"/ip4/73.95.104.128/tcp/4001/p2p/12D3KooWB9bywKsTcJ7x97mKY1kjHtgmQYJJiLbyhezp1ALVhHvZ"
		]
	}
}`, cid, name)
	// fmt.Println(ps)
	payload := strings.NewReader(ps)

	client := &http.Client{}
	req, err := http.NewRequestWithContext(ctx, method, url, payload)
	if err != nil {
		return "", err
	}
	jwt := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI5NzViMmZiMi03ZTkwLTRlZTgtYTdkZi0yMDYyMTE4OTVhM2YiLCJlbWFpbCI6Im9wc0B0ZXh0aWxlLmlvIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siaWQiOiJGUkExIiwiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjF9LHsiaWQiOiJOWUMxIiwiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjF9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjczMDU1MWRkMGZjODRmNGY1NTc3Iiwic2NvcGVkS2V5U2VjcmV0IjoiZDE3YzkwMmUxY2ZmMjgyY2MyYmQ1NTU2N2ZlNzI5MTM4Nzk3YjYzNTlhYzhmYzkyYzBjZDRhZTg5ZDNhMDUzOCIsImlhdCI6MTY1NzgxMTU2M30.ZDXrG6_0NX2QfwbznPRMB_TOH94yCgQ_QMlLb3aIFz0" //nolint
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", jwt))
	req.Header.Add("Content-Type", "application/json")

	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	return string(body), err
}
