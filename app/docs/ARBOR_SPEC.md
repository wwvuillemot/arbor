# Arbor - Project Specification

## Overview

**Arbor** is a local-first, AI-powered writing assistant that helps track notes, organize knowledge, and improve writing while maintaining authorial voice and provenance tracking.

## Executive Summary

**Architecture**: Node-based, semi-structured data model with single `nodes` table
**Database**: PostgreSQL 16+ with pgvector (JSONB + vector search)
**Frontend**: Next.js 14+ (React, TypeScript, Tailwind)
**Backend**: Node.js + TypeScript (Fastify/Express + tRPC)
**Desktop**: Tauri v2 (Rust wrapper)
**Development**: TDD approach with comprehensive testing at each phase
**Build System**: Makefile for consistent development workflow

## Tech Stack

### Desktop Application

- **Framework**: [Tauri v2](https://v2.tauri.app) - Rust-based desktop wrapper
- **Rationale**: Tauri provides native desktop experience, smaller bundle size (~3MB vs Electron's ~50MB), better security, and excellent performance

### Frontend

- **Framework**: Next.js 14+ (App Router)
- **UI Library**: React 18+
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand or Jotai
- **Rich Text Editor**:
  - Lexical (Meta) or TipTap (ProseMirror-based)
  - Support for markdown, semantic links, and AI suggestions
- **Audio Input**: Web Speech API or Whisper.js for voice-to-text

### Backend

- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Fastify or Express
- **API Layer**: tRPC (type-safe API) or REST
- **Rationale**: TypeScript/Node.js works well with Tauri (vs Go which would require separate compilation)

### Persistence Layer

- **Primary Database**: PostgreSQL 16+ (via Docker)
  - Native JSONB support with GIN indexing
  - pgvector extension for vector similarity search
  - Excellent for semi-structured, node-based data model
  - Git-friendly via pg_dump or JSON export
  - Alternative: SQLite if you prefer single-file simplicity
- **Cache Layer**: Redis (optional)
  - Use for session management, rate limiting
  - Can run in Docker alongside app
- **File Storage**: Local filesystem for attachments/media

### Data Model: Node-Based Architecture

**Philosophy**: Single `nodes` table with self-referential hierarchy, avoiding complex ERD

```sql
CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'folder', 'note', 'attachment', etc.
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255), -- URL-friendly identifier
  content TEXT, -- Markdown content for notes
  metadata JSONB DEFAULT '{}', -- Flexible schema per type
  author_type VARCHAR(20) DEFAULT 'human', -- 'human', 'ai', 'mixed'
  embedding VECTOR(1536), -- For semantic search (OpenAI ada-002)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete
);

CREATE INDEX idx_nodes_parent ON nodes(parent_id);
CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_metadata ON nodes USING GIN(metadata);
CREATE INDEX idx_nodes_embedding ON nodes USING ivfflat(embedding vector_cosine_ops);
CREATE INDEX idx_nodes_slug ON nodes(slug);
```

**Example Node Types & Metadata**:

- `folder`: `{}`
- `note`: `{"tags": ["writing", "ideas"], "word_count": 1500, "reading_time": 6}`
- `link`: `{"source_id": "uuid", "target_id": "uuid", "link_type": "references"}`
- `ai_suggestion`: `{"original_text": "...", "suggested_text": "...", "status": "pending"}`
- `audio_note`: `{"duration": 120, "transcription_id": "uuid", "audio_url": "/files/..."}`

**Key Queries**:

```sql
-- Get all children of a folder (one level)
SELECT * FROM nodes WHERE parent_id = $1 AND deleted_at IS NULL;

-- Get full path to a node (recursive CTE)
WITH RECURSIVE path AS (
  SELECT id, parent_id, name, 0 AS depth
  FROM nodes WHERE id = $1
  UNION ALL
  SELECT n.id, n.parent_id, n.name, p.depth + 1
  FROM nodes n JOIN path p ON n.id = p.parent_id
)
SELECT array_agg(name ORDER BY depth DESC) AS breadcrumb FROM path;

-- Get entire subtree (all descendants)
WITH RECURSIVE tree AS (
  SELECT * FROM nodes WHERE id = $1
  UNION ALL
  SELECT n.* FROM nodes n JOIN tree t ON n.parent_id = t.id
)
SELECT * FROM tree WHERE deleted_at IS NULL;

-- Semantic search with metadata filters
SELECT id, name, content,
       1 - (embedding <=> $1::vector) AS similarity
FROM nodes
WHERE type = 'note'
  AND metadata @> '{"tags": ["writing"]}'
  AND deleted_at IS NULL
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

### AI/ML Components

- **LLM Integration**:
  - OpenAI API (GPT-4, GPT-4-turbo)
  - Anthropic Claude API
  - Local LLM option: Ollama integration
- **Embeddings**:
  - OpenAI text-embedding-3-small/large
  - Alternative: Local embeddings via transformers.js
- **Vector Search**: RAG pipeline for semantic search across notes
- **Agent Framework**: LangChain.js or custom agent implementation

## Core Features

### 1. Note Management

- **Hierarchical Folders**: Organize notes in nested folder structure
- **Semantic Linking**:
  - Bidirectional links between notes (wiki-style [[links]])
  - Automatic backlink detection
  - Graph visualization of note relationships
- **Tagging System**: Multi-level tags for taxonomy
- **Metadata Tracking**:
  - Created/modified timestamps
  - Author (human vs AI)
  - Version history
  - Word count, reading time

### 2. Search Capabilities

- **Full-Text Search**: SQLite FTS5 for fast text search
- **Semantic Search**: Vector similarity search via embeddings
- **Hybrid Search**: Combine keyword + semantic results
- **Filters**: By folder, tag, date, author type

### 3. AI Agent Modes

#### Mode 1: Ask Question

- Query knowledge base using RAG
- Retrieve relevant notes and context
- Provide sourced answers with citations
- Tools: search_notes, retrieve_context, summarize

#### Mode 2: Take Notes

- **Text Input**: Process stream-of-consciousness writing
- **Audio Input**: Transcribe voice notes via Whisper API
- **Chain of Thought**: Extract key points, structure thoughts
- **Auto-Update**: Identify and update relevant existing notes
- **Suggestions**: Propose new links, tags, folder placement
- Tools: transcribe_audio, extract_entities, find_related_notes, create_note, update_note

#### Mode 3: Editor

- **Style Analysis**: Learn and match user's writing style
- **Editorial Feedback**:
  - Clarity, conciseness, tone
  - Grammar and structure
  - Argument strength
- **Suggestion Mode**: Propose changes, never auto-apply
- **Diff View**: Show original vs suggested changes
- Tools: analyze_style, suggest_improvements, check_grammar

### 4. Provenance & Authorship

- **Content Attribution**:
  - Track AI-generated vs human-written content at block level
  - Visual indicators (subtle highlighting/badges)
  - Metadata stored in database
- **Approval Workflow**:
  - AI suggestions require explicit user acceptance
  - Force manual rewrite: AI provides outline/bullets, user writes prose
  - Track acceptance/rejection of suggestions
- **Version Control**:
  - Git integration for backup and versioning
  - Automatic commits on save (configurable)
  - Diff view for changes over time

### 5. Writing Style Learning

- **Style Profile**:
  - Analyze user's existing writing
  - Extract patterns: vocabulary, sentence structure, tone
  - Store as embeddings + statistical features
- **Style Matching**:
  - Compare AI suggestions against user style
  - Adjust tone/vocabulary to match
  - Provide "style score" for generated content
- **Continuous Learning**:
  - Update style profile as user writes
  - Preference learning from accepted/rejected suggestions

## Architecture

### Deployment: Docker Compose

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: writing_assistant
      POSTGRES_USER: writer
      POSTGRES_PASSWORD: local_dev_only
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - ./data/redis:/data

  backend:
    build: ./server
    environment:
      DATABASE_URL: postgresql://writer:local_dev_only@postgres:5432/writing_assistant
      REDIS_URL: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
    volumes:
      - ./data/files:/app/files

  # Tauri app runs natively on host, connects to localhost:3001
```

### Data Flow

1. **User Input** → Frontend (React/Next.js)
2. **Frontend** → Backend API (tRPC/REST)
3. **Backend** → Database (SQLite) + Vector Store
4. **AI Requests** → LLM API (OpenAI/Claude/Ollama)
5. **Embeddings** → Vector Store for RAG
6. **Git Sync** → Automatic backup of database + notes

### File Structure

```
arbor/
├── src-tauri/          # Rust/Tauri backend
├── src/                # Next.js frontend
│   ├── app/            # App router pages
│   ├── components/     # React components
│   ├── lib/            # Utilities, API client
│   └── styles/         # Tailwind CSS
├── server/             # Node.js backend
│   ├── api/            # API routes
│   ├── agents/         # AI agent implementations
│   ├── db/             # Database schema, migrations
│   └── services/       # Business logic
├── docker-compose.yml
└── data/               # SQLite DB, user files
```

## Git Integration

- **Auto-commit**: Configurable auto-commit on save
- **Manual Backup**: Export notes as markdown to Git repo
- **Conflict Resolution**: Detect and merge conflicts
- **Branch Strategy**: Main branch for stable notes, feature branches for experiments

## Security & Privacy

- **Local-First**: All data stored locally, no cloud dependency
- **API Keys**: Stored securely in Tauri's secure storage
- **No Auth**: Single-user, local-only access
- **Encryption**: Optional encryption at rest for sensitive notes

---

## Development Phases (SDLC with TDD)

### Phase 0: Project Setup & Infrastructure (Week 1)

**Goal**: Establish development environment, tooling, and CI/CD foundation

**Tasks**:

1. Initialize project structure (monorepo with pnpm workspaces)
2. Set up Docker Compose (PostgreSQL + pgvector, Redis)
3. Create Makefile with standard commands
4. Configure TypeScript, ESLint, Prettier
5. Set up testing frameworks (Vitest, Playwright)
6. Initialize Git repository with pre-commit hooks
7. Create database schema and migrations (Drizzle ORM)

**Deliverables**:

- ✅ `make setup` - Install dependencies, initialize database
- ✅ `make build` - Build all packages
- ✅ `make up` - Start Docker services
- ✅ `make down` - Stop Docker services
- ✅ `make test` - Run all tests
- ✅ `make migrate` - Run database migrations
- ✅ `make lint` - Lint and format code
- ✅ Working PostgreSQL with pgvector extension
- ✅ Database schema with `nodes` table

**Tests**:

- Database connection test
- Migration rollback test
- Docker health checks

**Success Criteria**:

- All Makefile commands execute successfully
- Database schema matches specification
- CI/CD pipeline runs tests on commit

---

### Phase 1: Core Data Layer (Week 2-3)

**Goal**: Build robust node-based data model with CRUD operations

**TDD Approach**:

1. Write tests for node operations FIRST
2. Implement minimal code to pass tests
3. Refactor and optimize

**Tasks**:

1. Implement Node repository (CRUD operations)
2. Add tree traversal functions (get children, get path, get subtree)
3. Implement soft delete and restore
4. Add JSONB metadata validation per node type
5. Create database indexes for performance
6. Implement transaction support

**Tests** (Write FIRST):

```typescript
// tests/repositories/node.test.ts
describe('NodeRepository', () => {
  test('should create a folder node', async () => {
    const folder = await nodeRepo.create({
      type: 'folder',
      name: 'My Projects',
      parent_id: null
    });
    expect(folder.id).toBeDefined();
    expect(folder.type).toBe('folder');
  });

  test('should get all children of a folder', async () => {
    const parent = await createFolder('Parent');
    const child1 = await createNote('Child 1', parent.id);
    const child2 = await createNote('Child 2', parent.id);

    const children = await nodeRepo.getChildren(parent.id);
    expect(children).toHaveLength(2);
  });

  test('should get full path to a node', async () => {
    const root = await createFolder('Root');
    const sub = await createFolder('Sub', root.id);
    const note = await createNote('Note', sub.id);

    const path = await nodeRepo.getPath(note.id);
    expect(path).toEqual(['Root', 'Sub', 'Note']);
  });

  test('should soft delete and restore nodes', async () => {
    const node = await createNote('Test');
    await nodeRepo.delete(node.id);

    const deleted = await nodeRepo.findById(node.id);
    expect(deleted).toBeNull();

    await nodeRepo.restore(node.id);
    const restored = await nodeRepo.findById(node.id);
    expect(restored).toBeDefined();
  });

  test('should cascade delete children', async () => {
    const parent = await createFolder('Parent');
    const child = await createNote('Child', parent.id);

    await nodeRepo.delete(parent.id);

    const deletedChild = await nodeRepo.findById(child.id);
    expect(deletedChild).toBeNull();
  });
});
```

**Deliverables**:

- ✅ Node repository with full CRUD
- ✅ Tree traversal utilities
- ✅ 100% test coverage for data layer
- ✅ Database indexes optimized
- ✅ API documentation (JSDoc)

**Success Criteria**:

- All tests pass (`make test`)
- Query performance < 100ms for 10k nodes
- No N+1 query issues

---

### Phase 2: Backend API (Week 4-5)

**Goal**: Build type-safe API with tRPC for node operations

**TDD Approach**:

1. Write integration tests for API endpoints
2. Implement tRPC routers
3. Add validation and error handling

**Tasks**:

1. Set up Fastify server with tRPC
2. Create node router (CRUD endpoints)
3. Add search router (full-text search)
4. Implement file upload for attachments
5. Add request validation (Zod schemas)
6. Set up error handling and logging
7. Add API rate limiting (Redis)

**Tests** (Integration):

```typescript
// tests/api/nodes.test.ts
describe('Node API', () => {
  test('POST /api/nodes - create folder', async () => {
    const response = await trpc.nodes.create.mutate({
      type: 'folder',
      name: 'Test Folder',
      parent_id: null
    });

    expect(response.id).toBeDefined();
    expect(response.type).toBe('folder');
  });

  test('GET /api/nodes/:id/children - get children', async () => {
    const parent = await createFolder('Parent');
    await createNote('Child 1', parent.id);
    await createNote('Child 2', parent.id);

    const children = await trpc.nodes.getChildren.query({
      id: parent.id
    });

    expect(children).toHaveLength(2);
  });

  test('GET /api/nodes/search - full-text search', async () => {
    await createNote('JavaScript Tutorial', null, 'Learn JS');
    await createNote('Python Guide', null, 'Learn Python');

    const results = await trpc.nodes.search.query({
      query: 'JavaScript'
    });

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('JavaScript Tutorial');
  });

  test('should validate node type metadata', async () => {
    await expect(
      trpc.nodes.create.mutate({
        type: 'note',
        name: 'Test',
        metadata: { invalid_field: true }
      })
    ).rejects.toThrow('Invalid metadata for type: note');
  });
});
```

**Deliverables**:

- ✅ tRPC API with full type safety
- ✅ Zod schemas for validation
- ✅ Integration tests for all endpoints
- ✅ API documentation (auto-generated)
- ✅ Error handling middleware
- ✅ Rate limiting with Redis

**Success Criteria**:

- All API tests pass
- Type safety end-to-end (frontend to database)
- API response time < 200ms (p95)

---

### Phase 3: Frontend Foundation (Week 6-7)

**Goal**: Build Next.js UI with node tree navigation

**TDD Approach**:

1. Write component tests with React Testing Library
2. Write E2E tests with Playwright
3. Implement components

**Tasks**:

1. Set up Next.js 14 with App Router
2. Configure Tailwind CSS + shadcn/ui
3. Create tRPC client with React Query
4. Build folder tree component (recursive)
5. Build note editor (Lexical or TipTap)
6. Implement drag-and-drop for organizing
7. Add keyboard shortcuts

**Tests**:

```typescript
// tests/components/FolderTree.test.tsx
describe('FolderTree', () => {
  test('should render folder hierarchy', () => {
    const tree = [
      { id: '1', name: 'Root', children: [
        { id: '2', name: 'Child 1', children: [] },
        { id: '3', name: 'Child 2', children: [] }
      ]}
    ];

    render(<FolderTree nodes={tree} />);

    expect(screen.getByText('Root')).toBeInTheDocument();
    expect(screen.getByText('Child 1')).toBeInTheDocument();
  });

  test('should expand/collapse folders', async () => {
    render(<FolderTree nodes={mockTree} />);

    const folder = screen.getByText('Root');
    await userEvent.click(folder);

    expect(screen.queryByText('Child 1')).not.toBeVisible();
  });
});

// tests/e2e/notes.spec.ts (Playwright)
test('should create and edit a note', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Create folder
  await page.click('[data-testid="new-folder"]');
  await page.fill('[data-testid="folder-name"]', 'My Notes');
  await page.click('[data-testid="save"]');

  // Create note
  await page.click('[data-testid="new-note"]');
  await page.fill('[data-testid="note-title"]', 'Test Note');
  await page.fill('[data-testid="note-content"]', 'Hello world');
  await page.click('[data-testid="save"]');

  // Verify note appears in tree
  await expect(page.locator('text=Test Note')).toBeVisible();
});
```

**Deliverables**:

- ✅ Responsive UI with folder tree
- ✅ Rich text editor with markdown support
- ✅ Component tests (80%+ coverage)
- ✅ E2E tests for critical flows
- ✅ Keyboard shortcuts
- ✅ Dark mode support

**Success Criteria**:

- All component tests pass
- E2E tests pass in CI
- Lighthouse score > 90
- Accessible (WCAG 2.1 AA)

---

### Phase 4: Vector Search & RAG (Week 8-9)

**Goal**: Implement semantic search and RAG pipeline

**TDD Approach**:

1. Write tests for embedding generation
2. Write tests for vector search
3. Implement RAG pipeline

**Tasks**:

1. Integrate OpenAI embeddings API
2. Create embedding generation service
3. Implement vector search with pgvector
4. Build hybrid search (keyword + semantic)
5. Create RAG context retrieval
6. Add background job for re-embedding (BullMQ + Redis)

**Tests**:

```typescript
// tests/services/embeddings.test.ts
describe('EmbeddingService', () => {
  test('should generate embeddings for text', async () => {
    const text = 'This is a test note about JavaScript';
    const embedding = await embeddingService.generate(text);

    expect(embedding).toHaveLength(1536); // OpenAI ada-002
    expect(embedding[0]).toBeTypeOf('number');
  });

  test('should store embeddings in database', async () => {
    const note = await createNote('Test', null, 'Content');
    await embeddingService.embedNode(note.id);

    const updated = await nodeRepo.findById(note.id);
    expect(updated.embedding).toBeDefined();
  });
});

// tests/services/search.test.ts
describe('SearchService', () => {
  test('should perform semantic search', async () => {
    await createNote('JS Tutorial', null, 'Learn JavaScript');
    await createNote('Python Guide', null, 'Learn Python');
    await embeddingService.embedAll();

    const results = await searchService.semantic('ECMAScript');

    expect(results[0].name).toBe('JS Tutorial');
    expect(results[0].similarity).toBeGreaterThan(0.7);
  });

  test('should perform hybrid search', async () => {
    await createNote('React Hooks', null, 'useState and useEffect');
    await createNote('Vue Composition', null, 'ref and reactive');
    await embeddingService.embedAll();

    const results = await searchService.hybrid('React hooks');

    expect(results[0].name).toBe('React Hooks');
  });
});

// tests/services/rag.test.ts
describe('RAGService', () => {
  test('should retrieve relevant context', async () => {
    await createNote('Note 1', null, 'AI and machine learning');
    await createNote('Note 2', null, 'Deep learning models');
    await embeddingService.embedAll();

    const context = await ragService.getContext('neural networks');

    expect(context).toHaveLength(2);
    expect(context[0].content).toContain('learning');
  });
});
```

**Deliverables**:

- ✅ Embedding generation service
- ✅ Vector search with pgvector
- ✅ Hybrid search (keyword + semantic)
- ✅ RAG context retrieval
- ✅ Background job queue
- ✅ 100% test coverage

**Success Criteria**:

- Semantic search returns relevant results
- Search latency < 500ms
- Embedding generation handles rate limits

---

### Phase 5: AI Agent Framework (Week 10-12)

**Goal**: Implement three AI agent modes with tool calling

**TDD Approach**:

1. Write tests for each agent mode
2. Write tests for tool execution
3. Implement agents with LangChain.js

**Tasks**:

1. Set up LangChain.js with OpenAI/Claude
2. Implement Agent 1: Ask Question (RAG-based Q&A)
3. Implement Agent 2: Take Notes (text + audio transcription)
4. Implement Agent 3: Editor (style analysis + suggestions)
5. Create tool registry (search, create, update, analyze)
6. Add conversation history management
7. Implement streaming responses

**Tests**:

```typescript
// tests/agents/ask-question.test.ts
describe('AskQuestionAgent', () => {
  test('should answer question using RAG', async () => {
    await createNote('JS Basics', null, 'Variables: let, const, var');
    await embeddingService.embedAll();

    const response = await askAgent.run(
      'What are the types of variables in JavaScript?'
    );

    expect(response.answer).toContain('let');
    expect(response.sources).toHaveLength(1);
    expect(response.sources[0].name).toBe('JS Basics');
  });
});

// tests/agents/take-notes.test.ts
describe('TakeNotesAgent', () => {
  test('should extract key points from text', async () => {
    const input = `
      Today I learned about React hooks.
      useState manages state, useEffect handles side effects.
      I should practice building a todo app.
    `;

    const result = await takeNotesAgent.run(input);

    expect(result.notes).toContainEqual(
      expect.objectContaining({
        title: expect.stringContaining('React'),
        content: expect.stringContaining('useState')
      })
    );
  });

  test('should update existing related notes', async () => {
    const existing = await createNote(
      'React Learning',
      null,
      'Basic concepts'
    );

    const input = 'Learned about useContext hook today';
    const result = await takeNotesAgent.run(input);

    expect(result.updated).toContainEqual(existing.id);

    const updated = await nodeRepo.findById(existing.id);
    expect(updated.content).toContain('useContext');
  });

  test('should transcribe audio and take notes', async () => {
    const audioFile = './fixtures/voice-note.mp3';

    const result = await takeNotesAgent.runAudio(audioFile);

    expect(result.transcription).toBeDefined();
    expect(result.notes).toHaveLength(1);
  });
});

// tests/agents/editor.test.ts
describe('EditorAgent', () => {
  test('should analyze writing style', async () => {
    const text = 'This is my writing. I like short sentences.';

    const analysis = await editorAgent.analyzeStyle(text);

    expect(analysis.avgSentenceLength).toBeLessThan(10);
    expect(analysis.tone).toBe('casual');
  });

  test('should suggest improvements', async () => {
    const text = 'The thing is very good and nice.';

    const suggestions = await editorAgent.suggest(text);

    expect(suggestions).toContainEqual(
      expect.objectContaining({
        type: 'clarity',
        original: 'very good and nice',
        suggestion: expect.any(String)
      })
    );
  });

  test('should NOT auto-apply suggestions', async () => {
    const note = await createNote('Test', null, 'Bad writing.');

    const suggestions = await editorAgent.suggest(note.content);
    const current = await nodeRepo.findById(note.id);

    expect(current.content).toBe('Bad writing.'); // Unchanged
    expect(suggestions).toHaveLength(1);
  });
});
```

**Deliverables**:

- ✅ Three AI agent modes
- ✅ Tool calling framework
- ✅ Audio transcription (Whisper API)
- ✅ Style learning system
- ✅ Streaming responses
- ✅ 100% test coverage for agents

**Success Criteria**:

- All agent tests pass
- Agents use RAG correctly
- No auto-apply of suggestions
- Provenance tracking works

---

### Phase 6: Provenance & Authorship (Week 13)

**Goal**: Track AI vs human content, enforce manual rewrite

**TDD Approach**:

1. Write tests for content attribution
2. Write tests for approval workflow
3. Implement tracking system

**Tasks**:

1. Add block-level attribution to editor
2. Implement suggestion approval workflow
3. Create diff view for AI suggestions
4. Add visual indicators (badges, highlighting)
5. Track acceptance/rejection metrics
6. Implement "force rewrite" mode

**Tests**:

```typescript
// tests/services/provenance.test.ts
describe('ProvenanceService', () => {
  test('should track AI-generated content', async () => {
    const note = await createNote('Test', null, '');

    await provenanceService.addBlock(note.id, {
      content: 'AI generated text',
      author_type: 'ai',
      source: 'gpt-4'
    });

    const blocks = await provenanceService.getBlocks(note.id);
    expect(blocks[0].author_type).toBe('ai');
  });

  test('should require approval for AI suggestions', async () => {
    const suggestion = await createSuggestion(
      'Original text',
      'Improved text'
    );

    expect(suggestion.metadata.status).toBe('pending');

    await provenanceService.approve(suggestion.id);

    const approved = await nodeRepo.findById(suggestion.id);
    expect(approved.metadata.status).toBe('approved');
  });

  test('should track acceptance rate', async () => {
    await createSuggestion('A', 'B', 'approved');
    await createSuggestion('C', 'D', 'rejected');
    await createSuggestion('E', 'F', 'approved');

    const metrics = await provenanceService.getMetrics();

    expect(metrics.acceptanceRate).toBe(0.67);
  });
});
```

**Deliverables**:

- ✅ Block-level attribution
- ✅ Approval workflow
- ✅ Diff view component
- ✅ Visual indicators
- ✅ Metrics dashboard
- ✅ 100% test coverage

**Success Criteria**:

- All provenance tests pass
- UI clearly shows AI vs human content
- Suggestions require explicit approval

---

### Phase 7: Tauri Desktop Integration (Week 14-15)

**Goal**: Wrap application in Tauri for native desktop experience

**Tasks**:

1. Initialize Tauri project
2. Configure IPC between frontend and Tauri
3. Implement native file system access
4. Add system tray and notifications
5. Configure auto-updates
6. Build installers (macOS, Windows, Linux)

**Tests**:

```typescript
// tests/tauri/ipc.test.ts
describe('Tauri IPC', () => {
  test('should invoke backend commands', async () => {
    const result = await invoke('get_app_version');
    expect(result).toMatch(/\d+\.\d+\.\d+/);
  });

  test('should access file system', async () => {
    const path = await invoke('select_folder');
    expect(path).toBeDefined();
  });
});
```

**Deliverables**:

- ✅ Tauri desktop app
- ✅ Native file dialogs
- ✅ System tray integration
- ✅ Auto-update mechanism
- ✅ Platform installers

**Success Criteria**:

- App launches on all platforms
- IPC communication works
- Bundle size < 10MB

---

### Phase 8: Git Integration & Backup (Week 16)

**Goal**: Automatic versioning and backup via Git

**Tasks**:

1. Implement auto-commit on save (configurable)
2. Add manual export to markdown
3. Create conflict resolution UI
4. Implement pg_dump backup
5. Add restore from backup

**Tests**:

```typescript
// tests/services/git.test.ts
describe('GitService', () => {
  test('should auto-commit on save', async () => {
    await gitService.enable();

    const note = await createNote('Test', null, 'Content');
    await new Promise(r => setTimeout(r, 1000)); // Wait for auto-commit

    const commits = await gitService.getCommits();
    expect(commits[0].message).toContain('Test');
  });

  test('should export notes as markdown', async () => {
    await createNote('Note 1', null, 'Content 1');
    await createNote('Note 2', null, 'Content 2');

    await gitService.exportMarkdown('./export');

    expect(fs.existsSync('./export/Note 1.md')).toBe(true);
  });
});
```

**Deliverables**:

- ✅ Auto-commit functionality
- ✅ Markdown export
- ✅ Backup/restore
- ✅ Conflict resolution
- ✅ 100% test coverage

**Success Criteria**:

- Git integration works reliably
- Backups are restorable
- No data loss

---

### Phase 9: Polish & Performance (Week 17-18)

**Goal**: Optimize performance, fix bugs, improve UX

**Tasks**:

1. Performance profiling and optimization
2. Add loading states and error boundaries
3. Implement offline support (service worker)
4. Add onboarding tutorial
5. Create user documentation
6. Fix bugs from user testing
7. Accessibility audit and fixes

**Tests**:

- Load testing (10k+ nodes)
- Performance benchmarks
- Accessibility tests (axe-core)

**Deliverables**:

- ✅ Performance optimizations
- ✅ Offline support
- ✅ User documentation
- ✅ Accessibility fixes
- ✅ Bug fixes

**Success Criteria**:

- App handles 10k+ nodes smoothly
- Lighthouse score > 95
- WCAG 2.1 AA compliant

---

## Makefile Commands

```makefile
.PHONY: help setup dev build clean up down logs restart migrate migrate-rollback migrate-create seed db-reset test test-unit test-integration test-e2e test-watch test-coverage lint format typecheck audit tauri-dev tauri-build tauri-bundle backup restore export-md version

# Default target
help:
 @echo "Writing AI Assistant - Available Commands"
 @echo ""
 @echo "Development:"
 @echo "  make setup           - Install dependencies, init database, run migrations"
 @echo "  make dev             - Start development servers (frontend + backend)"
 @echo "  make build           - Build all packages for production"
 @echo "  make clean           - Remove build artifacts and dependencies"
 @echo ""
 @echo "Docker:"
 @echo "  make up              - Start Docker services (PostgreSQL, Redis)"
 @echo "  make down            - Stop Docker services"
 @echo "  make logs            - View Docker logs"
 @echo "  make restart         - Restart Docker services"
 @echo ""
 @echo "Database:"
 @echo "  make migrate         - Run database migrations"
 @echo "  make migrate-rollback - Rollback last migration"
 @echo "  make migrate-create  - Create new migration"
 @echo "  make seed            - Seed database with test data"
 @echo "  make db-reset        - Drop and recreate database"
 @echo ""
 @echo "Testing:"
 @echo "  make test            - Run all tests (unit + integration + e2e)"
 @echo "  make test-unit       - Run unit tests only"
 @echo "  make test-integration - Run integration tests only"
 @echo "  make test-e2e        - Run E2E tests (Playwright)"
 @echo "  make test-watch      - Run tests in watch mode"
 @echo "  make test-coverage   - Generate coverage report"
 @echo ""
 @echo "Code Quality:"
 @echo "  make lint            - Lint code (ESLint)"
 @echo "  make format          - Format code (Prettier)"
 @echo "  make typecheck       - Run TypeScript type checking"
 @echo "  make audit           - Security audit (npm audit)"
 @echo ""
 @echo "Tauri:"
 @echo "  make tauri-dev       - Run Tauri in development mode"
 @echo "  make tauri-build     - Build Tauri app for production"
 @echo "  make tauri-bundle    - Create platform installers"
 @echo ""
 @echo "Git & Backup:"
 @echo "  make backup          - Create database backup and commit to Git"
 @echo "  make restore         - Restore from latest backup"
 @echo "  make export-md       - Export all notes as markdown files"

# Development
setup:
 @echo "Setting up development environment..."
 pnpm install
 make up
 sleep 5
 make migrate
 @echo "Setup complete! Run 'make dev' to start development."

dev:
 pnpm run dev

build:
 pnpm run build

clean:
 rm -rf node_modules
 rm -rf .next
 rm -rf dist
 rm -rf coverage
 pnpm store prune

# Docker
up:
 docker-compose up -d
 @echo "Waiting for services to be ready..."
 @sleep 5

down:
 docker-compose down

logs:
 docker-compose logs -f

restart:
 make down
 make up

# Database
migrate:
 pnpm run db:migrate

migrate-rollback:
 pnpm run db:rollback

migrate-create:
 @read -p "Migration name: " name; \
 pnpm run db:create $$name

seed:
 pnpm run db:seed

db-reset:
 docker-compose down -v
 make up
 make migrate
 make seed

# Testing
test:
 pnpm run test

test-unit:
 pnpm run test:unit

test-integration:
 pnpm run test:integration

test-e2e:
 pnpm run test:e2e

test-watch:
 pnpm run test:watch

test-coverage:
 pnpm run test:coverage
 @echo "Coverage report: ./coverage/index.html"

# Code Quality
lint:
 pnpm run lint

format:
 pnpm run format

typecheck:
 pnpm run typecheck

audit:
 pnpm audit

# Tauri
tauri-dev:
 pnpm run tauri dev

tauri-build:
 pnpm run tauri build

tauri-bundle:
 pnpm run tauri build --bundles all

# Git & Backup
backup:
 @echo "Creating database backup..."
 docker-compose exec postgres pg_dump -U writer writing_assistant > backup.sql
 git add backup.sql
 git commit -m "Database backup: $$(date +%Y-%m-%d_%H:%M:%S)"
 @echo "Backup complete!"

restore:
 @echo "Restoring from backup..."
 docker-compose exec -T postgres psql -U writer writing_assistant < backup.sql
 @echo "Restore complete!"

export-md:
 pnpm run export:markdown

version:
 @echo "Writing AI Assistant"
 @echo "Version: $$(cat package.json | grep version | head -1 | awk -F: '{ print $$2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')"
 @echo "Node: $$(node --version)"
 @echo "pnpm: $$(pnpm --version)"
```

---

## Testing Strategy

### Test Pyramid

```text
        /\
       /  \  E2E Tests (10%)
      /____\
     /      \  Integration Tests (30%)
    /________\
   /          \  Unit Tests (60%)
  /__________\
```

### Coverage Requirements

- **Unit Tests**: 80%+ coverage
  - All repositories, services, utilities
  - Pure functions, business logic
  - Fast execution (< 1s per test)

- **Integration Tests**: All API endpoints
  - tRPC routers
  - Database operations
  - External API integrations (mocked)
  - Medium execution time (< 5s per test)

- **E2E Tests**: Critical user flows
  - Create/edit/delete notes
  - Search functionality
  - AI agent interactions
  - Slower execution (< 30s per test)

- **Performance Tests**: Load testing with 10k+ nodes
  - Query performance benchmarks
  - Memory usage profiling
  - Bundle size monitoring

### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Lint and typecheck
        run: |
          pnpm run lint
          pnpm run typecheck

      - name: Start services
        run: docker-compose up -d

      - name: Run migrations
        run: pnpm run db:migrate

      - name: Run unit tests
        run: pnpm run test:unit

      - name: Run integration tests
        run: pnpm run test:integration

      - name: Run E2E tests
        run: pnpm run test:e2e

      - name: Generate coverage report
        run: pnpm run test:coverage

      - name: Upload to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4

      - name: Build frontend
        run: pnpm run build

      - name: Build backend
        run: pnpm run build:server

      - name: Build Tauri app
        run: pnpm run tauri build

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: app-bundle
          path: src-tauri/target/release/bundle/
```

---

## Success Metrics

### Technical Metrics

- ✅ **Test Coverage**: > 80% overall
  - Unit: > 85%
  - Integration: 100% of API endpoints
  - E2E: All critical user flows

- ✅ **Build Performance**:
  - Build time < 5 minutes
  - Hot reload < 2 seconds

- ✅ **Runtime Performance**:
  - API response time < 200ms (p95)
  - Search latency < 500ms
  - Time to interactive < 3s
  - First contentful paint < 1.5s

- ✅ **Bundle Size**:
  - Tauri app < 10MB
  - Frontend bundle < 500KB (gzipped)

- ✅ **Quality Scores**:
  - Lighthouse score > 95
  - TypeScript strict mode enabled
  - Zero ESLint errors
  - Zero security vulnerabilities (high/critical)

### User Experience Metrics

- ✅ **Scalability**: App handles 10k+ notes smoothly
- ✅ **Reliability**: Zero data loss
- ✅ **Offline Support**: Full offline capability
- ✅ **Accessibility**: WCAG 2.1 AA compliant
- ✅ **Cross-Platform**: Works on macOS, Windows, Linux

### AI Quality Metrics

- ✅ **RAG Accuracy**: Relevant context retrieval > 90%
- ✅ **Search Relevance**: Top-3 results relevant > 85%
- ✅ **Transcription Accuracy**: > 95% (Whisper API)
- ✅ **Style Matching**: User style similarity > 80%

---

## Technology Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Database** | PostgreSQL + pgvector | Native JSONB, mature vector search, better for node-based model |
| **Backend** | TypeScript/Node.js | Full-stack type safety, Tauri IPC compatibility |
| **Frontend** | Next.js 14 | Modern React, App Router, excellent DX |
| **Desktop** | Tauri v2 | Small bundle, native performance, Rust security |
| **Testing** | Vitest + Playwright | Fast, modern, great DX |
| **ORM** | Drizzle | Type-safe, lightweight, great PostgreSQL support |
| **API** | tRPC | End-to-end type safety, no code generation |
| **Build** | Makefile | Simple, universal, no extra dependencies |
| **Package Manager** | pnpm | Fast, efficient, workspace support |
| **AI Framework** | LangChain.js | Mature, extensive tool ecosystem |
| **Vector DB** | pgvector | Integrated with PostgreSQL, no separate service |

---

## Future Enhancements (Post-MVP)

- Multi-device sync (self-hosted server)
- Plugin system for custom agents/tools
- Export to PDF, EPUB, HTML
- Collaboration features (comments, suggestions)
- Mobile companion app (Tauri Mobile)
- Local LLM support (Ollama)
- Advanced graph visualization
- Voice commands
- Browser extension for web clipping
- API for third-party integrations

---

## Conclusion

This phased approach ensures:

1. **Disciplined Development**: TDD at every phase
2. **Incremental Progress**: Each phase builds on previous work
3. **Quality Assurance**: Comprehensive testing throughout
4. **Consistent Workflow**: Makefile standardizes all operations
5. **Maintainability**: Type safety, documentation, clean architecture

**Estimated Timeline**: 18 weeks (4.5 months) for MVP

**Recommendation**: Follow this phased approach strictly. Do not skip testing phases. Use Makefile for all operations to ensure consistency across development environments.
