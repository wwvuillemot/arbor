# Arbor Development Roadmap

## Vision

Build a local-first, AI-powered writing assistant with hierarchical node-based data model, rich tagging, vector search, and integrated LLM chat with provenance tracking.

## Current Status

✅ **Foundation Complete**

- Project/Node CRUD operations
- User preferences (session + app-scope)
- Encryption infrastructure (master key + AES-256-GCM)
- Settings UI with API key management
- Toast notification system
- Theme & language support (EN/JA)
- Command palette (CMD-K) with global shortcuts (g+d, g+p, etc.)
- Docker infrastructure (PostgreSQL, Redis, MinIO)
- Tauri v2 desktop app
- Test coverage: 75.44%
- MinIO object storage service (Phase 0.1 ✅)

**Recent Bug Fixes:**

- ✅ Language change preserves tRPC cache (current project, API keys, preferences)
- ✅ Theme persistence across reloads (removed next-themes conflict)
- ✅ Hard reload (CMD-ALT-R) preserves all preferences
- ✅ Light mode visibility for projects

---

## Phase 0: Infrastructure Preparation

**Goal:** Prepare infrastructure for Phase 1 (Node Management & File System)

### 0.1 MinIO Object Storage Setup

**Why:** S3-compatible local object storage for media attachments

**Key Decisions:**

- Use MinIO (not filesystem) for clean abstraction and cloud migration path
- Docker service with persistent volumes at `data/minio/`
- Bucket structure: `arbor-media`, `arbor-exports`, `arbor-temp`

### 0.2 Update Node Schema (JSONB + Position) ✅

**Why:** Enable rich content storage and sibling ordering

**Key Decisions:**

- Change `content` from TEXT to JSONB for structured data
- Add `position` INTEGER for drag-drop reordering
- Add `created_by`/`updated_by` for provenance tracking
- Add `metadata` JSONB for extensibility

**Status:** Complete

### 0.2.1 Database Migration System ✅

**Why:** Prevent data loss and enable version-controlled schema changes

**Problem:** Using `drizzle-kit push` directly modifies schema and can lose data (e.g., master key was lost when user_preferences table was recreated)

**Solution:** Implement proper migration workflow with Drizzle Kit

**Key Changes:**

- Created migration runner: `apps/api/src/db/migrate.ts`
- Generated initial migration: `0000_glamorous_warlock.sql`
- Updated Makefile to use `db:migrate` instead of `db:push`
- Added safety warnings to `db:push` command
- Created comprehensive migration documentation

**New Commands:**

```bash
make db-generate    # Generate migration from schema changes
make db-migrate     # Apply pending migrations (RECOMMENDED)
make db-push        # Direct schema push (⚠️ can lose data)
```

**Benefits:**

- ✅ Version-controlled schema changes
- ✅ Data preservation during schema updates
- ✅ Migration history tracking
- ✅ Team collaboration support
- ✅ Production-ready deployment

**Documentation:** See `docs/DATABASE_MIGRATIONS.md`

**Status:** Complete - All future schema changes must use migrations

### 0.3 GraphQL Server Setup

**Why:** Enable AI/LLM to efficiently query hierarchical node data for context building

**Problem Statement:**

- AI assistants need to traverse node hierarchies (projects → folders → files → blocks)
- Need to fetch related data in single query (node + children + tags + metadata)
- RAG pipeline requires efficient context gathering from graph structure
- LLMs work better with GraphQL's declarative query language than imperative tRPC calls

**Key Decisions:**

**Architecture: Hybrid API (tRPC + GraphQL)**

- **tRPC for Mutations** - Type-safe CRUD operations (create, update, delete nodes)
- **GraphQL for Queries** - Complex graph traversal and AI context building
- Both share same service layer (NodeService, PreferencesService, etc.)
- Both run on same Fastify server (different endpoints)

**GraphQL Library: Pothos GraphQL**

- **Why Pothos:** Type-safe, code-first schema builder for TypeScript
- **Why NOT Prisma:** We use Drizzle ORM, not Prisma
- **Why NOT TypeGraphQL:** Pothos has better TypeScript inference
- **Performance:** Runs locally on desktop, no network latency concerns

**GraphQL Server: Apollo Server**

- **Why Apollo:** Industry standard, excellent tooling, mature ecosystem
- **Why NOT GraphQL Yoga:** Apollo has better integration with Fastify
- **Why NOT Mercurius:** Apollo's caching and DataLoader support is superior

