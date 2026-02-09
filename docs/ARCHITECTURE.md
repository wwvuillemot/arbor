# Arbor Architecture

## Overview

Arbor is a local-first, AI-powered writing assistant built on a **block-based node system** with **hybrid API architecture** (tRPC + GraphQL) and **AI memory** for context-aware assistance.

## Core Principles

1. **Everything is a Node** - Projects, folders, files, paragraphs, images, memories
2. **Tags as Ontology** - Tags connect disparate pieces across the taxonomy
3. **AI-First Design** - Architecture optimized for LLM interaction
4. **Local-First** - All data stored locally, cloud optional
5. **Provenance Tracking** - Know who (user/LLM) changed what and when
6. **Web-First** - Primary interface is web browser, desktop app de-emphasized

---

## Infrastructure Overview

### Deployment Architecture

Arbor uses a **hybrid deployment model**:

- **Web App & API Server**: Run locally on host machine (not in Docker)
- **Third-Party Services**: Run in Docker containers (PostgreSQL, Redis, MinIO, pgAdmin)
- **Unified Proxy**: Single nginx container (`arbor-proxy`) routes all services via `*.arbor.local` domains

### Port Allocation

| Service | Local Port | Domain | Access Method |
|---------|-----------|--------|---------------|
| Web App | 3847 | `app.arbor.local` | HTTP via arbor-proxy |
| API Server | 3848 | `api.arbor.local` | HTTP via arbor-proxy |
| PostgreSQL | 5432 | `postgres.arbor.local:5432` | TCP via arbor-proxy |
| Redis | 6379 | `redis.arbor.local:6379` | TCP via arbor-proxy |
| MinIO API | 9000 | `minio.arbor.local:9000` | TCP via arbor-proxy |
| MinIO Console | 9001 | `minio-console.arbor.local` | HTTP via arbor-proxy |
| pgAdmin | 5050 | `pgadmin.arbor.local` | HTTP via arbor-proxy |

### Database Configuration

- **Development Database**: `arbor_dev` (for local development)
- **Test Database**: `arbor_test` (for running tests)
- **Connection String**: `postgresql://arbor:local_dev_only@postgres.arbor.local:5432/{database_name}`
- **Migration System**: Drizzle Kit with versioned migrations (see `docs/DATABASE_MIGRATIONS.md`)

**CRITICAL**: Tests use a separate database (`arbor_test`) to prevent data loss. The `DATABASE_URL` environment variable is set to `arbor_test` in `vitest.config.ts`.

### Proxy Architecture

The `arbor-proxy` nginx container provides centralized routing for all services:

**HTTP Services** (port 80):

- Web App (`app.arbor.local`)
- API Server (`api.arbor.local`)
- MinIO Console (`minio-console.arbor.local`)
- pgAdmin (`pgadmin.arbor.local`)

**TCP Stream Services**:

- PostgreSQL (port 5432)
- Redis (port 6379)
- MinIO API (port 9000)

**Benefits**:

- ✅ Consistent `*.arbor.local` domain pattern
- ✅ Centralized port management
- ✅ No scattered port mappings across compose files
- ✅ Better service isolation

### DNS Configuration

All `*.arbor.local` domains are configured in `/etc/hosts`:

```
127.0.0.1 arbor.local app.arbor.local www.arbor.local admin.arbor.local api.arbor.local pgadmin.arbor.local db.arbor.local cache.arbor.local redis.arbor.local postgres.arbor.local minio.arbor.local minio-console.arbor.local
```

---

## Data Model

### Node Schema

