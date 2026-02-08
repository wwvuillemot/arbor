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

up:
	@echo "Starting API server on host..."
	@bash -c "cd ../.. && nohup pnpm run dev:api > /tmp/arbor-api.log 2>&1 & echo \$$! > /tmp/arbor-api.pid"
	@sleep 3
	@echo "✅ API server started at http://localhost:3848"
	@echo "   Logs: tail -f /tmp/arbor-api.log"

down:
	@echo "Stopping API server..."
	@if [ -f /tmp/arbor-api.pid ]; then kill $$(cat /tmp/arbor-api.pid) 2>/dev/null || true; rm /tmp/arbor-api.pid; fi
	@pkill -f "pnpm run dev:api" 2>/dev/null || true
	@echo "✅ API server stopped"

restart: down up

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
	@echo "Running API tests locally..."
	@cd ../.. && pnpm run test:unit

coverage:
	@echo "Running API tests with coverage locally..."
	@cd ../.. && rm -rf coverage/api-unit
	@cd ../.. && pnpm run test:unit --coverage

lint:
	@echo "Running linter..."
	@cd ../.. && pnpm run lint || echo "⚠️  No lint script configured"

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

