.PHONY: help setup build clean up down logs restart health db-migrate db-push db-generate db-studio seed db-reset test test-unit test-integration test-e2e test-watch test-coverage coverage lint format typecheck audit preflight api-generate api-watch desktop desktop-build backup restore export-md

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
	@echo "  make up              - Start all services (Web, API, PostgreSQL, Redis, pgAdmin)"
	@echo "  make down            - Stop all services"
	@echo "  make restart         - Restart all services"
	@echo "  make desktop         - Start Tauri desktop app (manages services automatically)"
	@echo "  make build           - Build for production"
	@echo "  make desktop-build   - Build Tauri desktop app"
	@echo "  make clean           - Clean build artifacts"
	@echo ""
	@echo "Docker:"
	@echo "  make logs            - View Docker logs"
	@echo "  make restart         - Restart Docker services"
	@echo "  make health          - Check service health and readiness"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate      - Run pending database migrations (RECOMMENDED)"
	@echo "  make db-generate     - Generate migration files from schema changes"
	@echo "  make db-push         - Push schema directly (⚠️  can lose data, use db-migrate instead)"
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
	@echo "  make coverage        - Generate coverage report (delegates to apps)"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint            - Lint code (delegates to apps)"
	@echo "  make format          - Format code with auto-fix (delegates to apps)"
	@echo "  make typecheck       - Run TypeScript type checking"
	@echo "  make audit           - Security audit (pnpm audit)"
	@echo "  make preflight       - Run format, lint, test, and coverage (CI-ready)"
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
	@make banner
	@echo "========================================="
	@echo "   Starting Services"
	@echo "========================================="
	@echo ""
	@echo "Stopping any existing containers..."
	@docker compose -f apps/api/docker-compose.yml -f apps/key-value-store/docker-compose.yml down --remove-orphans 2>/dev/null || true
	@echo "Starting Docker services (postgres, redis, minio, pgadmin, proxies)..."
	@docker compose -f apps/api/docker-compose.yml -f apps/key-value-store/docker-compose.yml -f tmp/traefik/local/arbor-docker-compose.traefik.yml up -d
	@echo "Waiting for services to be ready..."
	@sleep 5
	@echo ""
	@echo "Running database migrations..."
	@pnpm run db:migrate 2>/dev/null || echo "⚠️  Migrations failed (may already be applied)"
	@echo ""
	@echo "Seeding database (idempotent)..."
	@pnpm run db:seed 2>/dev/null || echo "⚠️  Seeding skipped (data may already exist)"
	@echo ""
	@echo "Starting API server on host..."
	@$(MAKE) -C apps/api up
	@echo ""
	@echo "Starting web app on host..."
	@$(MAKE) -C apps/web up
	@echo ""
	@echo "Verifying HTTP endpoints..."
	@for i in 1 2 3 4 5; do \
		curl -s -o /dev/null -w "" http://api.arbor.local/health 2>/dev/null && echo "  ✅ API Server: http://api.arbor.local/health (HTTP 200)" && break || \
		([ $$i -eq 5 ] && echo "  ❌ API Server: http://api.arbor.local/health (not responding)" || sleep 2); \
	done
	@for i in 1 2 3 4 5; do \
		curl -s -o /dev/null -w "" http://app.arbor.local 2>/dev/null && echo "  ✅ Web App: http://app.arbor.local (HTTP 200)" && break || \
		([ $$i -eq 5 ] && echo "  ❌ Web App: http://app.arbor.local (not responding)" || sleep 2); \
	done
	@echo ""
	@echo "========================================="
	@echo "   ✅ Arbor is ready!"
	@echo "========================================="
	@echo ""
	@echo "Docker Services:"
	@docker ps --filter "name=arbor-" --format "  • {{.Names}}: {{.Status}}"
	@echo ""
	@echo "Local Services:"
	@[ -f /tmp/arbor-api.pid ] && echo "  • API Server: Running (PID $$(cat /tmp/arbor-api.pid))" || echo "  • API Server: Not running"
	@[ -f /tmp/arbor-web.pid ] && echo "  • Web App: Running (PID $$(cat /tmp/arbor-web.pid))" || echo "  • Web App: Not running"
	@echo ""
	@echo "Quick Access:"
	@echo "  Web App:             http://app.arbor.local"
	@echo "  API Server:          http://api.arbor.local"
	@echo "  pgAdmin (Traefik):   http://pgadmin.arbor.local"
	@echo "  Redis:               redis.arbor.local:6379"
	@echo "  PostgreSQL:          localhost:5432"
	@echo ""
	@echo "Logs:"
	@echo "  API:  tail -f /tmp/arbor-api.log"
	@echo "  Web:  tail -f /tmp/arbor-web.log"
	@echo ""