**Initial Schema:**

```graphql
type Query {
  # Single node lookup
  node(id: ID!): Node

  # Filtered node search
  nodes(
    projectId: ID
    parentId: ID
    nodeType: String
    tags: [String!]
    limit: Int
    offset: Int
  ): [Node!]!

  # Full tree traversal (for AI context)
  nodeTree(projectId: ID!, maxDepth: Int, includeContent: Boolean): NodeTree!

  # Tag-based queries
  nodesByTags(tags: [String!]!, operator: TagOperator): [Node!]!
}

type Node {
  id: ID!
  name: String!
  nodeType: String!
  content: JSON
  position: Int
  parentId: ID
  projectId: ID
  tags: [String!]!
  metadata: JSON
  createdBy: String
  updatedBy: String
  createdAt: DateTime!
  updatedAt: DateTime!

  # Relationships (graph traversal)
  parent: Node
  children: [Node!]!
  project: Node
  ancestors: [Node!]!
  descendants(maxDepth: Int): [Node!]!
}

type NodeTree {
  root: Node!
  nodes: [Node!]!
  totalCount: Int!
}

enum TagOperator {
  AND # All tags must match
  OR # Any tag matches
}
```

**Use Cases:**

1. **AI Context Building**

   ```graphql
   query GetProjectContext($projectId: ID!) {
     nodeTree(projectId: $projectId, maxDepth: 3, includeContent: true) {
       root {
         name
       }
       nodes {
         id
         name
         nodeType
         content
         tags
         parent {
           name
         }
       }
     }
   }
   ```

2. **Tag-Based Search (for RAG)**

   ```graphql
   query FindRelatedNotes($tags: [String!]!) {
     nodesByTags(tags: $tags, operator: OR) {
       id
       name
       content
       tags
       ancestors {
         name
       }
     }
   }
   ```

3. **Hierarchical Navigation**

   ```graphql
   query GetNodeWithContext($id: ID!) {
     node(id: $id) {
       id
       name
       content
       ancestors {
         id
         name
       }
       children {
         id
         name
         nodeType
       }
       parent {
         id
         name
       }
     }
   }
   ```

**Performance Optimizations:**

- DataLoader for N+1 query prevention
- Query complexity limits (max depth: 10)
- Field-level caching with Redis
- Pagination for large result sets

**Future Extensions:**

- Subscriptions for real-time updates (Phase 4)
- Vector search integration (Phase 3)
- Memory queries (Phase 4)
- Provenance tracking queries (Phase 5)

### 0.4 MCP Server Scaffold

**Why:** Enable LLM tool calling via Model Context Protocol

**Key Decisions:**

- Separate service at `apps/mcp-server/` (port 3849)
- JSONRPC 2.0 protocol
- Basic tools: `create_node`, `update_node`, `search_nodes`
- Resources: `node://`, `project://` URIs
- Prompts: `summarize_project`, `outline_structure`

---

## Phase 1: Node Management & File System

**Goal:** Build out the core node management system with files, folders, and markdown support

### 1.1 Extend Node Schema for Files & Folders

- Add `content` (TEXT) for markdown storage
- Add `mimeType`, `fileSize`, `encoding` for file metadata
- Add `metadata` (JSONB) for folder-specific data
- Migration script with backward compatibility

### 1.2 Markdown Editor Component

**Options:**

- **TipTap** (recommended): Headless, extensible, great TypeScript support
- **Lexical**: Meta's framework, powerful but complex
- **CodeMirror**: Lightweight, code-focused

**Features:**

- Live preview (split or toggle)
- Syntax highlighting
- Toolbar (bold, italic, headers, lists, links, images)
- Keyboard shortcuts
- Auto-save with debouncing

### 1.3 Media Attachment System

**Storage Strategy: MinIO (S3-Compatible Object Storage)**

**Why MinIO:**

- ✅ S3-compatible API (easy cloud migration path)
- ✅ Clean abstraction from filesystem
- ✅ Built-in versioning, metadata, and access control
- ✅ Lightweight (runs in Docker)
- ✅ Local-first with persistent volumes
- ✅ Future-proof (can swap to AWS S3, Cloudflare R2, etc.)

**Docker Setup:**

```yaml
# docker-compose.yml
services:
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000" # API
      - "9001:9001" # Console
    environment:
      MINIO_ROOT_USER: arbor
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes:
      - ./data/minio:/data # Persistent local storage
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
```

