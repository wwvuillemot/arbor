# Arbor Development Roadmap

## Vision

Build a local-first, AI-powered writing assistant with hierarchical node-based data model, rich tagging, vector search, and integrated LLM chat with provenance tracking.

## Current Status

✅ **Phase 5: Provenance & Version Control — COMPLETE** (1054 tests passing)

🔶 **Phase 6: UX Improvements & Agent Management — MOSTLY COMPLETE** (4/5 done; 6.5 MCP panel pending)

📋 **Phase 7: AI-First Enhancements — PLANNED**

---

## Completed Phases

### Phase 0: Infrastructure ✅

- [x] Docker infrastructure (PostgreSQL, Redis, MinIO, pgAdmin, nginx proxy)
- [x] All services routed via `*.arbor.local` domains
- [x] Separate `arbor_dev` and `arbor_test` databases
- [x] Database migration system (Drizzle Kit, versioned migrations)
- [x] MinIO object storage (`arbor-media`, `arbor-exports`, `arbor-temp` buckets)
- [x] Node schema: JSONB content, `position`, `created_by`, `updated_by`, `metadata`
- [x] GraphQL server (Pothos + Apollo) mounted at `/graphql` on Fastify
  - [x] `node(id)`, `nodes(filter)`, `nodesByTags(tags, operator)` queries
  - [x] Relationship resolvers: parent, children, ancestors, descendants, project
  - [x] DataLoader batching (N+1 prevention)
  - [x] 24 tests passing
- [x] MCP server scaffold (`apps/mcp-server/`, JSONRPC 2.0, port 3849)

### Phase 1: Node Management & File System ✅

- [x] Markdown editor (TipTap, headless, Prosemirror-based)
- [x] File tree UI with expand/collapse, drag-drop, context menu
- [x] Media attachment system (MinIO upload, pre-signed URLs, thumbnail generation)
- [x] File CRUD (create, rename, move, copy, delete — with cascade)
- [x] PDF export pipeline (Pandoc + LaTeX)

### Phase 2: Tagging System ✅

- [x] Tags table with name, color, icon, type (`general`, `character`, `location`, `event`, `concept`)
- [x] Node-tag junction table with index
- [x] Tag management UI (create, edit, delete, color picker)
- [x] Tag picker in editor (multi-select, autocomplete, `#tagname` shorthand)
- [x] Entity tags: click to jump to dedicated entity node, auto-create if missing
- [x] Tag browser sidebar, tag cloud, AND/OR filter logic, related tag suggestions
- [x] All 13 tag tRPC endpoints covered by tests

### Phase 3: Search & RAG ✅

- [x] pgvector embeddings on nodes (1536-dim, OpenAI `text-embedding-3-small`)
- [x] HNSW index for cosine similarity search
- [x] BullMQ background queue for embedding generation (create/update triggers)
- [x] Keyword search (PostgreSQL full-text)
- [x] Vector search (semantic similarity, configurable `minScore`)
- [x] Hybrid search (weighted: `vectorWeight * vector + (1-vectorWeight) * keyword`)
- [x] RAG context builder (top-k retrieval → token-counted context string for LLM)
- [x] Search UI (filter panel, result cards with snippets, sort by relevance/date)

### Phase 4: Chat & LLM Integration ✅

- [x] Chat threads and messages tables
- [x] LLM provider abstraction (OpenAI, Anthropic, Google, Ollama, LocalLLM)
- [x] Streaming support, tool/function calling, vision inputs
- [x] MCP tools: `create_node`, `update_node`, `delete_node`, `move_node`, `list_nodes`, `search_nodes`, `search_semantic`, `add_tag`, `remove_tag`, `list_tags`, `export_to_pdf`, `attach_media`
- [x] Agent modes: `assistant` (all tools), `planner`, `editor`, `researcher`
- [x] Tool call visualization in chat UI (expandable inline)
- [x] Multi-thread chat UI with streaming message display
- [x] Reasoning model support (thinking token display)

### Phase 5: Provenance & Version Control ✅

- [x] `node_history` table (version, actor_type, actor_id, action, content_before/after, diff)
- [x] Change tracking on all node mutations (user + LLM attribution)
- [x] Diff viewer (side-by-side and inline)
- [x] Version rollback
- [x] Audit log UI (timeline, filter by actor/action/date, export CSV/PDF)
- [x] LLM attribution badges on nodes ("AI-assisted", "AI-generated")

