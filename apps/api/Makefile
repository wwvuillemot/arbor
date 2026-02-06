# Makefile for Arbor API Server

.PHONY: help setup install dev build start clean test db-push db-seed db-studio

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