**Bucket Structure:**

- `arbor-media` - User-uploaded media (images, PDFs, audio, video)
- `arbor-exports` - Generated exports (PDFs, backups)
- `arbor-temp` - Temporary files (auto-cleanup after 24h)

**Object Key Pattern:**

- `{project_id}/{node_id}/{timestamp}_{filename}`
- Example: `proj-123/node-456/1704067200_screenshot.png`

**Supported Media:**

- Images: PNG, JPG, GIF, WebP, SVG
- Documents: PDF
- Audio: MP3, WAV, OGG
- Video: MP4, WebM

**Implementation:**

- MinIO SDK for Node.js (`minio` package)
- Upload API with multipart form data
- Pre-signed URLs for secure downloads (expire after 1 hour)
- Image optimization (resize, compress) before upload
- Thumbnail generation (store as separate object)
- Metadata: `node_id`, `uploaded_by`, `content_type`, `original_filename`
- Markdown image syntax: `![alt](minio://bucket/key)` or `![alt](media://node_id/filename)`

**Database Schema:**

```sql
CREATE TABLE media_attachments (
  id UUID PRIMARY KEY,
  node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  bucket VARCHAR(255) NOT NULL,
  object_key VARCHAR(1024) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  checksum VARCHAR(64), -- SHA-256
  thumbnail_key VARCHAR(1024), -- For images/videos
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255) -- user_id or 'system'
);

CREATE INDEX idx_media_node ON media_attachments(node_id);
CREATE INDEX idx_media_bucket_key ON media_attachments(bucket, object_key);
```

**Migration Path:**

- Start with MinIO locally
- When ready for cloud: swap endpoint to S3/R2
- No code changes needed (S3-compatible API)
- Use bucket replication for migration

### 1.4 File Tree UI Component

**Features:**

- Collapsible tree with expand/collapse all
- Drag-and-drop to move/reorder
- Context menu (right-click): New, Rename, Delete, Copy, Move
- Keyboard navigation (arrows, Enter, Delete)
- File type icons (folder, markdown, image, etc.)
- Search/filter within tree
- Breadcrumb navigation

**Libraries:**

- `react-arborist` or `react-complex-tree`

### 1.5 PDF Export via LaTeX

**Pipeline:** Markdown → LaTeX → PDF

**Tools:**

- **Pandoc**: Universal document converter
- **LaTeX**: pdflatex or XeLaTeX for rendering

**Features:**

- Export single node or entire project
- Template system (academic, book, article)
- Custom styling (fonts, colors, margins)
- Table of contents generation
- Image embedding
- Batch export

**Implementation:**

- Backend service (Node.js child process)
- Queue system for long exports
- Progress tracking
- Download link with expiration

### 1.6 File CRUD Operations

**API Endpoints:**

- `POST /nodes/file` - Create file
- `POST /nodes/folder` - Create folder
- `GET /nodes/:id/content` - Get file content
- `PUT /nodes/:id/content` - Update file content
- `PUT /nodes/:id/move` - Move node
- `POST /nodes/:id/copy` - Copy node
- `DELETE /nodes/:id` - Delete node (cascade)

**Validation:**

- Name uniqueness within parent
- Path depth limits
- File size limits
- MIME type validation

---

## Phase 2: Tagging System

**Goal:** Implement rich tagging system for connecting and organizing nodes

### 2.1 Tag Schema & Database

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7), -- hex color
  icon VARCHAR(50), -- icon name
  type VARCHAR(50) DEFAULT 'general', -- general, character, location, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE node_tags (
  node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (node_id, tag_id)
);

CREATE INDEX idx_node_tags_node ON node_tags(node_id);
CREATE INDEX idx_node_tags_tag ON node_tags(tag_id);
```

### 2.2 Tag Management UI

- Tag library page
- Create/edit/delete tags
- Color picker (preset palette + custom)
- Icon selector (Lucide icons)
- Tag search and filtering
- Bulk operations

### 2.3 Tag Assignment to Nodes

- Tag picker component (multi-select dropdown)
- Autocomplete with fuzzy search
- Quick-add: type `#tagname` in editor
- Inline tag display with colors
- Remove tag with click

### 2.4 Character/Entity Tagging

**Special Features:**

