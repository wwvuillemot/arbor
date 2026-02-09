# ─── Arbor MCP Server ─────────────────────────────────────────────────────────

.PHONY: help setup install dev test coverage lint format clean

help: ## Show this help
	@echo "========================================="
	@echo "   Arbor MCP Server"
	@echo "========================================="
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

setup: install ## Initial setup

install: ## Install dependencies
	@echo "📦 Installing dependencies..."
	@cd ../.. && pnpm install

dev: ## Start MCP server (stdio mode)
	@echo "🚀 Starting MCP server..."
	@cd ../.. && npx tsx apps/mcp-server/src/index.ts

test: ## Run MCP unit tests
	@echo "🧪 Running MCP tests..."
	@cd ../.. && pnpm vitest run --project mcp-unit

coverage: ## Run tests with coverage
	@echo "📊 Running MCP tests with coverage..."
	@cd ../.. && rm -rf coverage/mcp-unit
	@cd ../.. && pnpm vitest run --project mcp-unit --coverage

lint: ## Run linter
	@echo "🔍 Running linter..."
	@cd ../.. && pnpm run lint

format: ## Format code
	@echo "✨ Formatting code..."
	@cd ../.. && pnpm run format

clean: ## Clean build artifacts
	@echo "🧹 Cleaning..."
	@rm -rf dist node_modules coverage