---

## Phase 6: UX Improvements & Agent Management 🔶 MOSTLY COMPLETE

**Overall Progress:** 4 / 5 complete

- [x] **6.1** Unified filter panel — `filter-panel.tsx` with search, tag AND/OR selector, attribution buttons; wired into projects page
- [x] **6.2** Chat right sidebar — `chat-sidebar.tsx` flyout with resizable width, persisted preference, embedded ChatPanel; toggle in projects page
- [x] **6.3** Agent mode CRUD — `agent_modes` DB table, full service CRUD (blocks modifying built-ins), tRPC endpoints (`createAgentMode`, `updateAgentMode`, `deleteAgentMode`, `listAgentModes`)
- [x] **6.4** Independent model selection — `model` column on `chat_threads`, `model-selector.tsx` dropdown grouped by provider with capability metadata, persisted per thread
- [ ] **6.5** MCP tool visibility — tool calls render inline in chat messages ✅; missing: `mcp.listTools` tRPC endpoint and `McpToolsPanel` browse UI

### 6.5 MCP Tool Visibility 🔶 PARTIAL

**What's done:** Tool calls and results render inline in chat messages (`chat-message.tsx`) with expandable details.

**What's missing:** No way to browse available tools before using them.

**Key files:**

- `apps/api/src/api/routers/` — add `mcp.listTools` endpoint
- `apps/web/src/components/` — `McpToolsPanel` component

**Tasks:**

- [ ] **6.5a** Add `mcp.listTools` tRPC endpoint (name, description, input schema; cached)
- [ ] **6.5b** Build `McpToolsPanel` (expandable list, search, highlights tools active for current agent mode)
- [ ] **6.5c** Add to Settings → Developer section or ChatSidebar collapsible
- [ ] **6.5d** Tests + `make preflight` + commit

---

## Phase 7: AI-First Enhancements 📋 PLANNED

**Goal:** Make the LLM more capable, attribution more visual, content creation more powerful, and project identity more rich.

**Overall Progress:** 0 / 6 features complete

| Feature                              | Status          | Owner | PR  |
| ------------------------------------ | --------------- | ----- | --- |
| 7.1 Wire tool filtering              | ✅ DONE         | —     | —   |
| 7.2 AI/Human Tiptap attribution      | ✅ DONE         | —     | —   |
| 7.3 Multi-select bulk tagging        | 🔶 BACKEND DONE | —     | —   |
| 7.4 Favorites                        | 🔶 BACKEND DONE | —     | —   |
| 7.5 AI image generation              | 📋 TODO         | —     | —   |
| 7.6 Project hero image & description | 🔶 BACKEND DONE | —     | —   |

---

### 7.1 Wire Agent Mode Tool Filtering

**Problem:** `filterToolsForConfig()` exists in `agent-mode-helpers.ts` and is imported but never called. All 12 MCP tools are sent to the LLM regardless of agent mode. `planner` should only have 4 tools but currently gets all 12.

**Root cause:** `apps/api/src/services/chat-send-message-service.ts:81` fetches all tools and uses them directly, skipping `filterToolsForConfig()`.

**Architecture decision:** No new infrastructure. One call site change + tests.

**Key files:**

- `apps/api/src/services/chat-send-message-service.ts` (line 81 — add the call)
- `apps/api/src/services/agent-mode-helpers.ts` (`filterToolsForConfig` — already implemented)
- `apps/api/src/db/seed.ts` (agent mode `allowedTools` definitions)

**Tasks:**

- [ ] **7.1a** Write RED tests — these should FAIL before the fix
  - `tests/unit/services/chat-send-message-service.test.ts`: planner mode only receives its 4 allowed tools
  - `tests/unit/services/chat-send-message-service.test.ts`: editor mode only receives its 3 allowed tools
  - `tests/unit/services/chat-send-message-service.test.ts`: assistant mode receives all tools
- [ ] **7.1b** Fix: after `getMcpTools()`, call `filterToolsForConfig(agentModeConfig, tools)` and assign result back
- [ ] **7.1c** Confirm tests GREEN + `make preflight` + commit

**RED tests:**