- Tag type: `character`, `location`, `event`, `concept`
- Click tag → jump to dedicated node for that entity
- Auto-create entity node if doesn't exist
- Relationship mapping (character A appears with character B)
- Entity timeline view

### 2.5 Tag-based Navigation

- Tag browser sidebar
- Tag cloud visualization
- Filter nodes by tag(s)
- Tag intersection (AND/OR logic)
- Related tags suggestions

---

## Phase 3: Search & RAG

**Goal:** Build vector search, embeddings, and RAG capabilities

### 3.1 Embedding Service Setup

**Providers:**

- **OpenAI**: `text-embedding-3-small` (1536 dims, $0.02/1M tokens)
- **OpenAI**: `text-embedding-3-large` (3072 dims, $0.13/1M tokens)
- **Cohere**: `embed-english-v3.0` (1024 dims)
- **Local**: `all-MiniLM-L6-v2` via Transformers.js (384 dims, free)

**Recommendation:** Start with OpenAI small, add local option for privacy

**Storage:** PostgreSQL with pgvector extension (already installed)

### 3.2 Vector Storage Schema

```sql
-- Add vector column to nodes table
ALTER TABLE nodes ADD COLUMN embedding vector(1536);

-- Create index for similarity search
CREATE INDEX ON nodes USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- For better performance with large datasets
CREATE INDEX ON nodes USING hnsw (embedding vector_cosine_ops);
```

### 3.3 Embedding Generation Pipeline

**Background Job System:**

- Use BullMQ (Redis-backed queue)
- Job types: `generate_embedding`, `regenerate_all`
- Retry logic with exponential backoff

**Chunking Strategy:**

- Split large documents (>8000 tokens) into chunks
- Overlap chunks by 200 tokens
- Store chunk metadata (position, parent_node_id)

**Triggers:**

- On node create/update
- Batch processing for existing nodes
- Manual regeneration option

### 3.4 Vector Search API

**Endpoints:**

- `POST /search/vector` - Semantic search
- `POST /search/hybrid` - Vector + keyword search

**Features:**

- Cosine similarity ranking
- Filter by project, tags, node type
- Pagination with cursor
- Relevance score threshold
- Re-ranking with cross-encoder (optional)

**Hybrid Search:**

- Combine vector similarity with PostgreSQL full-text search
- Weighted scoring: `0.7 * vector_score + 0.3 * keyword_score`

### 3.5 RAG Context Builder

**Pipeline:**

1. **Query** → Generate embedding
2. **Retrieve** → Top-k similar nodes (k=10-20)
3. **Rerank** → Score by relevance + recency
4. **Format** → Build context string for LLM

**Context Format:**

```
# Relevant Context

## Document 1: {node.name}
Path: {node.path}
Tags: {node.tags}
Content:
{node.content}

---

## Document 2: ...
```

**Optimization:**

- Token counting to stay within LLM limits
- Summarization for very long nodes
- Metadata-only for low-relevance nodes

### 3.6 Search UI Component

**Features:**

- Search bar with autocomplete
- Filter panel (project, tags, date range, node type)
- Result cards with:
  - Title, path, tags
  - Snippet with highlighted matches
  - Relevance score
  - Preview on hover
- Sort by: relevance, date, name
- Export results

---

## Phase 4: Chat & LLM Integration

**Goal:** Implement multi-threaded chat with MCP server and multiple agent modes

### 4.1 Chat Schema & Database

```sql
CREATE TABLE chat_threads (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  name VARCHAR(255),
  agent_mode VARCHAR(50) DEFAULT 'assistant',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- user, assistant, system, tool
  content TEXT,
  model VARCHAR(100), -- e.g., gpt-4o, claude-3.5-sonnet
  tokens_used INTEGER,
  tool_calls JSONB, -- function calls made
  metadata JSONB, -- reasoning steps, etc.
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_thread ON chat_messages(thread_id, created_at);
```

### 4.2 LLM Provider Abstraction

**Interface:**

```typescript
interface LLMProvider {
  chat(messages: Message[], options: ChatOptions): AsyncIterator<Chunk>;
  embed(text: string): Promise<number[]>;
  models(): Promise<Model[]>;
}
```

**Providers:**

- OpenAI (GPT-4o, o1, o3)
- Anthropic (Claude 3.5 Sonnet, Claude 3 Opus)
- Google (Gemini 2.0 Flash, Gemini 1.5 Pro)
- Local (Ollama, LM Studio)

**Features:**

