# Arbor - Quick Start Guide

## Prerequisites

- **Node.js**: 20+
- **pnpm**: 8+
- **Docker**: Latest version
- **Git**: Latest version
- **Rust**: Latest (for Tauri)

## Initial Setup (First Time Only)

```bash
# Clone the repository
git clone <repo-url>
cd arbor

# Run complete setup (installs deps, starts Docker, runs migrations)
make setup

# Start development
make dev
```

That's it! The app should now be running at `http://localhost:3000`

## Daily Development Workflow

```bash
# Start your day
make up              # Start Docker services (PostgreSQL, Redis)
make dev             # Start development servers

# During development
make test-watch      # Run tests in watch mode (in another terminal)

# Before committing
make lint            # Lint code
make format          # Format code
make typecheck       # Check TypeScript types
make test            # Run all tests

# End of day
make down            # Stop Docker services
```

## Common Commands

### Development

```bash
make dev             # Start dev servers (frontend + backend)
make build           # Build for production
make clean           # Clean build artifacts
```

### Docker

```bash
make up              # Start services
make down            # Stop services
make logs            # View logs
make restart         # Restart services
```

### Database

```bash
make migrate         # Run migrations
make migrate-create  # Create new migration
make seed            # Seed test data
make db-reset        # Reset database (⚠️  destroys data)
```

### Testing

```bash
make test            # Run all tests
make test-unit       # Unit tests only
make test-integration # Integration tests only
make test-e2e        # E2E tests only
make test-watch      # Watch mode
make test-coverage   # Generate coverage report
```

### Code Quality

```bash
make lint            # Lint code
make format          # Format code
make typecheck       # Type check
make audit           # Security audit
```

### Tauri (Desktop App)

```bash
make tauri-dev       # Run Tauri in dev mode
make tauri-build     # Build desktop app
make tauri-bundle    # Create installers
```

### Backup & Git

```bash
make backup          # Backup database to Git
make restore         # Restore from backup
make export-md       # Export notes as markdown
```

## Project Structure

```
arbor/
├── src/                    # Next.js frontend
│   ├── app/                # App router pages
│   ├── components/         # React components
│   ├── lib/                # Utilities, tRPC client
│   └── styles/             # Tailwind CSS
├── server/                 # Node.js backend
│   ├── api/                # tRPC routers
│   ├── agents/             # AI agents
│   ├── db/                 # Database (Drizzle ORM)
│   ├── repositories/       # Data access layer
│   └── services/           # Business logic
├── src-tauri/              # Tauri (Rust)
├── tests/                  # Tests
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── e2e/                # E2E tests (Playwright)
├── docker-compose.yml      # Docker services
├── Makefile                # Build commands
└── package.json            # Dependencies
```

## Environment Variables

Create a `.env.local` file:

```bash
# Database
DATABASE_URL=postgresql://arbor:local_dev_only@localhost:5432/arbor

# Redis
REDIS_URL=redis://localhost:6379

# OpenAI (required for AI features)
OPENAI_API_KEY=sk-...

# Optional: Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Local LLM (Ollama)
OLLAMA_BASE_URL=http://localhost:11434
```

## Troubleshooting

### Docker services won't start

```bash
make down
docker system prune -a
make up
```

### Database migration issues

```bash
make db-reset  # ⚠️  This will delete all data!
```

### Tests failing

```bash
# Make sure services are running
make up

# Reset test database
make db-reset

# Run tests
make test
```

### Port conflicts

Check if ports are already in use:

- `3000` - Frontend
- `3001` - Backend
- `5432` - PostgreSQL
- `6379` - Redis

```bash
# Kill processes on port
lsof -ti:3000 | xargs kill -9
```

## TDD Workflow

1. **Write a failing test** (RED)

   ```bash
   # Create test file
   touch tests/unit/my-feature.test.ts

   # Write test
   # Run: make test-watch
   ```

2. **Write minimal code to pass** (GREEN)

   ```bash
   # Implement feature
   # Watch tests pass
   ```

3. **Refactor** (REFACTOR)

   ```bash
   # Improve code
   # Ensure tests still pass
   ```

4. **Commit**

   ```bash
   make lint
   make test
   git add .
   git commit -m "feat: add my feature"
   ```

## Next Steps

1. Read the full specification: `WRITING_AI_ASSISTANT.md`
2. Review database decisions: `DATABASE_DECISION.md`
3. Start with Phase 0: Project Setup
4. Follow TDD discipline for all phases

## Getting Help

```bash
make help            # Show all available commands
```

---

**Remember**: Always run tests before committing! Use `make test` to ensure everything works.
