# nft-minter

### Generate metadata from Google Sheets

```shell
curl 'http://localhost:5000/generate?count=1000'
```

Use `count` to increase the number of outputs. The max is 10000. `reload=true` will reload the trait sheets. This is useful when playing with trait names or distribution in real time.

### Running the Client

```shell
cd client
npm install
npm run dev
````

open a browser window to http://localhost:3000
