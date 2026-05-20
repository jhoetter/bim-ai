# bim-ai monorepo Makefile — mirrors collaboration-ai ergonomics.

_HOF_OS_IMPORT_DB := $(DATABASE_URL)
_HOF_OS_IMPORT_JWT := $(HOF_SUBAPP_JWT_SECRET)
ifneq ($(and $(strip $(_HOF_OS_IMPORT_JWT)),$(strip $(_HOF_OS_IMPORT_DB))),)
DATABASE_URL := $(_HOF_OS_IMPORT_DB)
HOF_SUBAPP_JWT_SECRET := $(_HOF_OS_IMPORT_JWT)
HOFOS_SUBAPP_NATIVE := 1
endif

PYTHON ?= python3.13
APP_DIR := app
PNPM := pnpm
UV ?= uv
PYTEST_ARGS ?= tests/

# Local suite port allocation:
#   2000 → bim-ai web (:8500 API)  <-- this repo (avoids 3xxx used by sister apps)
WEB_PORT ?= 2000
API_PORT ?= 8500
design ?= default
SEED_NAME ?= $(name)
SEED_ROOT ?= $(seed_root)
SEED_ARGS := $(if $(SEED_NAME),--name "$(SEED_NAME)",) $(if $(SEED_ROOT),--root "$(SEED_ROOT)",)

.PHONY: help install dev dev-api dev-web kill-ports seed seed-clear seed-artifact verify-sketch-seeds verify-sketch-seeds-live \
	db-up db-down db-reset db-logs \
test test-py test-py-full test-py-focused test-py-real-path test-web-real-path test-js format format-check python-format-check lint lint-js lint-py architecture \
	quality-waivers maintainability-budgets js-lint-budget ui-quality-budgets security-hygiene test-env-policy code-quality-report typecheck verify build clean lockfile-check verify-refinement-reliability

help:
	@echo "bim-ai Makefile"
	@echo "  install   — pnpm + Python venv"
	@echo "  dev       — db-up + API + Web (:$(API_PORT) / :$(WEB_PORT)); make dev design=conservative|default"
	@echo "  seed      — load seed-artifacts/* or an empty dev model; pass name=<seed-name> to load one"
	@echo "  seed-clear — delete all seed-managed local models"
	@echo "  verify-sketch-seeds — validate seed artifact manifests/hashes"
	@echo "  verify-sketch-seeds-live — strict current-HEAD live sketch-to-BIM acceptance"
	@echo "  test-py-focused — focused backend tests without coverage; pass PYTEST_ARGS=tests/path.py"
	@echo "  test-py-real-path — marked backend real-path smoke tests without coverage"
	@echo "  test-web-real-path — Playwright browser smoke through Vite proxy to real FastAPI health route"
	@echo "  quality-waivers — validate expiring machine-readable quality waivers"
	@echo "  maintainability-budgets — enforce file-size ownership and disposition budgets"
	@echo "  js-lint-budget — prevent the JavaScript lint backlog from growing"
	@echo "  ui-quality-budgets — enforce UI smoke, visual, and bundle-size budgets"
	@echo "  security-hygiene — scan tracked files for secrets and unsafe browser APIs"
	@echo "  test-env-policy — verify browser rendering tests stay out of Vitest/jsdom"
	@echo "  code-quality-report — emit generated code-quality scorecard"
	@echo "  verify    — format-check, Python lint/format, architecture, tc, tests, build"

install:
	$(PNPM) install
	cd $(APP_DIR) && uv venv --clear .venv && uv sync --frozen

lockfile-check:
	cd $(APP_DIR) && uv lock --check

db-up:
	docker compose -f infra/docker-compose.yml up -d
	@echo "Postgres localhost:5545  Redis localhost:6392  MinIO http://localhost:9120"

db-down:
	docker compose -f infra/docker-compose.yml down

db-reset:
	docker compose -f infra/docker-compose.yml down -v
	$(MAKE) db-up

db-logs:
	docker compose -f infra/docker-compose.yml logs -f --tail=100

kill-ports:
	@PORTS="$(API_PORT) $(WEB_PORT)"; \
	WS_TAG="$(CURDIR)"; \
	for _ in 1 2 3 4 5 6; do \
	  for p in $$PORTS; do \
	    pids=$$(lsof -ti :$$p 2>/dev/null); \
	    [ -n "$$pids" ] && kill -9 $$pids 2>/dev/null || true; \
	  done; \
	  pkill -9 -f "vite.*$$WS_TAG"     2>/dev/null || true; \
	  pkill -9 -f "uvicorn.*$$WS_TAG"   2>/dev/null || true; \
	  pkill -9 -f "concurrently.*$$WS_TAG" 2>/dev/null || true; \
	  pkill -9 -f "turbo run dev"       2>/dev/null || true; \
	  busy=""; \
	  for p in $$PORTS; do \
	    lsof -ti :$$p >/dev/null 2>&1 && busy="$$busy $$p"; \
	  done; \
	  [ -z "$$busy" ] && exit 0; \
	  sleep 0.5; \
	done; \
	echo "kill-ports: still in use after retries:$$busy" >&2; \
	exit 1