- Streaming support
- Function/tool calling
- Vision (image inputs)
- Reasoning model support (thinking tokens)
- Token counting and cost tracking

### 4.3 MCP Server Implementation

**Model Context Protocol (JSONRPC 2.0)**

**Tools:**

1. **Node Management**
   - `create_node(name, type, parent_id, content)`
   - `update_node(id, content)`
   - `delete_node(id)`
   - `move_node(id, new_parent_id)`
   - `list_nodes(project_id, filters)`

2. **Search**
   - `search_nodes(query, filters)`
   - `search_semantic(query, top_k)`

3. **Tag Management**
   - `add_tag(node_id, tag_name)`
   - `remove_tag(node_id, tag_name)`
   - `list_tags()`

4. **Media Generation**
   - `generate_image(prompt, style)` - DALL-E, Stable Diffusion
   - `attach_media(node_id, media_url)`

5. **Export**
   - `export_to_pdf(node_id, template)`
   - `export_project(project_id, format)`

**Implementation:**

- Separate service (port 3849)
- Authentication via API key
- Rate limiting
- Audit logging of all tool calls

### 4.4 Agent Mode System

**Modes:**

1. **Assistant** (Default)
   - General-purpose helper
   - All tools available
   - Balanced creativity

2. **Planner**
   - Focus on structure and organization
   - Tools: create_node, move_node, add_tag
   - High reasoning, low creativity

3. **Editor**
   - Content refinement and improvement
   - Tools: update_node, search_nodes
   - Focus on clarity, grammar, style

4. **Researcher**
   - Information gathering and synthesis
   - Tools: search_semantic, list_nodes
   - High accuracy, cite sources

**System Prompt Template:**

```
You are {mode_name}, an AI assistant for Arbor.

Role: {mode_description}

Available Tools: {tool_list}

Guidelines:
{mode_specific_guidelines}

Current Project: {project_name}
```

**Mode Switching:**

- Dropdown in chat UI
- Persisted per thread
- Can change mid-conversation

### 4.5 Chat UI Component

**Layout:**

- Left sidebar: Thread list
- Main area: Message history
- Bottom: Input box with mode selector
- Right sidebar (optional): Tool call inspector

**Features:**

- Streaming message display
- Markdown rendering in messages
- Code syntax highlighting
- Tool call visualization (collapsible)
- Reasoning display for o1/o3 models
- Copy message, regenerate, edit
- Attach files/images to messages
- Thread search

### 4.6 Reasoning Model Support

**Models:**

- OpenAI o1, o3
- DeepSeek R1

**Features:**

- Display thinking/reasoning tokens separately
- Collapsible reasoning section
- Token usage breakdown (thinking vs output)
- Cost optimization (cache reasoning)

---

## Phase 5: Provenance & Version Control

**Goal:** Track all changes with granular provenance (user vs LLM)

### 5.1 Provenance Schema Design

**Granularity Options:**

**Option A: Node-level** (Simpler)

- Track changes to entire node
- Store: who, what (create/update/delete), when, why

**Option B: Content-level** (More detailed)

- Track changes within node content
- Store diffs (character-level or line-level)
- Enables inline attribution

**Recommendation:** Start with node-level, add content-level for critical nodes

```sql
CREATE TABLE node_history (
  id UUID PRIMARY KEY,
  node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  actor_type VARCHAR(20) NOT NULL, -- user, llm
  actor_id VARCHAR(255), -- user_id or model name
  action VARCHAR(50) NOT NULL, -- create, update, delete, move
  content_before TEXT,
  content_after TEXT,
  diff JSONB, -- structured diff
  metadata JSONB, -- context, reasoning, etc.
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_history_node ON node_history(node_id, version DESC);
```

### 5.2 Change Tracking System

**Implementation:**

- Trigger on all node mutations
- Compute diff (use `diff-match-patch` library)
- Store attribution metadata
- Async processing for large diffs

**Metadata:**

- User: `{user_id, username, session_id}`
- LLM: `{model, mode, thread_id, message_id, tool_call_id}`

### 5.3 Content Versioning

**Features:**

- View version history
- Diff viewer (side-by-side or inline)
- Rollback to previous version
- Branch/merge for collaborative editing
- Conflict resolution UI

**Git-like Commands:**

- `checkout(version)` - View old version
- `revert(version)` - Rollback
- `compare(v1, v2)` - Diff
- `merge(branch)` - Combine changes