```sql
CREATE TABLE nodes (
  id UUID PRIMARY KEY,
  parent_id UUID REFERENCES nodes(id) ON DELETE CASCADE,

  -- Node type determines rendering and behavior
  type VARCHAR(50) NOT NULL,
  -- Types: 'project', 'folder', 'file', 'paragraph', 'heading',
  --        'image', 'code', 'list', 'quote', 'node_reference',
  --        'callout', 'memory'

  name VARCHAR(255), -- For files/folders/projects

  -- JSONB content for flexibility
  content JSONB,

  -- Position for ordering within parent
  position INTEGER NOT NULL DEFAULT 0,

  -- Type-specific metadata
  metadata JSONB,

  -- Provenance
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255), -- 'user' or 'llm:model-name'
  updated_by VARCHAR(255),

  -- Vector embedding for semantic search
  embedding vector(1536)
);

CREATE INDEX idx_nodes_parent_position ON nodes(parent_id, position);
CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_embedding ON nodes USING hnsw (embedding vector_cosine_ops);
```

### Content Structure (JSONB)

**Markdown File:**

```json
{
  "format": "markdown",
  "text": "# Hello World\n\nThis is content"
}
```

**Paragraph Block:**

```json
{
  "type": "paragraph",
  "text": "This is a paragraph with **bold** text",
  "marks": [{ "type": "bold", "start": 25, "end": 29 }]
}
```

**Image Block:**

```json
{
  "type": "image",
  "src": "minio://arbor-media/proj-123/node-456/image.png",
  "alt": "Screenshot",
  "caption": "Figure 1: Architecture",
  "width": 800,
  "height": 600
}
```

**Node Reference Block:**

```json
{
  "type": "node_reference",
  "target_node_id": "node-789",
  "display": "embed", // "inline", "embed", "card"
  "label": "See character notes"
}
```

**Memory Node:**

```json
{
  "type": "memory",
  "category": "character", // "plot", "worldbuilding", "preference", "fact"
  "summary": "Alice is the protagonist, a 16-year-old wizard",
  "details": {
    "name": "Alice",
    "age": 16,
    "role": "protagonist",
    "abilities": ["fire magic", "telekinesis"]
  },
  "source_nodes": ["node-123", "node-456"],
  "confidence": 0.95,
  "last_accessed": "2024-02-08T12:00:00Z"
}
```

### Tag Schema

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  color VARCHAR(7), -- Hex color
  icon VARCHAR(50), -- Icon name
  type VARCHAR(50) DEFAULT 'general', -- 'general', 'character', 'location', etc.
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE node_tags (
  node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (node_id, tag_id)
);

-- Tag relationships for ontology
CREATE TABLE tag_relationships (
  parent_tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  child_tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50), -- 'parent', 'related', 'synonym'
  PRIMARY KEY (parent_tag_id, child_tag_id)
);

CREATE INDEX idx_node_tags_node ON node_tags(node_id);
CREATE INDEX idx_node_tags_tag ON node_tags(tag_id);
```

---

### GraphQL Schema Example

```graphql
type Node {
  id: ID!
  parentId: ID
  type: NodeType!
  name: String
  content: JSON
  position: Int!
  metadata: JSON

  # Relationships
  parent: Node
  children(type: NodeType): [Node!]!
  blocks: [Block!]!
  tags: [Tag!]!
  references: [Node!]! # Nodes this node references
  referencedBy: [Node!]! # Nodes that reference this node
  # Provenance
  createdAt: DateTime!
  updatedAt: DateTime!
  createdBy: String
  updatedBy: String
}

interface Block {
  id: ID!
  type: String!
  position: Int!
  content: JSON!
}

type ParagraphBlock implements Block {
  id: ID!
  type: String!
  position: Int!
  content: JSON!
  text: String!
}

type ImageBlock implements Block {
  id: ID!
  type: String!
  position: Int!
  content: JSON!
  media: MediaAttachment!
}

type NodeReferenceBlock implements Block {
  id: ID!
  type: String!
  position: Int!
  content: JSON!
  targetNode: Node!
  display: ReferenceDisplay!
}

type Memory {
  id: ID!
  category: MemoryCategory!
  summary: String!
  details: JSON!
  tags: [Tag!]!
  sourceNodes: [Node!]!
  confidence: Float
  lastAccessed: DateTime
}

enum NodeType {
  PROJECT
  FOLDER
  FILE
  PARAGRAPH
  HEADING
  IMAGE
  CODE
  LIST
  QUOTE
  NODE_REFERENCE
  CALLOUT
  MEMORY
}

