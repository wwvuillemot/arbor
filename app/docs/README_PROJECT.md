# Arbor - Documentation Index

> A local-first, AI-powered writing assistant with node-based architecture, TDD discipline, and Git integration.

## 📖 Documentation Overview

This project includes comprehensive documentation to guide you through design, development, and deployment.

### 🎯 Start Here

1. **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Executive summary and key decisions
   - Quick overview of the entire project
   - Architecture at a glance
   - Key design decisions explained
   - **Read this first!**

2. **[QUICK_START.md](QUICK_START.md)** - Getting started guide
   - Prerequisites and setup
   - Daily development workflow
   - Common commands
   - Troubleshooting
   - **Use this for day-to-day development**

### 📋 Detailed Specifications

1. **[WRITING_AI_ASSISTANT.md](WRITING_AI_ASSISTANT.md)** - Complete 1-pager specification
   - Full technical specification
   - 9 development phases with TDD approach
   - Detailed test examples for each phase
   - Makefile commands reference
   - Testing strategy and CI/CD pipeline
   - Success metrics and timeline
   - **The complete blueprint - 1,400+ lines**

2. **[DATABASE_DECISION.md](DATABASE_DECISION.md)** - Database architecture rationale
   - PostgreSQL vs SQLite comparison
   - Node-based data model explanation
   - JSONB and vector search justification
   - Example queries and performance considerations
   - **Read this to understand the data layer**

## 🏗️ Architecture Highlights

### Node-Based Data Model

```
Single `nodes` table with self-referential hierarchy
├── Folders contain folders (arbitrary nesting)
├── Folders contain notes
├── Notes can link to other notes
└── Flexible JSONB metadata per node type
```

### Tech Stack

- **Frontend**: Next.js 14 + React + TypeScript + Tailwind
- **Backend**: Node.js + TypeScript + tRPC + Fastify
- **Database**: PostgreSQL 16 + pgvector
- **Desktop**: Tauri v2 (Rust wrapper)
- **Testing**: Vitest + Playwright (TDD throughout)
- **Build**: Makefile for consistency

### AI Capabilities

1. **Ask Question** - RAG-based Q&A over your notes
2. **Take Notes** - Text/audio input with auto-organization
3. **Editor** - Style analysis and improvement suggestions

## 🚀 Quick Start

```bash
# One-command setup
make setup

# Start development
make dev

# Run tests (always!)
make test
```

See [QUICK_START.md](QUICK_START.md) for detailed instructions.

## 📅 Development Timeline

**18 weeks (4.5 months) to MVP**

| Phase | Weeks | Focus |
|-------|-------|-------|
| Phase 0 | 1 | Project Setup & Infrastructure |
| Phase 1 | 2 | Core Data Layer (TDD) |
| Phase 2 | 2 | Backend API (tRPC) |
| Phase 3 | 2 | Frontend Foundation |
| Phase 4 | 2 | Vector Search & RAG |
| Phase 5 | 3 | AI Agent Framework |
| Phase 6 | 1 | Provenance & Authorship |
| Phase 7 | 2 | Tauri Desktop Integration |
| Phase 8 | 1 | Git Integration & Backup |
| Phase 9 | 2 | Polish & Performance |

Each phase includes:

- ✅ Detailed task breakdown
- ✅ TDD approach (write tests first!)
- ✅ Comprehensive test examples
- ✅ Clear success criteria
- ✅ Deliverables checklist

## 🎓 Key Principles

1. **TDD Always** - Write tests first, no exceptions (80%+ coverage)
2. **Type Safety** - End-to-end TypeScript with tRPC
3. **Local-First** - No cloud dependency, runs entirely locally
4. **Git-Friendly** - Version control for notes and database
5. **User Control** - AI assists, human authors (no auto-apply)
6. **Provenance** - Track AI vs human content at block level
7. **Simplicity** - Node-based model, avoid complex ERD
8. **Performance** - Fast, scalable, handles 10k+ notes

## 📊 Success Metrics

### Technical

- ✅ 80%+ test coverage
- ✅ API response < 200ms (p95)
- ✅ Search latency < 500ms
- ✅ Bundle size < 10MB
- ✅ Lighthouse score > 95

### User Experience

- ✅ Handles 10k+ notes smoothly
- ✅ Zero data loss
- ✅ Offline-capable
- ✅ WCAG 2.1 AA accessible

## 🛠️ Makefile Commands

```bash
make help            # Show all available commands
make setup           # Initial setup (run once)
make dev             # Start development
make test            # Run all tests
make up              # Start Docker services
make down            # Stop Docker services
make migrate         # Run database migrations
make backup          # Backup database to Git
```

See [WRITING_AI_ASSISTANT.md](WRITING_AI_ASSISTANT.md) for complete Makefile reference.

## 📚 Documentation Structure

```
app/docs/
├── README_PROJECT.md           # This file - documentation index
├── PROJECT_SUMMARY.md          # Executive summary (start here!)
├── QUICK_START.md              # Getting started guide
├── ARBOR_SPEC.md               # Complete specification (1,400+ lines)
└── DATABASE_DECISION.md        # Database architecture rationale
```

## 🎯 Next Steps

1. **Read** [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) for overview
2. **Review** [DATABASE_DECISION.md](DATABASE_DECISION.md) to understand data model
3. **Study** [ARBOR_SPEC.md](ARBOR_SPEC.md) for complete spec
4. **Follow** [QUICK_START.md](QUICK_START.md) to begin development
5. **Start** with Phase 0: Project Setup & Infrastructure

## 💡 Design Decisions Rationale

### Why PostgreSQL over SQLite?

- Native JSONB with GIN indexing (critical for node metadata)
- Mature pgvector for production-ready vector search
- Better recursive CTE optimizer for tree traversal
- Still Git-friendly via pg_dump or JSON export

### Why TypeScript/Node.js over Go?

- Full-stack type safety with tRPC
- Seamless Tauri IPC integration
- Shared types between frontend and backend
- Better AI/ML library ecosystem (LangChain.js)

### Why Node-Based Model?

- Single table, self-referential (simple!)
- Arbitrary taxonomy via parent-child relationships
- Flexible JSONB metadata per node type
- No complex ERD with multiple tables and foreign keys

### Why TDD Throughout?

- Catch bugs early
- Confidence in refactoring
- Living documentation
- Better design (testable code is good code)

## 🔗 Related Resources

- [Tauri v2 Documentation](https://v2.tauri.app)
- [Next.js 14 Documentation](https://nextjs.org/docs)
- [tRPC Documentation](https://trpc.io)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Drizzle ORM Documentation](https://orm.drizzle.team)

---

**Ready to build?** Start with [QUICK_START.md](QUICK_START.md)!
