include .bingo/Variables.mk

HEAD_SHORT ?= $(shell git rev-parse --short HEAD)
PLATFORM ?= $(shell uname -m)

BIN_VERSION?="git"

HTTP_PORT ?= 5000
GCP_PROJECT=textile-310716

GOVVV=go run github.com/ahmetb/govvv@v0.3.0 

GOVVV_FLAGS=$(shell $(GOVVV) -flags -version $(BIN_VERSION) -pkg $(shell go list ./buildinfo))

# Code generation

ethereum:
	go run github.com/ethereum/go-ethereum/cmd/abigen@v1.10.13 --abi ./pkg/tableregistry/impl/ethereum/abi.json --pkg ethereum --type Contract --out pkg/tableregistry/impl/ethereum/contract.go --bin pkg/tableregistry/impl/ethereum/bytecode.bin
.PHONY: ethereum

# Building and publishing image to GCP

build-api:
	go build -ldflags="${GOVVV_FLAGS}" ./cmd/api
.PHONY: build-api

build-api-dev:
	go build -ldflags="${GOVVV_FLAGS}" -gcflags="all=-N -l" ./cmd/api
.PHONY: build-api-dev

image:
	docker build --platform linux/amd64 -t minter/api:sha-$(HEAD_SHORT) -t minter/api:latest -f ./cmd/api/Dockerfile .
.PHONY: image

publish:
	docker tag minter/api:sha-$(HEAD_SHORT) us-west1-docker.pkg.dev/${GCP_PROJECT}/textile/minter/api:sha-$(HEAD_SHORT)
	docker push us-west1-docker.pkg.dev/${GCP_PROJECT}/textile/minter/api:sha-$(HEAD_SHORT)
.PHONY: publish

# Test

test:
	go test -v ./...
.PHONY: test

# Lint

lint:
	go run github.com/golangci/golangci-lint/cmd/golangci-lint@v1.46.2 run
.PHONYY: lint