enum MemoryCategory {
  CHARACTER
  PLOT
  WORLDBUILDING
  PREFERENCE
  FACT
}

enum ReferenceDisplay {
  INLINE
  EMBED
  CARD
}

type Query {
  node(id: ID!): Node
  nodes(projectId: ID!, filters: NodeFilters): [Node!]!
  searchNodes(query: String!, limit: Int): [Node!]!
  memories(tags: [String!], category: MemoryCategory, limit: Int): [Memory!]!
  tags(names: [String!]): [Tag!]!
}
```

---

## Media Storage (MinIO)

### Docker Configuration

```yaml
# apps/api/docker-compose.yml
services:
  minio:
    image: minio/minio:latest
    container_name: arbor-minio
    # Ports exposed via arbor-proxy (minio.arbor.local:9000, minio-console.arbor.local)
    environment:
      MINIO_ROOT_USER: arbor
      MINIO_ROOT_PASSWORD: local_dev_only
    volumes:
      - ../../data/minio:/data # Persistent local storage
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 2s
      timeout: 3s
      retries: 3
      start_period: 2s
    restart: unless-stopped
```

### Access URLs

- **MinIO API**: `minio.arbor.local:9000` (via arbor-proxy)
- **MinIO Console**: `http://minio-console.arbor.local` (via arbor-proxy HTTP)
- **Credentials**: `arbor` / `local_dev_only`

### Bucket Structure

- `arbor-media` - User-uploaded media (images, PDFs, audio, video)
- `arbor-exports` - Generated exports (PDFs, backups)
- `arbor-temp` - Temporary files (auto-cleanup after 24h)

### Object Key Pattern

```
{project_id}/{node_id}/{timestamp}_{filename}
Example: proj-123/node-456/1704067200_screenshot.png
```

### Media Attachments Schema

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
  created_by VARCHAR(255)
);

CREATE INDEX idx_media_node ON media_attachments(node_id);
CREATE INDEX idx_media_bucket_key ON media_attachments(bucket, object_key);
```

---

## MCP Server (AI Tool Calling)

### Architecture

```
┌─────────────────────────────────────────────┐
│              LLM Provider                    │
│         (OpenAI, Anthropic, etc.)           │
└──────────────────┬──────────────────────────┘
                   │ Function Calling
                   ▼
┌─────────────────────────────────────────────┐
│            MCP Server (Port 3849)           │
│          JSONRPC 2.0 over HTTP              │
├─────────────────────────────────────────────┤
│  Tool Registry:                             │
│  - Node CRUD (create, update, delete, list) │
│  - Search (semantic, keyword)               │
│  - Tags (add, remove, list)                 │
│  - Memory (create, search, update, link)    │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│         API Server (tRPC + GraphQL)         │
└─────────────────────────────────────────────┘
```

### MCP Tools

**Node Management:**

- `create_node(name, type, parent_id, content)` - Create a new node
- `update_node(id, content)` - Update node content
- `delete_node(id)` - Delete a node
- `list_nodes(project_id, filters)` - List nodes with filters
- `move_node(id, new_parent_id, position)` - Move node in tree

**Search:**

- `search_nodes(query, filters)` - Keyword search
- `search_semantic(query, top_k)` - Vector similarity search
- `get_context(node_id, depth)` - Get node with surrounding context

**Tags:**

- `add_tag(node_id, tag_name)` - Add tag to node
- `remove_tag(node_id, tag_name)` - Remove tag from node
- `list_tags()` - List all tags
- `find_by_tag(tag_name)` - Find nodes with tag

**Memory:**

- `create_memory(category, summary, details, tags, source_nodes)` - Store memory
- `search_memories(query, tags, category, limit)` - Find relevant memories
- `update_memory(id, updates)` - Update existing memory
- `link_memory_to_node(memory_id, node_id)` - Associate memory with node
- `get_related_memories(node_id, depth)` - Find related memories

---

## AI Memory System

### Memory as Nodes

Memories are stored as special node types with `type: 'memory'`. This allows:

- ✅ Tagging memories like any other node
- ✅ Linking memories to source nodes
- ✅ Searching memories with vector embeddings
- ✅ User editing of AI-created memories

### Memory Categories

1. **Character** - Character details, relationships, arcs
2. **Plot** - Events, timeline, causality, foreshadowing
3. **Worldbuilding** - Locations, rules, history, culture
4. **Preference** - User writing style, tone, voice preferences
5. **Fact** - Research notes, citations, verified information

### Memory Lifecycle

```
1. LLM encounters important information
   ↓
