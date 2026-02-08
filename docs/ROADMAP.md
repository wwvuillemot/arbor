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
- Command palette (CMD-K)
- Docker infrastructure (PostgreSQL, Redis, Traefik)
- Tauri v2 desktop app
- Test coverage: 62.95%

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

## Success Metrics

### Phase 1

- [ ] Create/edit markdown files
- [ ] Upload and embed images
- [ ] Export project to PDF
- [ ] File tree with drag-drop

### Phase 2

- [ ] Create and assign tags
- [ ] Jump to character nodes
- [ ] Filter by multiple tags

### Phase 3

- [ ] Semantic search finds relevant nodes
- [ ] Hybrid search outperforms keyword-only
- [ ] RAG context improves LLM responses

### Phase 4

- [ ] Chat with multiple threads
- [ ] LLM creates/edits nodes via tools
- [ ] Switch agent modes mid-conversation
- [ ] Reasoning models show thinking process

### Phase 5

- [ ] View complete change history
- [ ] Distinguish user vs LLM edits
- [ ] Rollback to previous version
- [ ] Export audit report

---

## Next Steps

1. **Review this roadmap** - Discuss priorities, adjust scope
2. **Choose Phase 1 starting point** - Likely 1.1 (schema) or 1.2 (editor)
3. **Set up project board** - Track tasks, milestones
4. **Spike on key decisions**:
   - Markdown editor choice (TipTap vs others)
   - Media storage strategy
   - Embedding provider
5. **Begin Phase 1.1** - Extend node schema for files/folders
