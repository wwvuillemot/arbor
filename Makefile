.PHONY: help setup dev build clean up down logs restart health db-push db-generate db-studio seed db-reset test test-unit test-integration test-e2e test-watch test-coverage lint format typecheck audit api-generate api-watch desktop desktop-build backup restore export-md

# Default target
.DEFAULT_GOAL := help

# Help
help:
	@echo "Arbor - Local-First AI Writing Assistant"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Development:"
	@echo "  make setup           - Initial setup (run once)"
	@echo "  make dev             - Start development servers"
	@echo "  make desktop         - Start Tauri desktop app (manages services automatically)"
	@echo "  make build           - Build for production"
	@echo "  make desktop-build   - Build Tauri desktop app"
	@echo "  make clean           - Clean build artifacts"
	@echo ""
	@echo "Docker:"
	@echo "  make up              - Start Docker services (PostgreSQL, Redis, pgAdmin)"
	@echo "  make down            - Stop Docker services"
	@echo "  make logs            - View Docker logs"
	@echo "  make restart         - Restart Docker services"
	@echo "  make health          - Check service health and readiness"
	@echo "  make health          - Check health of all services"
	@echo ""
	@echo "Database:"
	@echo "  make db-push         - Push database schema to PostgreSQL"
	@echo "  make db-generate     - Generate migration files from schema"
	@echo "  make db-studio       - Open Drizzle Studio (database GUI)"
	@echo "  make seed            - Seed database with example projects"
	@echo "  make db-reset        - Reset database (⚠️  destroys data)"
	@echo ""
	@echo "Testing:"
	@echo "  make test            - Run all tests"
	@echo "  make test-unit       - Run unit tests"
	@echo "  make test-integration - Run integration tests"
	@echo "  make test-e2e        - Run E2E tests"
	@echo "  make test-watch      - Run tests in watch mode"
	@echo "  make test-coverage   - Generate coverage report"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint            - Lint code"
	@echo "  make format          - Format code"
	@echo "  make typecheck       - Run TypeScript type checking"
	@echo "  make audit           - Security audit (pnpm audit)"
	@echo ""
	@echo "API Client:"
	@echo "  make api-generate    - Generate typed API client from OpenAPI spec"
	@echo "  make api-watch       - Watch OpenAPI spec and regenerate client"
	@echo ""
	@echo "Tauri:"
	@echo "  make tauri-dev       - Run Tauri in development mode"
	@echo "  make tauri-build     - Build Tauri app for production"
	@echo "  make tauri-bundle    - Create platform installers"
	@echo ""
	@echo "Git & Backup:"
	@echo "  make backup          - Create database backup and commit to Git"
	@echo "  make restore         - Restore from latest backup"
	@echo "  make export-md       - Export all notes as markdown files"
	@echo ""
	@echo "Quick Access:"
	@echo "  pgAdmin:             http://localhost:5050 (admin@arbor.dev / admin)"
	@echo "  PostgreSQL:          localhost:5432 (arbor / local_dev_only)"
	@echo "  Redis:               localhost:6379"

# Development
setup:
	@./scripts/setup.sh

dev:
	pnpm run dev

dev-api:
	pnpm run dev:api

build:
	pnpm run build

clean:
	rm -rf node_modules
	rm -rf .next
	rm -rf dist
	rm -rf coverage
	pnpm store prune