### 5.4 Blockchain Evaluation

**Pros:**

- Immutable audit trail
- Cryptographic verification
- Distributed trust (if multi-user)

**Cons:**

- Complexity (wallet management, gas fees)
- Performance overhead
- Overkill for single-user local-first app

**Recommendation:** **Skip blockchain** for now

- Use cryptographic hashing (SHA-256) for integrity
- Sign changes with user's private key (optional)
- Simpler, faster, sufficient for provenance

**Alternative:** Content-addressable storage (CAS)

- Store content by hash (like Git)
- Deduplication
- Integrity verification

### 5.5 Audit Log UI

**Features:**

- Timeline view of all changes
- Filter by:
  - Actor (user vs LLM)
  - Action type
  - Date range
  - Node/project
- Diff viewer
- Export audit report (CSV, PDF)
- Search within changes

### 5.6 LLM Attribution Badges

**Visual Indicators:**

- Badge on node: "✨ AI-assisted" or "🤖 AI-generated"
- Inline annotations in editor (highlight LLM-edited text)
- Tooltip with details (model, timestamp, reasoning)

**Granularity:**

- Node-level: Badge in file tree
- Paragraph-level: Highlight in editor
- Character-level: Underline with tooltip

---

## Technical Considerations

### Media Storage

**Recommendation:** Filesystem with DB references

- Simple, fast, easy to backup
- Store in `{project_root}/media/{node_id}/{filename}`
- Cleanup on node deletion

### Blockchain for Provenance

**Recommendation:** Skip it

- Use SHA-256 hashing for integrity
- Cryptographic signatures (optional)
- Simpler, faster, sufficient

### Smallest Node Granularity

**Recommendation:** File-level nodes

- Easier to manage
- Clear boundaries
- Use content versioning for sub-file tracking

### Background Jobs

**Recommendation:** BullMQ (Redis-backed)

- Reliable, persistent
- Retry logic
- Progress tracking
- Already have Redis in stack

### Markdown Editor

**Recommendation:** TipTap

- Headless, extensible
- Great TypeScript support
- Active community
- Prosemirror-based (robust)

---

## Dependencies & Order

### Phase 1 → Phase 2

- Tags can be added to files/folders
- File tree can filter by tags

### Phase 1 → Phase 3

- Embeddings generated from file content
- Search returns files/folders

### Phase 3 → Phase 4

- RAG uses vector search for context
- Chat can search and retrieve nodes

### Phase 4 → Phase 5

- LLM changes tracked in provenance
- Attribution shows which agent made changes

### Recommended Order

1. **Phase 1** (Foundation)
2. **Phase 2** (Organization)
3. **Phase 3** (Search)
4. **Phase 4** (AI Integration)
5. **Phase 5** (Accountability)

---

## Project Progress

### Phase 0: Infrastructure Preparation

#### 0.1 MinIO Object Storage Setup ✅ COMPLETED

**Commit:** `b8b930d`

- [x] Added MinIO service to docker-compose.yml
- [x] Installed `minio@8.0.6` package
- [x] Created `MinioService` with upload/download/delete/list operations
- [x] Comprehensive test suite (8 tests passing)
- [x] Coverage: 64.68% → 75.44% (+10.76%)

#### 0.2 Update Node Schema (JSONB + Position) ✅ COMPLETED (Commits: `38e4e51`, `5b63c46`, `9d53c2b`, `174706a`)

- [x] Change `content` field from TEXT to JSONB
- [x] Add `position` INTEGER field for sibling ordering
- [x] Add `created_by` VARCHAR(255) field (user_id or 'llm:model-name')
- [x] Add `updated_by` VARCHAR(255) field
- [x] Add `metadata` JSONB field for extensibility (already existed)
- [x] Create migration script with backward compatibility (manual SQL migration)
- [x] Update `NodeService` to handle JSONB content (Commit: `9d53c2b`)
- [x] Update tRPC routers to support new schema (Commit: `174706a`)
- [x] Add tests for new fields (18 comprehensive tests: 8 schema + 10 service)
- [x] Update seed data to use new schema (Commit: `5b63c46`)
- [x] Run preflight and commit

**Coverage:** 75.44% → 76.26% (improved) ✅

#### 0.3 GraphQL Server Setup � IN PROGRESS

**TDD Approach:**

1. Write tests for GraphQL queries (RED)
2. Implement schema and resolvers (GREEN)
3. Add DataLoader optimizations (REFACTOR)