down:
	@echo "Stopping local services..."
	@$(MAKE) -C apps/api down
	@$(MAKE) -C apps/web down
	@echo "Stopping Docker services..."
	@docker compose -f apps/api/docker-compose.yml -f apps/key-value-store/docker-compose.yml down --remove-orphans

logs:
	@docker compose -f apps/api/docker-compose.yml -f apps/key-value-store/docker-compose.yml logs -f

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
	@echo "Local Services:"
	@[ -f /tmp/arbor-api.pid ] && echo "  ✅ API Server: Running (PID $$(cat /tmp/arbor-api.pid))" || echo "  ❌ API Server: Not running"
	@[ -f /tmp/arbor-web.pid ] && echo "  ✅ Web App: Running (PID $$(cat /tmp/arbor-web.pid))" || echo "  ❌ Web App: Not running"
	@echo ""
	@echo "Service Connectivity:"
	@docker exec arbor-postgres pg_isready -U arbor > /dev/null 2>&1 && echo "  ✅ PostgreSQL: Ready" || echo "  ❌ PostgreSQL: Not ready"
	@docker exec arbor-redis redis-cli ping > /dev/null 2>&1 && echo "  ✅ Redis: Ready" || echo "  ❌ Redis: Not ready"
	@echo ""
	@echo "HTTP Endpoints:"
	@curl -s -o /dev/null -w "" http://app.arbor.local 2>/dev/null && echo "  ✅ Web App: http://app.arbor.local (HTTP 200)" || echo "  ❌ Web App: http://app.arbor.local (not responding)"
	@curl -s -o /dev/null -w "" http://api.arbor.local/health 2>/dev/null && echo "  ✅ API Server: http://api.arbor.local/health (HTTP 200)" || echo "  ❌ API Server: http://api.arbor.local/health (not responding)"
	@curl -s -o /dev/null -w "" http://pgadmin.arbor.local 2>/dev/null && echo "  ✅ pgAdmin: http://pgadmin.arbor.local (HTTP 200)" || echo "  ⚠️  pgAdmin: Not accessible via Traefik"
	@echo ""
	@echo "Database Schema:"
	@docker exec arbor-postgres psql -U arbor -d arbor_dev -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'nodes';" 2>/dev/null | grep -q "1" && echo "  ✅ Migrations applied (nodes table exists)" || echo "  ⚠️  Migrations not applied yet (run: make db-migrate)"
	@echo ""
	@echo "Quick Access:"
	@echo "  Web App:             http://app.arbor.local"
	@echo "  API Server:          http://api.arbor.local"
	@echo "  pgAdmin:             http://pgadmin.arbor.local"
	@echo "  PostgreSQL:          postgres:5432 (via Docker network)"
	@echo "  Redis:               redis:6379 (via Docker network)"
	@echo ""
	@echo "Credentials:"
	@echo "  pgAdmin:             admin@arbor.dev / admin"
	@echo "  PostgreSQL:          arbor / local_dev_only"
	@echo ""

# Database
db-migrate:
	@echo "Running database migrations..."
	@pnpm run db:migrate

db-generate:
	@echo "Generating migration from schema changes..."
	@pnpm run db:generate
	@echo ""
	@echo "⚠️  IMPORTANT: Review the generated migration in apps/api/src/db/migrations/"
	@echo "   Then run: make db-migrate"

db-push:
	@echo "⚠️  WARNING: db:push can cause data loss. Use 'make db-migrate' instead."
	@echo "   Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	@pnpm run db:push

db-studio:
	@pnpm run db:studio

seed:
	@pnpm run db:seed

db-reset:
	@echo "⚠️  WARNING: This will DELETE ALL DATA!"
	@echo "   Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	@docker compose -f apps/key-value-store/docker-compose.yml -f apps/api/docker-compose.yml -f apps/web/docker-compose.yml down -v
	@make up
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
	@echo "========================================="
	@echo "   Running Tests with Coverage"
	@echo "========================================="
	@echo ""
	@echo "📊 Unit Tests (Target: 80% line/branch)..."
	@pnpm run test:coverage:unit
	@echo ""
	@echo "📊 Integration Tests (Target: 50% line/branch)..."
	@pnpm run test:coverage:integration
	@echo ""
	@echo "========================================="
	@echo "   ✅ Coverage reports generated!"
	@echo "========================================="
	@echo ""
	@echo "Coverage reports:"
	@echo "  API Unit:        ./coverage/api-unit/index.html"
	@echo "  API Integration: ./coverage/api-integration/index.html"
	@echo "  Web Unit:        ./apps/web/coverage/index.html"
	@echo "  Web Integration: ./apps/web/coverage-integration/index.html"
	@echo ""

