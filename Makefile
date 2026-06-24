# =============================================================================
# Swifty-Proteins — single entry point.
# Run `make` (or `make help`) to see everything.
# =============================================================================

# docker compose v2 with a v1 fallback
COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")

.DEFAULT_GOAL := help

.PHONY: help doctor up down logs apk clean

help: ## Show this help
	@echo "Swifty-Proteins — available commands:"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[1m%-10s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "Typical jury flow:  make doctor  →  make up  →  install dist/app-release.apk"

doctor: ## Check that required dependencies are installed
	@bash scripts/doctor.sh

up: ## Start backend + database (detached)
	$(COMPOSE) up -d --build db backend
	@echo ">> Backend on http://localhost:3000  —  now install dist/app-release.apk on a device"

down: ## Stop and remove backend + database containers
	$(COMPOSE) down

logs: ## Tail backend + database logs
	$(COMPOSE) logs -f

apk: ## Build the release APK inside the heavy Android image → dist/app-release.apk
	$(COMPOSE) --profile build run --rm --build apk-builder
	@echo ">> Done. APK at dist/app-release.apk"

clean: ## Remove containers, volumes, and built artifacts
	$(COMPOSE) --profile build down -v
	@rm -f dist/*.apk
