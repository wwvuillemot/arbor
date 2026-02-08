# Makefile for Arbor Web App (Next.js)

.PHONY: help setup install dev build start clean test lint format coverage up down restart

help:
	@echo "========================================="
	@echo "   Arbor Web App (Next.js)"
	@echo "========================================="
	@echo ""
	@echo "Available targets:"
	@echo "  make setup      - Initial setup (install dependencies)"
	@echo "  make install    - Install dependencies"
	@echo "  make up         - Start web app on host (background)"
	@echo "  make down       - Stop web app"
	@echo "  make restart    - Restart web app"
	@echo "  make dev        - Start development server (with Turbopack)"
	@echo "  make build      - Build for production"
	@echo "  make start      - Start production server"
	@echo "  make test       - Run tests"
	@echo "  make coverage   - Run tests with coverage"
	@echo "  make lint       - Run linter"
	@echo "  make format     - Format code (auto-fix)"
	@echo "  make clean      - Clean build artifacts"
	@echo ""

setup: install

install:
	@echo "Installing dependencies for web app..."
	@cd ../.. && pnpm install

up:
	@echo "Starting web app on host..."
	@bash -c "cd ../.. && nohup pnpm run dev > /tmp/arbor-web.log 2>&1 & echo \$$! > /tmp/arbor-web.pid"
	@sleep 5
	@echo "✅ Web app started at http://localhost:3847"
	@echo "   Logs: tail -f /tmp/arbor-web.log"

down:
	@echo "Stopping web app..."
	@if [ -f /tmp/arbor-web.pid ]; then kill $$(cat /tmp/arbor-web.pid) 2>/dev/null || true; rm /tmp/arbor-web.pid; fi
	@pkill -f "next dev --turbo --port 3847" 2>/dev/null || true
	@echo "✅ Web app stopped"

restart: down up

dev:
	@echo "Starting Next.js dev server with Turbopack..."
	@cd ../.. && pnpm run dev

build:
	@echo "Building Next.js app..."
	@pnpm run build

start:
	@echo "Starting Next.js production server..."
	@pnpm run start

test:
	@echo "Running web app tests..."
	@cd ../.. && pnpm vitest run --project web

coverage:
	@echo "Skipping web app coverage (included in API integration tests)..."
	@echo "✅ Web coverage skipped"

lint:
	@echo "Running linter..."
	@cd ../.. && pnpm run lint

format:
	@echo "Formatting code..."
	@cd ../.. && pnpm run format

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf .next
	@rm -rf node_modules
	@rm -rf coverage

