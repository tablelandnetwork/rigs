package cmd

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"os/signal"

	"github.com/gorilla/mux"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func init() {
	localCmd.AddCommand(viewCmd)

	viewCmd.Flags().Bool(
		"no-client",
		false,
		"specifies that the web server shouldn't host the client web app because it is being started separately",
	)
	viewCmd.Flags().Int("port", 5000, "port for the http server to listen on")
	viewCmd.Flags().String("images-path", "./renders", "path to the rendered rig images")
}

var viewCmd = &cobra.Command{
	Use:   "view",
	Short: "Start a web app to view local Rig data and imagery",
	Run: func(cmd *cobra.Command, args []string) {
		r := mux.NewRouter()
		r.HandleFunc("/rigs", rigsHandler)
		r.PathPrefix("/images/").
			Handler(http.StripPrefix("/images/", http.FileServer(http.Dir(viper.GetString("images-path")))))

		port := viper.GetInt("port")
		addr := fmt.Sprintf("localhost:%d", port)
		api := fmt.Sprintf("http://%s", addr)

		if !viper.GetBool("no-client") {
			r.PathPrefix("/").Handler(http.FileServer(http.Dir("client/dist")))
			checkErr(os.Setenv("API", api))
			npmCmd := exec.Command("npm", "run", "generate")
			npmCmd.Dir = "client"
			stdout, err := npmCmd.Output()
			checkErr(err)
			fmt.Println(string(stdout))
		}

		go func() {
			checkErr(http.ListenAndServe(addr, r))
		}()

		fmt.Printf("server ready and listening at %s. Ctrl+C to stop.\n", api)

		quit := make(chan os.Signal)
		signal.Notify(quit, os.Interrupt) // nolint
		<-quit

		fmt.Println("Stopping...")
	},
}

func rigsHandler(rw http.ResponseWriter, r *http.Request) {
	rigs, err := localStore.Rigs(r.Context())
	if err != nil {
		rw.WriteHeader(http.StatusInternalServerError)
		fmt.Printf("error querying for rigs: %v", err)
		return
	}
	rw.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(rw).Encode(rigs)
}
