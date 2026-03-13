IMAGE_NAME ?= flutch-oss
IMAGE_TAG  ?= latest

# ── Install ────────────────────────────────────────────────────────────────────

.PHONY: install
install:                       ## Install backend + frontend dependencies
	yarn install
	yarn client:install

# ── Development ────────────────────────────────────────────────────────────────

.PHONY: dev
dev:                           ## Start backend in watch mode (hot-reload)
	yarn dev

.PHONY: dev-client
dev-client:                    ## Start frontend dev server (Vite)
	yarn client:dev

.PHONY: dev-all
dev-all:                       ## Start backend + frontend together (one terminal)
	yarn dev:all

# ── Build ──────────────────────────────────────────────────────────────────────

.PHONY: build
build:                         ## Build backend (NestJS → dist/)
	yarn build

.PHONY: build-client
build-client:                  ## Build frontend (Vite → client/dist/)
	yarn client:build

.PHONY: build-all
build-all: build build-client  ## Build backend + frontend

# ── Docker ─────────────────────────────────────────────────────────────────────

.PHONY: docker-build
docker-build:                  ## Build Docker image
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .

.PHONY: up
up:                            ## Start full stack (docker-compose up -d)
	docker-compose up -d

.PHONY: down
down:                          ## Stop full stack
	docker-compose down

.PHONY: logs
logs:                          ## Follow engine logs
	docker-compose logs -f engine

.PHONY: restart
restart:                       ## Restart engine container only
	docker-compose restart engine

# ── Migrations ─────────────────────────────────────────────────────────────────

.PHONY: migrate
migrate:                       ## Run pending migrations
	yarn migration:run

.PHONY: migrate-revert
migrate-revert:                ## Revert last migration
	yarn migration:revert

# ── Tests ──────────────────────────────────────────────────────────────────────

.PHONY: test
test:                          ## Run unit tests
	yarn test

.PHONY: test-e2e
test-e2e:                      ## Run E2E tests (requires Postgres)
	yarn test:e2e

.PHONY: test-all
test-all:                      ## Run unit + E2E tests
	yarn test:all

# ── Help ───────────────────────────────────────────────────────────────────────

.PHONY: help
help:                          ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
