.PHONY: help setup dev build clean up down logs restart migrate migrate-rollback migrate-create seed db-reset test test-unit test-integration test-e2e test-watch test-coverage lint format typecheck audit api-generate api-watch tauri-dev tauri-build tauri-bundle backup restore export-md

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
	@echo "  make build           - Build for production"
	@echo "  make clean           - Clean build artifacts"
	@echo ""
	@echo "Docker:"
	@echo "  make up              - Start Docker services (PostgreSQL, Redis)"
	@echo "  make down            - Stop Docker services"
	@echo "  make logs            - View Docker logs"
	@echo "  make restart         - Restart Docker services"
	@echo ""
	@echo "Database:"
	@echo "  make migrate         - Run database migrations"
	@echo "  make migrate-rollback - Rollback last migration"
	@echo "  make migrate-create  - Create new migration"
	@echo "  make seed            - Seed test data"
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

# Development
setup:
	@./scripts/setup.sh

dev:
	pnpm run dev

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
	docker compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 5

down:
	docker compose down

logs:
	docker compose logs -f

restart:
	make down
	make up

# Database
db-push:
	pnpm run db:push

db-generate:
	pnpm run db:generate

db-studio:
	pnpm run db:studio

seed:
	pnpm run db:seed

db-reset:
	docker compose down -v
	make up
	make db-push
	make seed

# Testing
test:
	pnpm run test

test-unit:
	pnpm run test:unit

test-integration:
	pnpm run test:integration

test-e2e:
	pnpm run test:e2e

test-watch:
	pnpm run test:watch

test-coverage:
	pnpm run test:coverage
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

# Tauri
tauri-dev:
	pnpm run tauri dev

tauri-build:
	pnpm run tauri build

tauri-bundle:
	pnpm run tauri build --bundles all

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

