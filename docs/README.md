# Arbor

> A local-first, AI-powered writing assistant that helps you track notes, organize knowledge, and improve your writing while maintaining your authorial voice.

## 🚀 Quick Start

```bash
# Initial setup (run once)
make setup

# Start development
make dev

# Run tests
make test
```

## 📖 Documentation

All project documentation is located in the [`docs/`](docs/) directory:

- **[docs/README_PROJECT.md](docs/README_PROJECT.md)** - Start here! Documentation index and navigation guide
- **[docs/PROJECT_SUMMARY.md](docs/PROJECT_SUMMARY.md)** - Executive summary and key decisions
- **[docs/QUICK_START.md](docs/QUICK_START.md)** - Getting started guide and daily workflow
- **[docs/ARBOR_SPEC.md](docs/ARBOR_SPEC.md)** - Complete specification (1,400+ lines)
- **[docs/DATABASE_DECISION.md](docs/DATABASE_DECISION.md)** - Database architecture rationale

## 🏗️ Architecture

- **Frontend**: Next.js 14 + React + TypeScript + Tailwind
- **Backend**: Node.js + TypeScript + tRPC + Fastify
- **Database**: PostgreSQL 16 + pgvector (node-based data model)
- **Desktop**: Tauri v2 (Rust wrapper)
- **Testing**: Vitest + Playwright (TDD throughout)
- **Build**: Makefile for consistency

## 🎯 Key Features

### Node-Based Data Model

- Single `nodes` table with self-referential hierarchy
- Arbitrary taxonomy (folders within folders)
- Flexible JSONB metadata per node type
- Semantic linking between notes

### AI Agent Modes

1. **Ask Question** - RAG-based Q&A over your notes
2. **Take Notes** - Text/audio input with auto-organization
3. **Editor** - Style analysis and improvement suggestions

### Provenance Tracking

- Block-level attribution (AI vs human content)
- Approval workflow for AI suggestions
- Force rewrite mode (AI provides outline, you write prose)
- Learn and match your writing style

### Git Integration

- Auto-commit on save (configurable)
- Export notes as markdown
- Backup and restore via pg_dump
- Version control for all content

## 📅 Development Timeline

**18 weeks (4.5 months) to MVP**

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 0 | 1 week | Project Setup & Infrastructure |
| Phase 1 | 2 weeks | Core Data Layer (TDD) |
| Phase 2 | 2 weeks | Backend API (tRPC) |
| Phase 3 | 2 weeks | Frontend Foundation |
| Phase 4 | 2 weeks | Vector Search & RAG |
| Phase 5 | 3 weeks | AI Agent Framework |
| Phase 6 | 1 week | Provenance & Authorship |
| Phase 7 | 2 weeks | Tauri Desktop Integration |
| Phase 8 | 1 week | Git Integration & Backup |
| Phase 9 | 2 weeks | Polish & Performance |

## 🛠️ Common Commands

```bash
# Development
make dev             # Start dev servers
make build           # Build for production

# Docker
make up              # Start services (PostgreSQL, Redis)
make down            # Stop services

# Database
make migrate         # Run migrations
make seed            # Seed test data

# Testing
make test            # Run all tests
make test-watch      # Watch mode
make test-coverage   # Coverage report

# Code Quality
make lint            # Lint code
make format          # Format code
make typecheck       # Type check

# Backup
make backup          # Backup database to Git
make export-md       # Export notes as markdown
```

Run `make help` to see all available commands.

## 🎓 Development Principles

1. **TDD Always** - Write tests first, no exceptions (80%+ coverage)
2. **Type Safety** - End-to-end TypeScript with tRPC
3. **Local-First** - No cloud dependency, runs entirely locally
4. **Git-Friendly** - Version control for notes and database
5. **User Control** - AI assists, human authors (no auto-apply)
6. **Provenance** - Track AI vs human content at block level
7. **Simplicity** - Node-based model, avoid complex ERD
8. **Performance** - Fast, scalable, handles 10k+ notes

## 📊 Success Metrics

- ✅ 80%+ test coverage
- ✅ API response < 200ms (p95)
- ✅ Search latency < 500ms
- ✅ Bundle size < 10MB
- ✅ Lighthouse score > 95
- ✅ Handles 10k+ notes smoothly
- ✅ WCAG 2.1 AA accessible

## 🔗 Resources

- [Tauri v2 Documentation](https://v2.tauri.app)
- [Next.js 14 Documentation](https://nextjs.org/docs)
- [tRPC Documentation](https://trpc.io)
- [pgvector Documentation](https://github.com/pgvector/pgvector)

## 📝 License

[Your License Here]

---

**Ready to start?** Read [docs/README_PROJECT.md](docs/README_PROJECT.md) for complete documentation!
