.DEFAULT_GOAL := help

# ── Variables ─────────────────────────────────────────────────
NPM     := npm
DIST    := dist dist-electron

# ── Dependencies ──────────────────────────────────────────────
.PHONY: install
install:                ## Install npm dependencies
	$(NPM) install

# ── Development ───────────────────────────────────────────────
.PHONY: dev desktop-dev preview
dev:                    ## Start Vite dev server
	$(NPM) run dev

desktop-dev:            ## Start Electron + Vite in dev mode
	$(NPM) run desktop:dev

preview:                ## Preview production build locally
	$(NPM) run preview

# ── Quality ───────────────────────────────────────────────────
.PHONY: typecheck test test-watch ci
typecheck:              ## Run TypeScript type checking
	$(NPM) run typecheck

test:                   ## Run tests once
	$(NPM) run test

test-watch:             ## Run tests in watch mode
	$(NPM) run test:watch

ci:                     ## Run full CI pipeline (typecheck + test + build)
	$(NPM) run ci

# ── Build ─────────────────────────────────────────────────────
.PHONY: build desktop-build desktop-build-mac
build:                  ## Build web assets with Vite
	$(NPM) run build

desktop-build:          ## Build Electron app for current platform
	$(NPM) run desktop:build

desktop-build-mac:      ## Build Electron app for macOS (dmg + zip)
	$(NPM) run desktop:build:mac

# ── Cleanup ───────────────────────────────────────────────────
.PHONY: clean distclean
clean:                  ## Remove build artifacts
	rm -rf $(DIST)

distclean: clean        ## Remove build artifacts and node_modules
	rm -rf node_modules

# ── Help ──────────────────────────────────────────────────────
.PHONY: help
help:                   ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
