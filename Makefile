# =============================================================================
# Swifty-Proteins — single entry point.
# Run `make` (or `make help`) to see everything.
# =============================================================================

# docker compose v2 with a v1 fallback
COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")

.DEFAULT_GOAL := help

.PHONY: help doctor up down logs clean

help: ## Show this help
	@echo "Swifty-Proteins — available commands:"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[1m%-10s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "Typical jury flow:  make doctor  →  make up  →  cd frontend && npx expo start"

doctor: ## Check that required dependencies are installed
	@bash scripts/doctor.sh

up: ## Start backend + database (detached)
	@bash scripts/ensure-env.sh
	$(COMPOSE) up -d --build db backend
	@bash scripts/smoke.sh
	@echo ">> Backend on http://localhost:3000  —  now run the app: cd frontend && npx expo start"

down: ## Stop and remove backend + database containers
	$(COMPOSE) down

logs: ## Tail backend + database logs
	$(COMPOSE) logs -f

clean: ## Remove containers and volumes
	$(COMPOSE) down -v
