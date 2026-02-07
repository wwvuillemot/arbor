# Arbor

> A local-first, AI-powered writing assistant for organizing and enhancing your creative writing projects.

## Quick Start

```bash
# One-command setup (installs dependencies, starts services, sets up database)
make setup

# Start development
make dev

# View all available commands
make help
```

## What is Arbor?

Arbor helps you organize multiple writing projects with a flexible, hierarchical structure:

```
Project: "My Fantasy Novel"
├── Folder: "Characters"
│   ├── Note: "Protagonist: Aria"
│   └── Note: "Antagonist: Lord Malachar"
├── Folder: "World Building"
│   └── Note: "Magic System"
└── Folder: "Chapters"
    ├── Note: "Chapter 1: The Awakening"
    └── Note: "Chapter 2: First Lessons"
```

Perfect for:

- 📚 **Novels & Stories** - Organize characters, plots, and chapters
- 🎲 **RPG Campaigns** - Track session notes, NPCs, and locations
- ✍️ **Short Story Collections** - Manage multiple stories and ideas
- 📝 **General Writing** - Any hierarchical note-taking needs

## Features

- **Project-Based Organization**: Top-level projects contain folders and notes
- **Flexible Hierarchy**: Nest folders infinitely to match your workflow
- **Markdown Support**: Write in Markdown with full formatting
- **AI Assistance**: Get writing suggestions and improvements (coming soon)
- **Semantic Search**: Find notes using vector embeddings (coming soon)
- **Local-First**: All data stored locally, no cloud dependency
- **Git Integration**: Built-in backup and versioning

## Development Commands

All development tasks use `make` - never use raw `pnpm` or `npm` commands directly.

### Essential Commands

```bash
make setup          # Initial setup (run once)
make dev            # Start development servers
make up             # Start Docker services
make down           # Stop Docker services
make help           # Show all available commands
```

### Database Commands

```bash
make db-push        # Push schema to database
make db-studio      # Open database GUI
make seed           # Add example projects
make db-reset       # Reset database (⚠️  destroys data)
```

### Testing Commands

```bash
make test           # Run all tests
make test-unit      # Run unit tests
make test-watch     # Run tests in watch mode
make test-coverage  # Generate coverage report
```

### Code Quality

```bash
make lint           # Lint code
make format         # Format code
make typecheck      # Type checking
make audit          # Security audit
```

## Quick Access

Once services are running:

- **pgAdmin**: http://localhost:5050
  - Email: `admin@arbor.dev`
  - Password: `admin`
- **PostgreSQL**: `localhost:5432`
  - User: `arbor`
  - Password: `local_dev_only`
- **Redis**: `localhost:6379`

## Project Structure

```
arbor/
├── src/                    # Next.js frontend
│   ├── app/               # App router pages
│   ├── components/        # React components
│   └── lib/               # Utilities and API client
├── server/                # Backend
│   ├── api/              # API routes
│   ├── db/               # Database schema and migrations
│   └── agents/           # AI agents
├── src-tauri/            # Tauri desktop wrapper
├── tests/                # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docker-compose.yml    # Docker services
├── Makefile              # All development commands
└── package.json          # Dependencies
```

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, TypeScript, Fastify, tRPC
- **Database**: PostgreSQL 16 + pgvector
- **Desktop**: Tauri v2 (Rust)
- **Testing**: Vitest, Playwright
- **ORM**: Drizzle
- **Package Manager**: pnpm 8+

## Documentation

- [Quick Start Guide](app/docs/QUICK_START.md) - Detailed setup instructions
- [Project Summary](app/docs/PROJECT_SUMMARY.md) - Executive overview
- [Full Specification](app/docs/ARBOR_SPEC.md) - Complete technical spec
- [Traefik Setup](TRAEFIK.md) - Local domain configuration

## Development Workflow

1. **Start services**: `make up`
2. **Push database schema**: `make db-push`
3. **Seed example data**: `make seed`
4. **Start development**: `make dev`
5. **Run tests**: `make test`

## Contributing

This project follows Test-Driven Development (TDD):

1. Write tests first
2. Implement features to pass tests
3. Maintain 80%+ code coverage
4. All commands via `make` (never raw pnpm/npm)

## License

MIT

## Support

For issues, questions, or contributions, please see the documentation in `app/docs/`.