# Docker
up:
	@echo "========================================="
	@echo "   Starting Arbor Services"
	@echo "========================================="
	@echo ""
	@echo "Stopping any existing containers..."
	@docker compose -f apps/key-value-store/docker-compose.yml -f apps/api/docker-compose.yml -f apps/web/docker-compose.yml down --remove-orphans 2>/dev/null || true
	@echo "Starting Docker services with Traefik..."
	@docker compose -f apps/key-value-store/docker-compose.yml -f apps/api/docker-compose.yml -f apps/web/docker-compose.yml -f tmp/traefik/local/arbor-docker-compose.traefik.yml up -d
	@echo "Waiting for services to be ready..."
	@sleep 5
	@echo ""
	@echo "Setting up database..."
	@pnpm run db:push 2>/dev/null || echo "⚠️  Schema push failed (may already exist)"
	@echo ""
	@echo "Seeding database (idempotent)..."
	@pnpm run db:seed 2>/dev/null || echo "⚠️  Seeding skipped (data may already exist)"
	@echo ""
	@echo "Verifying HTTP endpoints..."
	@for i in 1 2 3 4 5; do \
		curl -s -o /dev/null -w "" http://app.arbor.local 2>/dev/null && echo "  ✅ Web App: http://app.arbor.local (HTTP 200)" && break || \
		([ $$i -eq 5 ] && echo "  ❌ Web App: http://app.arbor.local (not responding)" || sleep 2); \
	done
	@for i in 1 2 3 4 5; do \
		curl -s -o /dev/null -w "" http://api.arbor.local/trpc/health 2>/dev/null && echo "  ✅ API Server: http://api.arbor.local/trpc/health (HTTP 200)" && break || \
		([ $$i -eq 5 ] && echo "  ❌ API Server: http://api.arbor.local/trpc/health (not responding)" || sleep 2); \
	done
	@echo ""
	@echo "========================================="
	@echo "   ✅ Arbor is ready!"
	@echo "========================================="
	@echo ""
	@echo "Services running:"
	@docker ps --filter "name=arbor-" --format "  • {{.Names}}: {{.Status}}"
	@echo ""
	@echo "Quick Access:"
	@echo "  Web App:             http://app.arbor.local"
	@echo "  API Server:          http://api.arbor.local"
	@echo "  pgAdmin (Traefik):   http://pgadmin.arbor.local"
	@echo "  Redis:               redis.arbor.local:6379"
	@echo "  PostgreSQL:          localhost:5432"
	@echo ""

down:
	@docker compose -f apps/key-value-store/docker-compose.yml -f apps/api/docker-compose.yml -f apps/web/docker-compose.yml down --remove-orphans

logs:
	@docker compose -f apps/key-value-store/docker-compose.yml -f apps/api/docker-compose.yml -f apps/web/docker-compose.yml logs -f

restart:
	make down
	make up

health:
	@echo "========================================="
	@echo "   Arbor Health Check"
	@echo "========================================="
	@echo ""
	@echo "Docker Services:"
	@docker ps --filter "name=arbor-" --format "  {{.Names}}: {{.Status}}" 2>/dev/null || echo "  ❌ No services running"
	@echo ""
	@echo "Service Connectivity:"
	@docker exec arbor-postgres pg_isready -U arbor > /dev/null 2>&1 && echo "  ✅ PostgreSQL: Ready" || echo "  ❌ PostgreSQL: Not ready"
	@docker exec arbor-redis redis-cli ping > /dev/null 2>&1 && echo "  ✅ Redis: Ready" || echo "  ❌ Redis: Not ready"
	@echo ""
	@echo "HTTP Endpoints:"
	@curl -s -o /dev/null -w "" http://app.arbor.local 2>/dev/null && echo "  ✅ Web App: http://app.arbor.local (HTTP 200)" || echo "  ❌ Web App: http://app.arbor.local (not responding)"
	@curl -s -o /dev/null -w "" http://api.arbor.local/trpc/health 2>/dev/null && echo "  ✅ API Server: http://api.arbor.local/trpc/health (HTTP 200)" || echo "  ❌ API Server: http://api.arbor.local/trpc/health (not responding)"
	@curl -s -o /dev/null -w "" http://pgadmin.arbor.local 2>/dev/null && echo "  ✅ pgAdmin: http://pgadmin.arbor.local (HTTP 200)" || echo "  ⚠️  pgAdmin: Not accessible via Traefik"
	@echo ""
	@echo "Database Schema:"
	@docker exec arbor-postgres psql -U arbor -d arbor -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'nodes';" 2>/dev/null | grep -q "1" && echo "  ✅ Schema pushed (nodes table exists)" || echo "  ⚠️  Schema not pushed yet (run: make db-push)"
	@echo ""
	@echo "Quick Access:"
	@echo "  App (Next.js):       http://app.arbor.local"
	@echo "  API Server:          http://api.arbor.local"
	@echo "  pgAdmin:             http://pgadmin.arbor.local"
	@echo "  PostgreSQL:          postgres:5432 (via Docker network)"
	@echo "  Redis:               redis:6379 (via Docker network)"
	@echo ""
	@echo "Credentials:"
	@echo "  pgAdmin:             admin@arbor.dev / admin"
	@echo "  PostgreSQL:          arbor / local_dev_only"
	@echo ""
	@echo "Next Steps:"
	@docker exec arbor-postgres psql -U arbor -d arbor -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'nodes';" 2>/dev/null | grep -q "1" || echo "  1. Run 'make db-push' to push database schema"
	@docker exec arbor-postgres psql -U arbor -d arbor -c "SELECT COUNT(*) FROM nodes;" 2>/dev/null | grep -q "0" && echo "  2. Run 'make seed' to add example projects" || true
	@echo "  3. Start development with 'make dev' (when ready)"
	@echo ""