2. LLM calls create_memory() via MCP
   ↓
3. Memory stored as node with tags
   ↓
4. User can view/edit in Memory Bank UI
   ↓
5. LLM searches memories for context
   ↓
6. Memory confidence/access updated
```

### Example GraphQL Query for AI Context

```graphql
query GetContextForWriting($nodeId: ID!, $tags: [String!]) {
  # Current node being edited
  node(id: $nodeId) {
    id
    name
    content
    parent {
      name
      type
    }
  }

  # Relevant memories
  memories(tags: $tags, limit: 10) {
    id
    content
    tags {
      name
      color
    }
    createdBy
    confidence
  }

  # Related nodes
  relatedNodes(tags: $tags, limit: 5) {
    id
    name
    type
    content
  }

  # Tag relationships
  tags(names: $tags) {
    name
    related {
      name
      relationshipType
    }
    nodes {
      id
      name
    }
  }
}
```

This single query provides the LLM with:

- Current context (node being edited)
- Relevant memories (character details, plot points)
- Related content (other nodes with same tags)
- Tag relationships (discover related concepts)

---

## Search & RAG

### Vector Embeddings

**Model:** OpenAI `text-embedding-3-small` (1536 dimensions)
**Fallback:** Local embedding model (e.g., all-MiniLM-L6-v2)

**Embedding Generation:**

- Triggered on node create/update
- Background job (BullMQ + Redis)
- Stored in `nodes.embedding` column
- Indexed with pgvector HNSW

### Search Types

**1. Semantic Search (Vector)**

```sql
SELECT id, name, content,
       1 - (embedding <=> query_embedding) AS similarity
FROM nodes
WHERE type IN ('file', 'paragraph', 'memory')
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

**2. Keyword Search (Full-Text)**

```sql
SELECT id, name, content,
       ts_rank(to_tsvector('english', content::text), query) AS rank
FROM nodes
WHERE to_tsvector('english', content::text) @@ query
ORDER BY rank DESC
LIMIT 10;
```

**3. Hybrid Search**

- Combine vector + keyword results
- Reciprocal Rank Fusion (RRF) for merging
- Rerank with cross-encoder

### RAG Pipeline

```
User Query
    ↓
1. Generate embedding
    ↓
2. Vector search (top 20)
    ↓
3. Keyword search (top 20)
    ↓
4. Merge with RRF (top 10)
    ↓
5. Rerank with relevance
    ↓
6. Format context for LLM
    ↓
LLM Response
```

### Context Format

```markdown
# Context for: {query}

## Current Document

**Title:** {node.name}
**Type:** {node.type}
**Tags:** {node.tags}

{node.content}

## Relevant Memories

### Character: Alice

- 16-year-old wizard
- Fire magic, telekinesis
- Protagonist

### Plot: Chapter 2

- Alice meets Bob at academy
- First magic lesson

## Related Nodes

### Character Notes: Bob

{content excerpt...}

### Worldbuilding: Magic System

{content excerpt...}
```

---

## Agent Modes

### Mode System

Agents are defined by system prompts that change LLM behavior:

**1. Assistant Mode** (Default)

- General-purpose writing help
- Answers questions, suggests improvements
- Balanced creativity and accuracy

**2. Planner Mode**

- Focuses on structure and organization
- Suggests outlines, plot points, arcs
- Creates memories for future reference

**3. Editor Mode**

- Focuses on refinement and polish
- Grammar, style, clarity improvements
- Preserves author's voice

