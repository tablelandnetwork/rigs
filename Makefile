BIN_VERSION?="git"
GOVVV=go run github.com/ahmetb/govvv@v0.3.0 
GOVVV_FLAGS=$(shell $(GOVVV) -flags -version $(BIN_VERSION) -pkg $(shell go list ./pkg/buildinfo))

build-rigs:
	go build -ldflags="${GOVVV_FLAGS}" ./cmd/rigs
.PHONY: build-rigs

build-rigs-dev:
	go build -ldflags="${GOVVV_FLAGS}" -gcflags="all=-N -l" ./cmd/rigs
.PHONY: build-rigs-dev

# Test

test:
	go test -v ./...
.PHONY: test

# Lint

lint:
	go run github.com/golangci/golangci-lint/cmd/golangci-lint@v1.52.2 run
.PHONYY: lint