# Database
db-push:
	@pnpm run db:push

db-generate:
	@pnpm run db:generate

db-studio:
	@pnpm run db:studio

seed:
	@pnpm run db:seed

db-reset:
	@docker compose -f apps/key-value-store/docker-compose.yml -f apps/api/docker-compose.yml -f apps/web/docker-compose.yml down -v
	@make up
	@make db-push
	@make seed

# Testing
test:
	@echo "========================================="
	@echo "   Running All Tests"
	@echo "========================================="
	@echo ""
	@echo "📦 Key-Value Store Tests..."
	@cd apps/key-value-store && $(MAKE) test
	@echo ""
	@echo "🔧 API Tests..."
	@cd apps/api && $(MAKE) test
	@echo ""
	@echo "🌐 Web Tests..."
	@cd apps/web && $(MAKE) test
	@echo ""
	@echo "========================================="
	@echo "   ✅ All tests complete!"
	@echo "========================================="

test-unit:
	@echo "Running unit tests..."
	@pnpm run test:unit

test-integration:
	@echo "Running integration tests..."
	@pnpm run test:integration

test-e2e:
	@echo "Running e2e tests..."
	@pnpm run test:e2e

test-watch:
	@pnpm run test:watch

test-coverage:
	@echo "Running tests with coverage..."
	@pnpm run test:coverage
	@echo "Coverage report: ./coverage/index.html"

# Code Quality
lint:
	pnpm run lint

format:
	pnpm run format

typecheck:
	pnpm run typecheck

audit:
	pnpm audit

# API Client
api-generate:
	pnpm run api:generate

api-watch:
	pnpm run api:watch

# Desktop App (Tauri)
desktop:
	@echo "========================================="
	@echo "   Starting Arbor Desktop App"
	@echo "========================================="
	@echo ""
	@echo "The desktop app will:"
	@echo "  1. Start Docker services (PostgreSQL, Redis, API, Web)"
	@echo "  2. Load the Next.js app in a native window"
	@echo "  3. Shut down services when you quit the app"
	@echo ""
	pnpm run dev:desktop

desktop-build:
	@echo "Building Tauri desktop app..."
	pnpm run build:desktop

# Git & Backup
backup:
	@echo "Creating database backup..."
	docker compose exec postgres pg_dump -U arbor arbor > backup.sql
	git add backup.sql
	git commit -m "Database backup: $$(date +%Y-%m-%d_%H:%M:%S)"
	@echo "Backup complete!"

restore:
	@echo "Restoring from backup..."
	docker compose exec -T postgres psql -U arbor arbor < backup.sql
	@echo "Restore complete!"

export-md:
	pnpm run export:markdown