**4. Researcher Mode**

- Focuses on information gathering
- Searches existing content
- Suggests connections and references

### Mode Selection

Users can switch modes mid-conversation:

```
User: [Switches to Planner mode]
User: "Help me outline the next chapter"

LLM (Planner):
1. Searches memories for plot threads
2. Suggests structure based on story arc
3. Creates memory for planned chapter
```

---

## Provenance Tracking

### Who Changed What

Every node tracks:

- `created_by` - 'user' or 'llm:model-name'
- `updated_by` - 'user' or 'llm:model-name'
- `created_at`, `updated_at` - Timestamps

### Granular Tracking

For block-based nodes, each block is a separate node with its own provenance.

**Example:**

```
File: "Chapter 1" (created_by: user)
  ├─ Paragraph 1 (created_by: user)
  ├─ Paragraph 2 (created_by: llm:gpt-4o)
  └─ Paragraph 3 (created_by: user, updated_by: llm:claude-3.5-sonnet)
```

### Version History

```sql
CREATE TABLE node_versions (
  id UUID PRIMARY KEY,
  node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),
  change_summary TEXT -- Optional: LLM-generated summary of changes
);

CREATE INDEX idx_node_versions_node ON node_versions(node_id, version DESC);
```

### Diff Viewer

UI shows:

- Side-by-side comparison
- Highlighted changes
- Attribution badges (user vs LLM)
- Rollback capability

---

## Technology Stack

### Backend

- **Runtime:** Node.js 20+
- **Language:** TypeScript 5.7+
- **API:** Fastify 5.7+ (tRPC 11.9+, GraphQL via Pothos + Apollo Server)
- **Database:** PostgreSQL 16 + pgvector
- **Cache:** Redis 7
- **ORM:** Drizzle ORM 0.38+ with Drizzle Kit 0.30+ (migrations)
- **Object Storage:** MinIO (S3-compatible)
- **Background Jobs:** BullMQ (planned)
- **Embeddings:** OpenAI API + local fallback (planned)

### Frontend

- **Framework:** Next.js 15.5+ (App Router)
- **Language:** TypeScript 5.7+
- **UI:** React 19.2+, Tailwind CSS 3.4+
- **State:** TanStack Query (React Query)
- **GraphQL Client:** Apollo Client (planned)
- **Editor:** TipTap (Phase 1)
- **Icons:** lucide-react
- **Command Palette:** cmdk

### Desktop

- **Framework:** Tauri v2.2+ (de-emphasized, web-first approach)
- **Security:** AES-256-GCM encryption with database-stored master key

### DevOps

- **Containerization:** Docker Compose (3P services only: PostgreSQL, Redis, MinIO, pgAdmin)
- **Reverse Proxy:** nginx (arbor-proxy container) for local development
- **Testing:** Vitest 2.1+, Testing Library
- **Package Manager:** pnpm 9.15+
- **Databases:** Separate `arbor_dev` and `arbor_test` databases

---

## Migration Path

### Phase 0 → Phase 1

- Start with file-based nodes (simple markdown)
- JSONB content allows future block migration

### Phase 1 → Phase 5

- Convert files to blocks when needed
- File node becomes container (`content: NULL`)
- Child nodes become blocks with position

### Local → Cloud

- MinIO → AWS S3 / Cloudflare R2
- PostgreSQL → Managed PostgreSQL
- Redis → Managed Redis
- No code changes (S3-compatible API)

---

## Security Considerations

### Encryption at Rest

- Sensitive settings encrypted with master key (API keys, tokens, etc.)
- Master key auto-generated (32-byte random) and stored in database (`user_preferences` table)
- AES-256-GCM encryption with random IV per encrypted value
- Master key is base64-encoded for storage
- **Note:** Master key stored unencrypted in database (local-first, single-user assumption)
- **Architecture Decision:** Abandoned OS keychain approach due to Tauri dependency issues; using simpler database-stored master key

### API Authentication

- MCP server requires API key
- GraphQL requires session token
- tRPC uses session-based auth

