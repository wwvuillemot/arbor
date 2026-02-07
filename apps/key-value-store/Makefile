# Makefile for Key-Value Store (Redis)

.PHONY: help up down restart logs clean test coverage lint format

.DEFAULT_GOAL := help

help:
	@echo "========================================="
	@echo "   Key-Value Store (Redis) Commands"
	@echo "========================================="
	@echo ""
	@echo "  make up         - Start Redis service"
	@echo "  make down       - Stop Redis service"
	@echo "  make restart    - Restart Redis service"
	@echo "  make logs       - View Redis logs"
	@echo "  make clean      - Remove Redis data volume"
	@echo "  make cli        - Open Redis CLI"
	@echo "  make test       - Run tests (N/A for Redis)"
	@echo "  make coverage   - Run coverage (N/A for Redis)"
	@echo "  make lint       - Run linter (N/A for Redis)"
	@echo "  make format     - Format code (N/A for Redis)"
	@echo ""

up:
	@echo "Starting Redis..."
	@docker compose up -d
	@echo "✅ Redis is running at redis.arbor.local:6379"

down:
	@docker compose down

restart: down up

logs:
	@docker compose logs -f redis

clean:
	@docker compose down -v
	@echo "✅ Redis data volume removed"

cli:
	@docker exec -it arbor-redis redis-cli

test:
	@echo "✅ No tests for key-value-store (Redis service only)"

coverage:
	@echo "✅ No coverage for key-value-store (Redis service only)"

lint:
	@echo "✅ No linting for key-value-store (Redis service only)"

format:
	@echo "✅ No formatting for key-value-store (Redis service only)"

