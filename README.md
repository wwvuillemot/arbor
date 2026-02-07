# Arbor

> A local-first, AI-powered writing assistant with hierarchical node-based organization.

## Quick Start

```bash
# Initial setup (run once)
make setup

# Start development
make dev

# Run all quality checks (format → lint → test → coverage)
make preflight

# View all commands
make help
```

## What is Arbor?

Arbor organizes writing projects with a flexible, hierarchical structure:

```
Project → Folder → Folder (nested) → Note/File
```

Perfect for novels, RPG campaigns, story collections, and general writing.

## Key Features

- **Node-based data model**: Single `nodes` table with self-referential hierarchy
- **Local-first**: All data stored locally, no cloud dependency
- **Desktop app**: Tauri v2 wrapper manages services automatically
- **AI-powered**: Writing assistance and semantic search (coming soon)
- **Type-safe**: End-to-end TypeScript with tRPC

## Essential Commands

```bash
# Development
make dev            # Start all services
make desktop        # Run desktop app

# Database
make db-push        # Push schema changes
make db-studio      # Open Drizzle Studio
make seed           # Add example data

# Quality
make preflight      # Run format → lint → test → coverage
make test           # Run all tests
make coverage       # Generate coverage report

# Services
make up             # Start Docker services
make down           # Stop Docker services
```

Run `make help` for all available commands.

## Project Structure

```
arbor/
├── apps/
│   ├── api/                # Backend (Fastify + tRPC)
│   ├── desktop/            # Tauri desktop app
│   ├── key-value-store/    # Redis service
│   └── web/                # Next.js frontend
├── docs/                   # Documentation
├── tests/                  # Root-level tests
├── Makefile                # All commands
└── package.json            # Root dependencies
```

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Fastify, tRPC, Node.js 20+
- **Database**: PostgreSQL 16 + pgvector, Drizzle ORM
- **Cache**: Redis 7
- **Desktop**: Tauri v2 (Rust)
- **Testing**: Vitest, Testing Library
- **Package Manager**: pnpm 9+

## Documentation

See [`docs/README.md`](docs/README.md) for links to app-specific documentation.

## Development Principles

- **TDD**: Write tests first, maintain high coverage
- **Makefile-driven**: All commands via `make`, never raw pnpm/npm
- **Type-safe**: End-to-end TypeScript with tRPC
- **Monorepo**: Apps isolated under `apps/` with shared packages

## License

MIT
