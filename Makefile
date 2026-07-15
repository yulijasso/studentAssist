.PHONY: help env-setup up down logs \
        web-dev web-build web-test web-lint web-typecheck web-check \
        db-migrate db-push db-studio db-seed \
        widget-build widget-copy install

# Default target
help:
	@echo "UTRGV Campus Assist — available targets:"
	@echo ""
	@echo "  Setup:"
	@echo "    env-setup        Initialise .env from .env.example (run once)"
	@echo "    install          Install all pnpm dependencies"
	@echo ""
	@echo "  Infrastructure:"
	@echo "    up               Start PostgreSQL + Redis via Docker Compose"
	@echo "    down             Stop and remove containers"
	@echo "    logs             Tail Docker Compose logs"
	@echo ""
	@echo "  Web (Next.js + tRPC backend):"
	@echo "    web-dev          Run Next.js dev server on port 3000"
	@echo "    web-build        Build Next.js for production"
	@echo "    web-typecheck    TypeScript type check (tsc --noEmit)"
	@echo "    web-lint         Run ESLint"
	@echo "    web-test         Run Vitest suite"
	@echo "    web-check        Run all checks before pushing (typecheck + tests)"
	@echo ""
	@echo "  Database:"
	@echo "    db-migrate       Apply Drizzle migrations"
	@echo "    db-push          Push schema changes (dev only)"
	@echo "    db-studio        Open Drizzle Studio"
	@echo ""
	@echo "  Widget:"
	@echo "    widget-build     Build widget.js via Vite"
	@echo "    widget-copy      Build widget + copy to web/public/static/"

# ── Env setup ──────────────────────────────────────────────────────────────────

env-setup:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "  created  .env (fill in your API keys)"; \
	else \
		echo "  exists   .env"; \
	fi
	@if [ ! -e web/.env.local ]; then \
		ln -s ../.env web/.env.local; \
		echo "  linked   web/.env.local -> ../.env"; \
	else \
		echo "  exists   web/.env.local"; \
	fi
	@echo ""
	@echo "Done. Edit .env with your real keys, then run: make up"

# ── Install ────────────────────────────────────────────────────────────────────

install:
	pnpm install

# ── Infrastructure ─────────────────────────────────────────────────────────────

up:
	docker compose --env-file .env up -d

down:
	docker compose --env-file .env down

logs:
	docker compose --env-file .env logs -f

# ── Web ────────────────────────────────────────────────────────────────────────

web-dev:
	cd web && pnpm dev

web-build:
	cd web && pnpm build

web-test:
	cd web && pnpm test:run

web-lint:
	cd web && pnpm lint

web-typecheck:
	cd web && pnpm typecheck

# Run all checks — typecheck + tests (run this before pushing)
web-check:
	cd web && pnpm typecheck && pnpm test:run

# ── Database ───────────────────────────────────────────────────────────────────

db-migrate:
	cd web && pnpm db:migrate

db-push:
	cd web && pnpm db:push

db-studio:
	cd web && pnpm db:studio

db-seed:
	cd web && npx tsx scripts/seed_utrgv.ts

# ── Widget ─────────────────────────────────────────────────────────────────────

widget-build:
	cd widget && pnpm build

widget-copy: widget-build
	mkdir -p web/public/static
	cp widget/dist/widget.js web/public/static/widget.js
	@echo "widget.js copied to web/public/static/"
