# Arbor - Project Summary

## 📋 Overview

A **local-first, AI-powered writing assistant** that helps you:

- Track and organize notes with flexible taxonomy
- Search semantically using RAG/vector search
- Get AI assistance while maintaining your authorial voice
- Track provenance (AI vs human content)
- Backup and version with Git

## 🎯 Key Design Decisions

### 1. Node-Based Data Model ✅

**Single `nodes` table** with self-referential hierarchy:

- Arbitrary taxonomy (folders within folders)
- Flexible JSONB metadata per node type
- No complex ERD - just parent-child relationships
- Simple, scalable, maintainable

### 2. PostgreSQL + pgvector ✅

**Why not SQLite?**

- Native JSONB with GIN indexing (critical for metadata queries)
- Mature vector search (pgvector)
- Better recursive CTE optimizer (tree traversal)
- Still Git-friendly via pg_dump or JSON export

### 3. TypeScript/Node.js Backend ✅

**Why not Go?**

- Full-stack type safety with tRPC
- Seamless Tauri IPC integration
- Shared types between frontend/backend
- Better AI/ML library ecosystem

### 4. TDD Throughout ✅

**Test-Driven Development at every phase:**

- Write tests FIRST (Red)
- Implement minimal code (Green)
- Refactor (Refactor)
- 80%+ test coverage requirement

### 5. Makefile for Consistency ✅

**Standard commands across all environments:**

- `make setup` - One-command initialization
- `make dev` - Start development
- `make test` - Run all tests
- `make up/down` - Docker management

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Tauri Desktop App                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │           Next.js Frontend (React)                │  │
│  │  - Folder tree navigation                         │  │
│  │  - Rich text editor (Lexical/TipTap)              │  │
│  │  - AI chat interface                              │  │
│  └───────────────────────────────────────────────────┘  │
│                          ↕ tRPC                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │        Node.js Backend (TypeScript)               │  │
│  │  - API (tRPC routers)                             │  │
│  │  - AI Agents (Ask, Take Notes, Editor)            │  │
│  │  - RAG Pipeline (embeddings + vector search)      │  │
│  │  - Repositories (data access)                     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↕
        ┌─────────────────────────────────────┐
        │  Docker Compose                     │
        │  ┌──────────────┐  ┌──────────────┐ │
        │  │ PostgreSQL   │  │    Redis     │ │
        │  │ + pgvector   │  │   (cache)    │ │
        │  └──────────────┘  └──────────────┘ │
        └─────────────────────────────────────┘
```

## 📊 Node-Based Data Model

```sql
CREATE TABLE nodes (
  id UUID PRIMARY KEY,
  parent_id UUID REFERENCES nodes(id),  -- Self-referential!
  type VARCHAR(50),                      -- 'folder', 'note', 'link', etc.
  name VARCHAR(255),
  content TEXT,                          -- Markdown for notes
  metadata JSONB,                        -- Flexible schema per type
  author_type VARCHAR(20),               -- 'human', 'ai', 'mixed'
  embedding VECTOR(1536),                -- For semantic search
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ                 -- Soft delete
);
```

**Example Metadata by Type:**

- `folder`: `{}`
- `note`: `{"tags": ["writing"], "word_count": 1500}`
- `link`: `{"source_id": "...", "target_id": "...", "link_type": "references"}`
- `ai_suggestion`: `{"original": "...", "suggested": "...", "status": "pending"}`

## 🤖 AI Agent Modes

### 1. Ask Question

- RAG-based Q&A over your notes
- Semantic search for relevant context
- Cited sources

### 2. Take Notes

- Text or audio input (Whisper transcription)
- Extract key points, structure thoughts
- Auto-update related existing notes
- Suggest links and tags

### 3. Editor

- Analyze your writing style
- Suggest improvements (clarity, tone, grammar)
- **Never auto-applies** - you must manually rewrite
- Learn and match your voice over time

## 🔒 Provenance & Authorship

- **Block-level tracking**: Know what's AI vs human
- **Approval workflow**: AI suggestions require explicit acceptance
- **Force rewrite mode**: AI provides outline, you write prose
- **Visual indicators**: Badges/highlighting for AI content
- **Metrics**: Track acceptance/rejection rates

## 📅 Development Timeline

**18 weeks (4.5 months) to MVP**

| Phase              | Duration | Focus                                 |
| ------------------ | -------- | ------------------------------------- |
| 0: Setup           | 1 week   | Infrastructure, Docker, Makefile      |
| 1: Data Layer      | 2 weeks  | Node repository, tree traversal (TDD) |
| 2: Backend API     | 2 weeks  | tRPC, validation, error handling      |
| 3: Frontend        | 2 weeks  | Next.js, folder tree, editor          |
| 4: Vector Search   | 2 weeks  | Embeddings, RAG, hybrid search        |
| 5: AI Agents       | 3 weeks  | Ask, Take Notes, Editor modes         |
| 6: Provenance      | 1 week   | Attribution, approval workflow        |
| 7: Tauri           | 2 weeks  | Desktop app, native integration       |
| 8: Git Integration | 1 week   | Auto-commit, backup, restore          |
| 9: Polish          | 2 weeks  | Performance, UX, accessibility        |

## 📚 Documentation

- **`ARBOR_SPEC.md`** - Complete specification with all phases
- **`DATABASE_DECISION.md`** - PostgreSQL vs SQLite comparison
- **`QUICK_START.md`** - Getting started guide
- **`PROJECT_SUMMARY.md`** - This file

## 🚀 Getting Started

```bash
# Initial setup
make setup

# Start development
make dev

# Run tests (always!)
make test
```

## ✅ Success Criteria

### Technical

- 80%+ test coverage
- API response < 200ms (p95)
- Search latency < 500ms
- Bundle size < 10MB
- Lighthouse score > 95

### User Experience

- Handles 10k+ notes smoothly
- Zero data loss
- Offline-capable
- WCAG 2.1 AA accessible

### AI Quality

- RAG accuracy > 90%
- Search relevance > 85%
- Transcription accuracy > 95%
- Style matching > 80%

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind, shadcn/ui
- **Backend**: Node.js, TypeScript, Fastify, tRPC
- **Database**: PostgreSQL 16 + pgvector
- **Cache**: Redis
- **Desktop**: Tauri v2 (Rust)
- **Testing**: Vitest, Playwright
- **ORM**: Drizzle
- **AI**: OpenAI/Claude APIs, LangChain.js
- **Build**: Makefile, pnpm

## 🎓 Key Principles

1. **TDD Always** - Write tests first, no exceptions
2. **Type Safety** - End-to-end TypeScript
3. **Local-First** - No cloud dependency
4. **Git-Friendly** - Version everything
5. **User Control** - AI assists, human authors
6. **Provenance** - Track what's AI vs human
7. **Simplicity** - Node-based model, no complex ERD
8. **Performance** - Fast, scalable, efficient

---

**Next Steps**: Read `QUICK_START.md` to begin development!