**Architecture Note:**

- GraphQL is part of the **API service** (`apps/api`), not a separate service
- Mounted on same Fastify server as tRPC (different endpoint: `/graphql`)
- Shares same service layer (NodeService, PreferencesService, etc.)
- Tests go in `tests/unit/graphql/` and `tests/integration/graphql/`
- Files structure:
  - `apps/api/src/graphql/schema.ts` - Pothos schema builder
  - `apps/api/src/graphql/types/` - Type definitions
  - `apps/api/src/graphql/resolvers/` - Query/field resolvers
  - `apps/api/src/graphql/loaders.ts` - DataLoader instances
  - `apps/api/src/api/index.ts` - Mount Apollo Server (update existing)

**Tasks:**

- [x] Install dependencies ✅ DONE
  - [x] `@pothos/core` - Type-safe schema builder
  - [x] `@apollo/server` - GraphQL server
  - [x] `graphql` - GraphQL.js
  - [x] `dataloader` - N+1 query prevention
- [ ] Create GraphQL schema with Pothos
  - [ ] Define Node type with all fields
  - [ ] Define NodeTree type
  - [ ] Define TagOperator enum
  - [ ] Add `node(id)` query
  - [ ] Add `nodes(filter)` query with pagination
  - [ ] Add `nodeTree(projectId)` query with depth limit
  - [ ] Add `nodesByTags(tags, operator)` query
- [ ] Implement resolvers
  - [ ] Node.parent resolver (with DataLoader)
  - [ ] Node.children resolver (with DataLoader)
  - [ ] Node.ancestors resolver
  - [ ] Node.descendants resolver with maxDepth
  - [ ] Node.project resolver
- [ ] Add GraphQL endpoint to Fastify
  - [ ] Mount Apollo Server at `/graphql`
  - [ ] Add GraphQL Playground (dev only)
  - [ ] Add query complexity limits
  - [ ] Add depth limits (max: 10)
- [ ] Add comprehensive tests
  - [ ] Test `node(id)` query
  - [ ] Test `nodes(filter)` with various filters
  - [ ] Test `nodeTree(projectId)` with depth limits
  - [ ] Test `nodesByTags` with AND/OR operators
  - [ ] Test relationship resolvers (parent, children, ancestors)
  - [ ] Test DataLoader batching (N+1 prevention)
  - [ ] Test error handling (invalid IDs, missing nodes)
- [ ] Update documentation
  - [ ] Add GraphQL usage examples to ARCHITECTURE.md
  - [ ] Document when to use GraphQL vs tRPC
  - [ ] Add example queries for AI context building
- [ ] Run preflight and commit

**Expected Coverage:** Maintain 76%+

#### 0.4 MCP Server Scaffold 📋 TODO

- [ ] Create new service at `apps/mcp-server/`
- [ ] Install MCP dependencies (`@modelcontextprotocol/sdk`)
- [ ] Implement JSONRPC 2.0 server
- [ ] Add basic tools: `create_node`, `update_node`, `search_nodes`
- [ ] Add resources: `node://`, `project://`
- [ ] Add prompts: `summarize_project`, `outline_structure`
- [ ] Add to docker-compose.yml
- [ ] Add tests for MCP tools
- [ ] Document MCP integration
- [ ] Run preflight and commit

**Expected Coverage:** Maintain 75%+

---

### Phase 1: Node Management & File System

#### Success Criteria

- [ ] Create/edit markdown files
- [ ] Upload and embed images
- [ ] Export project to PDF
- [ ] File tree with drag-drop

---

### Phase 2: Tagging System

#### Success Criteria

- [ ] Create and assign tags
- [ ] Jump to character nodes
- [ ] Filter by multiple tags

---

### Phase 3: Search & RAG

#### Success Criteria

- [ ] Semantic search finds relevant nodes
- [ ] Hybrid search outperforms keyword-only
- [ ] RAG context improves LLM responses

---

### Phase 4: Chat & LLM Integration

#### Success Criteria

- [ ] Chat with multiple threads
- [ ] LLM creates/edits nodes via tools
- [ ] Switch agent modes mid-conversation
- [ ] Reasoning models show thinking process

---

### Phase 5: Provenance & Version Control

#### Success Criteria

- [ ] View complete change history
- [ ] Distinguish user vs LLM edits
- [ ] Rollback to previous version
- [ ] Export audit report
