# Makefile for Arbor Web App (Next.js)

.PHONY: help setup install dev build start clean test lint format coverage

help:
	@echo "========================================="
	@echo "   Arbor Web App (Next.js)"
	@echo "========================================="
	@echo ""
	@echo "Available targets:"
	@echo "  make setup      - Initial setup (install dependencies)"
	@echo "  make install    - Install dependencies"
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
	@echo "Running web app tests with coverage..."
	@cd ../.. && pnpm vitest run --project web --coverage

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

