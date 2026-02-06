# Makefile for Arbor Web App (Next.js)

.PHONY: help setup install dev build start clean test lint

help:
	@echo "========================================="
	@echo "   Arbor Web App (Next.js)"
	@echo "========================================="
	@echo ""
	@echo "Available targets:"
	@echo "  make setup      - Initial setup (install dependencies)"
	@echo "  make install    - Install dependencies"
	@echo "  make dev        - Start development server"
	@echo "  make build      - Build for production"
	@echo "  make start      - Start production server"
	@echo "  make test       - Run tests"
	@echo "  make lint       - Run linter"
	@echo "  make clean      - Clean build artifacts"
	@echo ""

setup: install

install:
	@echo "Installing dependencies for web app..."
	@cd ../.. && pnpm install

dev:
	@echo "Starting Next.js dev server..."
	@pnpm run dev

build:
	@echo "Building Next.js app..."
	@pnpm run build

start:
	@echo "Starting Next.js production server..."
	@pnpm run start

test:
	@echo "Running web app tests..."
	@cd ../.. && pnpm vitest run --project web

lint:
	@echo "Running linter..."
	@pnpm run lint

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf .next
	@rm -rf node_modules