### Data Isolation

- Projects are isolated by user
- No cross-project data leakage
- Memories scoped to projects

---

## Performance Optimizations

### Database

- HNSW index for vector search (fast approximate NN)
- GIN index for JSONB queries
- Materialized views for tag counts
- Connection pooling

### GraphQL

- DataLoader for N+1 prevention
- Query complexity limits
- Depth limits
- Caching with Redis

### Frontend

- React Query for caching
- Optimistic updates
- Infinite scroll for large lists
- Virtual scrolling for trees

---

## Future Considerations

### Collaboration

- Operational Transform (OT) or CRDTs for real-time editing
- Conflict resolution for concurrent edits
- Presence indicators

### Offline Support

- Service worker for offline access
- Local-first sync with cloud backup
- Conflict resolution on reconnect

### Advanced AI Features

- Multi-agent collaboration
- Autonomous editing with approval workflow
- Style transfer and voice cloning
- Automated fact-checking

---

## References

- [Pothos GraphQL](https://pothos-graphql.dev/)
- [pgvector](https://github.com/pgvector/pgvector)
- [MinIO](https://min.io/)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [TipTap](https://tiptap.dev/)
- [BullMQ](https://docs.bullmq.io/)

- `update_memory(id, updates)` - Update existing memory
- `link_memory_to_node(memory_id, node_id)` - Associate memory with node
- `get_related_memories(node_id, depth)` - Find related memories

## API Architecture

### Hybrid Approach: tRPC + GraphQL

Arbor uses a **hybrid API architecture** that combines the strengths of both tRPC and GraphQL:

- **tRPC** - Type-safe mutations and simple queries
- **GraphQL** - Complex graph traversal and AI context building

Both APIs share the same service layer and run on the same Fastify server.

#### Architecture Diagram

```mermaid
graph TB
    subgraph Frontend["Frontend (Next.js + React)"]
        UI[UI Components]
        tRPCClient[tRPC Client<br/>Mutations & Simple Queries]
        GQLClient[GraphQL Client<br/>Complex Queries & AI Context]
    end

    subgraph Backend["Backend (Fastify Server)"]
        tRPCRouter[tRPC Router<br/>- CRUD Operations<br/>- File Uploads<br/>- Preferences<br/>- Settings]
        GQLServer[GraphQL Server<br/>Pothos + Apollo<br/>- Graph Traversal<br/>- Nested Queries<br/>- AI Context Building]
    end

    subgraph Services["Service Layer"]
        NodeService[NodeService<br/>- CRUD<br/>- Tree Operations]
        PrefsService[PreferencesService<br/>- User Prefs<br/>- Master Key]
        SettingsService[SettingsService<br/>- API Keys<br/>- Encryption]
    end

    subgraph Data["Data Layer"]
        PG[(PostgreSQL<br/>Nodes, Projects,<br/>Preferences)]
        Redis[(Redis<br/>Session Cache)]
        MinIO[(MinIO<br/>Media Storage)]
    end

    subgraph AI["AI Integration (Future)"]
        MCP[MCP Server<br/>JSONRPC 2.0<br/>- Tool Calling<br/>- Resources<br/>- Prompts]
        RAG[RAG Pipeline<br/>- Vector Search<br/>- Context Builder]
    end

    UI --> tRPCClient
    UI --> GQLClient

    tRPCClient -->|Type-safe RPC| tRPCRouter
    GQLClient -->|GraphQL Queries| GQLServer

    tRPCRouter --> NodeService
    tRPCRouter --> PrefsService
    tRPCRouter --> SettingsService

    GQLServer --> NodeService
    GQLServer --> PrefsService

    NodeService --> PG
    PrefsService --> PG
    PrefsService --> Redis
    SettingsService --> PG

    NodeService --> MinIO

    MCP -->|Calls| GQLServer
    MCP -->|Calls| tRPCRouter
    RAG -->|Queries| GQLServer

    style Frontend fill:#e1f5ff,stroke:#0277bd,stroke-width:2px,color:#000
    style Backend fill:#fff4e1,stroke:#f57c00,stroke-width:2px,color:#000
    style Services fill:#f0f0f0,stroke:#616161,stroke-width:2px,color:#000
    style Data fill:#e8f5e9,stroke:#388e3c,stroke-width:2px,color:#000
    style AI fill:#fce4ec,stroke:#c2185b,stroke-width:2px,color:#000

    style UI fill:#fff,stroke:#0277bd,color:#000
    style tRPCClient fill:#fff,stroke:#0277bd,color:#000
    style GQLClient fill:#fff,stroke:#0277bd,color:#000

    style tRPCRouter fill:#ffd54f,stroke:#f57c00,stroke-width:2px,color:#000
    style GQLServer fill:#ffd54f,stroke:#f57c00,stroke-width:2px,color:#000

    style NodeService fill:#fff,stroke:#616161,color:#000
    style PrefsService fill:#fff,stroke:#616161,color:#000
    style SettingsService fill:#fff,stroke:#616161,color:#000

    style PG fill:#fff,stroke:#388e3c,color:#000
    style Redis fill:#fff,stroke:#388e3c,color:#000
    style MinIO fill:#fff,stroke:#388e3c,color:#000

    style MCP fill:#fff,stroke:#c2185b,color:#000
    style RAG fill:#fff,stroke:#c2185b,color:#000
```

### Why Hybrid?

**Problem Statement:**

- AI assistants need to traverse node hierarchies (projects → folders → files → blocks)
- Need to fetch related data in single query (node + children + tags + metadata)
- RAG pipeline requires efficient context gathering from graph structure
- LLMs work better with GraphQL's declarative query language than imperative tRPC calls

**Solution:**

- **tRPC for Mutations** - Type-safe, simple, fast for CRUD operations
- **GraphQL for Queries** - Flexible, powerful for graph traversal and AI context building
- **Shared Service Layer** - Both APIs use the same business logic (NodeService, PreferencesService, etc.)
- **Single Server** - Both run on same Fastify instance (different endpoints)

### Technology Choices

| Component                  | Technology     | Rationale                                              |
| -------------------------- | -------------- | ------------------------------------------------------ |
| **GraphQL Schema Builder** | Pothos GraphQL | Type-safe, code-first, best TypeScript inference       |
| **GraphQL Server**         | Apollo Server  | Industry standard, excellent tooling, mature ecosystem |
| **N+1 Prevention**         | DataLoader     | Batches and caches database queries                    |
| **Schema Approach**        | Code-first     | TypeScript types → GraphQL schema (type safety)        |

**Why NOT alternatives:**

- ❌ **Prisma** - We use Drizzle ORM, not Prisma
- ❌ **TypeGraphQL** - Pothos has better TypeScript inference
- ❌ **GraphQL Yoga** - Apollo has better Fastify integration
- ❌ **Mercurius** - Apollo's caching/DataLoader support is superior

### GraphQL Schema

**Core Types:**

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

### Use Cases

**1. AI Context Building**

Get full project tree with content for LLM context:

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

**2. Tag-Based Search (for RAG)**

Find related notes by tags:

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

**3. Hierarchical Navigation**

Get node with full context (ancestors + children):

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

### When to Use tRPC vs GraphQL

| Use Case            | API     | Reason                                     |
| ------------------- | ------- | ------------------------------------------ |
| Create node         | tRPC    | Type-safe mutation, simple validation      |
| Update node         | tRPC    | Type-safe mutation, optimistic updates     |
| Delete node         | tRPC    | Type-safe mutation, cascade handling       |
| Upload file         | tRPC    | Binary data, progress tracking             |
| Get single node     | Either  | tRPC for simple, GraphQL for relationships |
| Get node tree       | GraphQL | Graph traversal, nested queries            |
| Search by tags      | GraphQL | Complex filtering, relationships           |
| AI context building | GraphQL | Flexible queries, graph traversal          |
| RAG pipeline        | GraphQL | Vector search + graph traversal            |