test-coverage-unit:
	@echo "Running unit tests with coverage..."
	@pnpm run test:coverage:unit

test-coverage-integration:
	@echo "Running integration tests with coverage..."
	@pnpm run test:coverage:integration

# Coverage (delegates to each app)
coverage:
	@echo "========================================="
	@echo "   Running Coverage for All Apps"
	@echo "========================================="
	@echo ""
	@echo "📦 Key-Value Store Coverage..."
	@cd apps/key-value-store && $(MAKE) coverage
	@echo ""
	@echo "🔧 API Coverage..."
	@cd apps/api && $(MAKE) coverage
	@echo ""
	@echo "🌐 Web Coverage..."
	@cd apps/web && $(MAKE) coverage
	@echo ""
	@echo "========================================="
	@echo "   ✅ Coverage complete!"
	@echo "========================================="
	@echo ""
	@echo "Coverage reports:"
	@echo "  API:  ./coverage/api-unit/index.html"
	@echo "  Web:  ./apps/web/coverage/index.html"
	@echo ""

# Code Quality
lint:
	@echo "========================================="
	@echo "   Running Linters for All Apps"
	@echo "========================================="
	@echo ""
	@echo "📦 Key-Value Store Lint..."
	@cd apps/key-value-store && $(MAKE) lint
	@echo ""
	@echo "🔧 API Lint..."
	@cd apps/api && $(MAKE) lint
	@echo ""
	@echo "🌐 Web Lint..."
	@cd apps/web && $(MAKE) lint
	@echo ""
	@echo "========================================="
	@echo "   ✅ Linting complete!"
	@echo "========================================="

format:
	@echo "========================================="
	@echo "   Formatting Code for All Apps"
	@echo "========================================="
	@echo ""
	@echo "📦 Key-Value Store Format..."
	@cd apps/key-value-store && $(MAKE) format
	@echo ""
	@echo "🔧 API Format..."
	@cd apps/api && $(MAKE) format
	@echo ""
	@echo "🌐 Web Format..."
	@cd apps/web && $(MAKE) format
	@echo ""
	@echo "========================================="
	@echo "   ✅ Formatting complete!"
	@echo "========================================="

typecheck:
	pnpm run typecheck

audit:
	pnpm audit

# Preflight - Run all quality checks before commit/push
preflight:
	@make banner
	@echo "========================================="
	@echo "   🚀 Running Preflight Checks"
	@echo "========================================="
	@echo ""
	@echo "Step 1/4: Formatting code..."
	@$(MAKE) format
	@echo ""
	@echo "Step 2/4: Linting code..."
	@$(MAKE) lint
	@echo ""
	@echo "Step 3/4: Running tests..."
	@$(MAKE) test
	@echo ""
	@echo "Step 4/4: Generating coverage..."
	@$(MAKE) coverage
	@echo ""
	@echo "========================================="
	@echo "   ✅ Preflight Complete - Ready to Commit!"
	@echo "========================================="

banner: 
	@echo "   █████████   ███████████   ███████████     ███████    ███████████  "
	@echo "  ███░░░░░███ ░░███░░░░░███ ░░███░░░░░███  ███░░░░░███ ░░███░░░░░███ "
	@echo " ░███    ░███  ░███    ░███  ░███    ░███ ███     ░░███ ░███    ░███ "
	@echo " ░███████████  ░██████████   ░██████████ ░███      ░███ ░██████████  "
	@echo " ░███░░░░░███  ░███░░░░░███  ░███░░░░░███░███      ░███ ░███░░░░░███ "
	@echo " ░███    ░███  ░███    ░███  ░███    ░███░░███     ███  ░███    ░███ "
	@echo " █████   █████ █████   █████ ███████████  ░░░███████░   █████   █████"
	@echo "░░░░░   ░░░░░ ░░░░░   ░░░░░ ░░░░░░░░░░░     ░░░░░░░    ░░░░░   ░░░░░ "
                                                                     
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
	@echo "  1. Start Docker services (Web, API, PostgreSQL, Redis)"
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