```typescript
it("planner mode should only receive its 4 allowed tools", async () => {
  // set up thread with agentMode = 'planner'
  // spy on llmProvider.chat
  // assert tools arg only contains: create_node, move_node, list_nodes, add_tag
});

it("editor mode should only receive its 3 allowed tools", async () => {
  // assert tools arg only contains: update_node, search_nodes, list_nodes
});

it("assistant mode should receive all tools", async () => {
  // assert tools arg.length === totalMcpTools
});
```

---

### 7.2 AI vs Human Attribution in Tiptap Editor

**Problem:** Editor shows content but doesn't distinguish AI-generated text from human text. Provenance data exists (`node_history.actor_type`) but isn't surfaced in the editor.

**Architecture decision:** Custom TipTap `aiAttribution` Mark applied on load from version history. No new DB columns — `node_history.actor_type = 'llm'` already exists.

**Key files:**

- `apps/web/src/components/editor/tiptap-editor.tsx` — add mark extension + attribution loader
- `apps/web/src/styles/globals.css` — `.ai-attributed` CSS class
- `apps/api/src/api/routers/nodes.ts` — ensure `getHistory` returns `actor_type`
- `apps/web/src/components/provenance/version-history.tsx` — reference

**Tasks:**

- [x] **7.2a** Create `AiAttributionMark` extension (attributes: `modelName`, `timestamp`; renders `<span class="ai-attributed">`)
- [ ] **7.2b** Load attribution on editor mount: call `trpc.nodes.getHistory`, apply marks to LLM-authored ranges
- [x] **7.2c** Style: subtle left border + background tint; toolbar toggle (off by default, `Sparkles` icon)
- [x] **7.2d** Write RED tests → GREEN (64 tests passing)
  - attribution toggle button renders in toolbar
  - toggle calls `onToggleAttribution`
  - container gets `ai-attribution-visible` class; toggles off on second click
- [x] **7.2e** `make preflight` clean + commit

**RED tests:**

```typescript
it('should render ai-attributed spans for LLM-edited content', async () => {
  // mock getHistory to return actor_type: 'llm' entry
  render(<TiptapEditor nodeId="test" ... />);
  await waitFor(() => {
    expect(document.querySelector('.ai-attributed')).toBeInTheDocument();
  });
});

it('should hide attribution marks when toggle is off', async () => {
  // click toolbar toggle off
  expect(document.querySelector('.ai-attributed')).not.toBeVisible();
});
```

---

### 7.3 Multi-Select Bulk Tagging

**Problem:** Tags can only be applied one node at a time. Writers need to select 20 research notes and apply "chapter-3" in one action.

**Architecture decision:** Selection state as `Set<nodeId>` in FileTree. Bulk ops via `tags.bulkAddToNodes` / `tags.bulkRemoveFromNodes` tRPC calls. No new DB schema — loop existing `addTagToNode` server-side.

**Key files:**

- `apps/web/src/components/file-tree/file-tree.tsx` — selection state + checkbox UI
- `apps/web/src/components/file-tree/file-tree-node.tsx` — checkbox on hover
- `apps/api/src/api/routers/tags.ts` — `bulkAddToNodes`, `bulkRemoveFromNodes`
- `apps/api/src/services/tag-service.ts` — bulk methods

**Tasks:**

- [ ] **7.3a** Write RED tests
  - `bulkAddToNodes` applies tag to all provided node IDs
  - `bulkRemoveFromNodes` removes tag from all provided node IDs
  - checkbox appears on hover; selecting multiple shows `BulkTagBar`
- [ ] **7.3b** Add selection state to FileTree (`Cmd+click` / `Shift+click` for range; "3 selected" badge)
- [ ] **7.3c** Add `bulkAddToNodes` / `bulkRemoveFromNodes` endpoints + service methods
- [ ] **7.3d** Build `BulkTagBar` (tag picker, Add/Remove buttons, spinner, toast on completion)
- [ ] **7.3e** Confirm GREEN + `make preflight` + commit

**RED tests:**

```typescript
it("bulkAddToNodes should add tag to all specified nodes", async () => {
  const caller = createCaller();
  const tag = await caller.tags.create({ name: "BulkTag" });
  const project = await createTestProject();
  const note1 = await createTestNote(project.id, "N1");
  const note2 = await createTestNote(project.id, "N2");

  await caller.tags.bulkAddToNodes({
    nodeIds: [note1.id, note2.id],
    tagId: tag.id,
  });

  const tags1 = await caller.tags.getNodeTags({ nodeId: note1.id });
  const tags2 = await caller.tags.getNodeTags({ nodeId: note2.id });
  expect(tags1.map((t) => t.id)).toContain(tag.id);
  expect(tags2.map((t) => t.id)).toContain(tag.id);
});
```