ifeq ($(HOFOS_SUBAPP_NATIVE),1)
dev: kill-ports seed
else
dev: db-up kill-ports seed
endif
	@echo "→ API   http://127.0.0.1:$(API_PORT)/api/health"
	@echo "→ Web   http://127.0.0.1:$(WEB_PORT)"
	$(PNPM) -w exec concurrently -k -n api,web -c blue,magenta \
	  "$(MAKE) dev-api" \
	  "$(MAKE) dev-web"

dev-api:
	cd $(APP_DIR) && PYTHONPATH=. $(UV) run python -m uvicorn bim_ai.main:app --host 127.0.0.1 --port $(API_PORT) --reload

dev-web:
	API_PORT=$(API_PORT) VITE_API_PORT=$(API_PORT) VITE_DESIGN_SYSTEM=$(design) $(PNPM) --filter @bim-ai/web dev --port $(WEB_PORT) --host 127.0.0.1 --strictPort

seed:
	cd $(APP_DIR) && PYTHONPATH=. $(UV) run python scripts/seed.py $(SEED_ARGS)

seed-clear:
	cd $(APP_DIR) && PYTHONPATH=. $(UV) run python scripts/seed.py --clear $(if $(SEED_ROOT),--root "$(SEED_ROOT)",)

seed-artifact:
	node scripts/create-seed-artifact.mjs --name "$(NAME)" --source "$(SOURCE)" --bundle "$(BUNDLE)" $(if $(TITLE),--title "$(TITLE)",) $(if $(DESCRIPTION),--description "$(DESCRIPTION)",) $(if $(LIVE_EVIDENCE),--live-evidence "$(LIVE_EVIDENCE)",) $(if $(REQUIRE_LIVE_EVIDENCE),--require-live-evidence,) $(if $(OUT),--out "$(OUT)",) $(if $(FORCE),--force,)

verify-sketch-seeds:
	node scripts/verify-sketch-seed-artifacts.mjs $(if $(name),--seed "$(name)",)

verify-sketch-seeds-live:
	node scripts/verify-sketch-seed-artifacts.mjs --require-final-evidence --require-phase-packets --require-material-check --live $(if $(name),--seed "$(name)",)

test: test-py test-js

test-py:
	cd $(APP_DIR) && PYTHONPATH=. $(UV) run python -m pytest tests/ -q

test-py-full: test-py

test-py-focused:
	cd $(APP_DIR) && PYTHONPATH=. $(UV) run python -m pytest $(PYTEST_ARGS) -q --no-cov

test-py-real-path:
	cd $(APP_DIR) && PYTHONPATH=. $(UV) run python -m pytest tests/integration/test_real_path_smoke.py tests/integration/test_real_path_db.py -q --no-cov -m integration

test-web-real-path:
	$(PNPM) --filter @bim-ai/web test:e2e:real-backend

test-js:
	$(PNPM) -w turbo test

format:
	$(PNPM) -w prettier --write "**/*.{ts,tsx,js,jsx,json,yml,yaml}"
	cd $(APP_DIR) && $(UV) run ruff format bim_ai tests scripts

format-check:
	$(PNPM) -w prettier --check "**/*.{ts,tsx,js,jsx,json,yml,yaml}"

python-format-check:
	cd $(APP_DIR) && $(UV) run ruff format --check bim_ai tests scripts

lint: lint-js lint-py

lint-js:
	$(PNPM) -w eslint "packages/**/*.{ts,tsx}"

lint-py:
	cd $(APP_DIR) && $(UV) run ruff check bim_ai tests scripts

architecture:
	node scripts/check-architecture.mjs

quality-waivers:
	node scripts/check-quality-waivers.mjs

maintainability-budgets:
	node scripts/check-maintainability-budgets.mjs

js-lint-budget:
	node scripts/check-js-lint-budget.mjs

ui-quality-budgets:
	node scripts/check-ui-quality-budgets.mjs

security-hygiene:
	node scripts/check-security-hygiene.mjs

test-env-policy:
	node scripts/check-frontend-test-environments.mjs

code-quality-report:
	node scripts/code-quality-report.mjs

typecheck:
	$(PNPM) -w turbo typecheck

build:
	$(PNPM) -w turbo build

verify: format-check python-format-check lint-py quality-waivers maintainability-budgets js-lint-budget security-hygiene test-env-policy architecture typecheck test build lockfile-check
	@echo "verify: PASS"

verify-refinement-reliability:
	cd $(APP_DIR) && PYTHONPATH=. $(UV) run python -m pytest tests/agent/refinement_reliability/ -v --no-cov

clean:
	$(PNPM) -w turbo clean || true
	rm -rf node_modules **/node_modules **/dist **/.turbo
	rm -rf $(APP_DIR)/.venv $(APP_DIR)/.pytest_cache
