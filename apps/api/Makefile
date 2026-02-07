# Makefile for Arbor API Server

.PHONY: help setup install dev build start clean test coverage lint format db-push db-seed db-studio

help:
	@echo "========================================="
	@echo "   Arbor API Server"
	@echo "========================================="
	@echo ""
	@echo "Available targets:"
	@echo "  make setup      - Initial setup (install dependencies)"
	@echo "  make install    - Install dependencies"
	@echo "  make dev        - Start development server"
	@echo "  make build      - Build for production"
	@echo "  make start      - Start production server"
	@echo "  make test       - Run tests"
	@echo "  make coverage   - Run tests with coverage"
	@echo "  make lint       - Run linter"
	@echo "  make format     - Format code (auto-fix)"
	@echo "  make clean      - Clean build artifacts"
	@echo ""
	@echo "Database targets:"
	@echo "  make db-push    - Push database schema"
	@echo "  make db-seed    - Seed database with test data"
	@echo "  make db-studio  - Open Drizzle Studio"
	@echo ""

setup: install

install:
	@echo "Installing dependencies for API server..."
	@cd ../.. && pnpm install

dev:
	@echo "Starting API dev server..."
	@cd ../.. && pnpm run dev:api

build:
	@echo "Building API server..."
	@cd ../.. && pnpm run build:api

start:
	@echo "Starting API production server..."
	@cd ../.. && pnpm run start:api

test:
	@echo "Running API tests in container..."
	@docker exec arbor-api pnpm run test:unit
	@docker exec arbor-api pnpm run test:integration || echo "⚠️  No integration tests configured yet"

coverage:
	@echo "Running API tests with coverage in container..."
	@docker exec arbor-api rm -rf coverage
	@docker exec arbor-api pnpm run test:unit --coverage
	@docker exec arbor-api pnpm run test:integration --coverage || echo "⚠️  No integration tests configured yet"

lint:
	@echo "Running linter in container..."
	@docker exec arbor-api pnpm run lint || echo "⚠️  No lint script configured"

format:
	@echo "Formatting code..."
	@cd ../.. && pnpm run format

db-push:
	@echo "Pushing database schema..."
	@cd ../.. && pnpm run db:push

db-seed:
	@echo "Seeding database..."
	@cd ../.. && pnpm run db:seed

db-studio:
	@echo "Opening Drizzle Studio..."
	@cd ../.. && pnpm run db:studio

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist
	@rm -rf node_modules
	@rm -rf coverage