---

### 7.4 Favorites

**Problem:** No way to bookmark frequently accessed nodes without restructuring the file tree.

**Architecture decision:** Store in `nodes.metadata.isFavorite` (boolean). No new table. Expose via `nodes.toggleFavorite` + `nodes.getFavorites`. Show pinned section at top of file tree.

**Key files:**

- `apps/api/src/api/routers/nodes.ts` — `toggleFavorite`, `getFavorites`
- `apps/api/src/services/node-service.ts` — `toggleFavorite(nodeId)`, `getFavoriteNodes(projectId)`
- `apps/web/src/components/file-tree/file-tree.tsx` — Favorites section at top
- `apps/web/src/components/file-tree/file-tree-node.tsx` — star icon toggle

**Tasks:**

- [ ] **7.4a** Write RED tests
  - `toggleFavorite` sets `metadata.isFavorite = true` then back to `false` on second call
  - `getFavorites` returns only favorited nodes for the project
  - clicking star calls `toggleFavorite`; node appears in Favorites section
- [ ] **7.4b** Add `toggleFavorite` + `getFavoriteNodes` to NodeService
- [ ] **7.4c** Add tRPC endpoints (`nodes.toggleFavorite`, `nodes.getFavorites`)
- [ ] **7.4d** Add star icon (☆/★) to FileTreeNode (hover to show, always visible when favorited)
- [ ] **7.4e** Add Favorites pinned section above file tree (collapse/expand, empty state)
- [ ] **7.4f** Confirm GREEN + `make preflight` + commit

**RED tests:**

```typescript
it("toggleFavorite should mark node as favorite", async () => {
  const caller = createCaller();
  const project = await createTestProject();
  const note = await createTestNote(project.id);

  const updated = await caller.nodes.toggleFavorite({ nodeId: note.id });
  expect(updated.metadata?.isFavorite).toBe(true);

  const favorites = await caller.nodes.getFavorites({ projectId: project.id });
  expect(favorites.map((n) => n.id)).toContain(note.id);
});

it("toggleFavorite twice should unfavorite the node", async () => {
  // call twice, expect isFavorite = false and getFavorites excludes it
});
```

---

### 7.5 AI Image Generation with Style Consistency

**Problem:** Writers want to generate character art and scene illustrations from within Arbor, with consistent visual style across all project images.

**Architecture decision:**

- **No platform sandbox** — call OpenAI Images API (`/v1/images/generations`) server-side directly
- **Sub-agent pattern** — orchestrator calls `generate_image` MCP tool; tool handles OpenAI → download → MinIO upload → `mediaAttachment` record → returns attachment ID
- **Style profile** — stored in `nodes.metadata.styleProfile` on the project node: `{ artStyle, colorPalette, moodKeywords, negativeKeywords }`. No migration needed.
- **Prompt construction** — style profile prepended server-side automatically

**Key files:**

- `apps/api/src/services/image-generation-service.ts` (NEW)
- `apps/api/src/api/routers/media.ts` — `generateImage` endpoint
- `apps/api/src/services/mcp-integration-service.ts` — register `generate_image` tool
- `apps/web/src/components/editor/image-upload.tsx` — "Generate with AI" tab

**Tasks:**

- [ ] **7.5a** Write RED tests
  - `ImageGenerationService` prepends style profile to prompt
  - uploads buffer to MinIO and creates `mediaAttachment` record with `metadata.generated = true`
  - handles OpenAI API error gracefully
  - `generate_image` MCP tool is registered and callable
- [ ] **7.5b** Create `ImageGenerationService` (fetch project style → build prompt → call DALL-E 3 → upload to MinIO → create attachment record)
- [ ] **7.5c** Register `generate_image` MCP tool in `mcp-integration-service.ts`
- [ ] **7.5d** Add `media.generateImage` tRPC endpoint
- [ ] **7.5e** Add "Generate with AI" tab to `ImageUploadDialog` (prompt input, style preview, ~10s loading state)
- [ ] **7.5f** Confirm GREEN + `make preflight` + commit

**RED tests:**

```typescript
it("should prepend project style profile to prompt", async () => {
  const project = await nodeService.createNode({
    type: "project",
    name: "Test",
  });
  await nodeService.updateNode(project.id, {
    metadata: { styleProfile: { artStyle: "watercolor illustration" } },
  });

  const mockOpenAI = {
    images: {
      generate: vi.fn().mockResolvedValue({ data: [{ b64_json: "abc" }] }),
    },
  };
  const service = new ImageGenerationService(
    mockOpenAI as any,
    minioService,
    db,
  );
  await service.generateImage("a dragon", project.id, {});

  expect(mockOpenAI.images.generate).toHaveBeenCalledWith(
    expect.objectContaining({
      prompt: expect.stringContaining("watercolor illustration"),
    }),
  );
});

it("should create a mediaAttachment record after generation", async () => {
  // after generateImage, query mediaAttachments; expect metadata.generated === true
});
```

---

### 7.6 Project Hero Image and Description

**Problem:** Projects page is a flat list. Writers can't tell projects apart at a glance or communicate tone/premise.

**Architecture decision:** Hero image stored as `mediaAttachment` with `metadata.role = 'hero'`. Short logline stored in new `nodes.summary` column (requires migration). Projects page becomes a visual card grid.

**Key files:**

- `apps/api/src/db/schema.ts` — add `summary TEXT` column
- `apps/api/src/db/migrations/` — generate + apply migration
- `apps/api/src/api/routers/nodes.ts` — expose `summary`; add `setHeroImage` endpoint
- `apps/web/src/app/[locale]/(app)/projects/page.tsx` — card grid redesign

**Tasks:**

- [ ] **7.6a** Write RED tests
  - `summary` field is saved and returned on create/update
  - `setHeroImage` sets `metadata.heroAttachmentId`
  - projects page renders cards with name and summary
  - hero image renders when `heroAttachmentId` is set
- [ ] **7.6b** Add `summary` column: update schema, run `make db-generate` + `make db-migrate`, update NodeService
- [ ] **7.6c** Add `nodes.setHeroImage({ nodeId, attachmentId })` + `nodes.getHeroImage({ nodeId })` endpoints
- [ ] **7.6d** Redesign Projects page as card grid (hero image or gradient placeholder, name, summary, tag chips, last-updated; responsive 1/2/3 col)
- [ ] **7.6e** Add project settings panel (Name, Summary, Hero Image, Description, Style Profile for 7.5)
- [ ] **7.6f** Confirm GREEN + `make preflight` + commit

**RED tests:**

```typescript
it("should save and return summary field", async () => {
  const caller = createCaller();
  const project = await createTestProject();
  const updated = await caller.nodes.update({
    id: project.id,
    summary: "A sweeping epic about dragons and destiny",
  });
  expect(updated.summary).toBe("A sweeping epic about dragons and destiny");
});

it("setHeroImage should store attachmentId in metadata", async () => {
  const caller = createCaller();
  const project = await createTestProject();
  const updated = await caller.nodes.setHeroImage({
    nodeId: project.id,
    attachmentId: "attach-123",
  });
  expect(updated.metadata?.heroAttachmentId).toBe("attach-123");
});
```

---

### Phase 7 Architecture Notes

**Build order (recommended):**

| Order | Feature                 | Reason                                                 |
| ----- | ----------------------- | ------------------------------------------------------ |
| 1     | 7.1 Tool filtering      | Zero-risk 1-line fix; unblocks testing other modes     |
| 2     | 7.4 Favorites           | Self-contained; no new DB migration                    |
| 3     | 7.3 Bulk tagging        | Reuses existing tag infrastructure                     |
| 4     | 7.6 Project hero image  | DB migration; sets up style profile for 7.5            |
| 5     | 7.5 AI image generation | Requires style profile (7.6) and MinIO (already done)  |
| 6     | 7.2 Tiptap attribution  | Most complex frontend; requires stable provenance data |

**Scaling note:** When MCP tool count exceeds ~30, replace the static `allowedTools[]` list with pgvector tool retrieval — embed tool descriptions, retrieve top-K per query via cosine similarity. Arbor already has the embedding infrastructure from Phase 3.

**Sub-agent pattern:** For 7.5 and future multi-step actions, the orchestrator LLM calls a specialist tool rather than handling side-effects directly. The tool owns the full lifecycle (API call → download → storage → record creation) and returns a clean result. The orchestrator never touches bytes.
