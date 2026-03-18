# Arbor Development Roadmap

## Vision

Build a local-first, AI-powered writing assistant with a hierarchical node graph, rich tagging, vector search, integrated chat, and provenance-aware editing.

## Planning Principles

- Ship in small vertical slices.
- Use Red/Green TDD for every new feature and bug fix.
- Move incrementally through the stack: service/data → router/API → UI → integration coverage.
- Reconcile roadmap status to shipped code before planning net-new work.
- Prefer extending current systems over parallel rewrites.

## Current Status

- ✅ **Phases 0–5 are complete**: core infrastructure, nodes, tags, search, chat, provenance.
- 🔶 **Phase 6 is mostly complete**: the remaining gap is primarily MCP tool-browser surfacing/polish, not greenfield implementation.
- 🔶 **Phase 7 is partially shipped**: several items previously marked planned are already live in the codebase.
- 📋 **Phase 8 is the active roadmap**: reliability, collaboration safety, agent workflow orchestration, and export improvements.

## Reconciled Status Snapshot

| Area                             | Current status      | Notes                                                                                      |
| -------------------------------- | ------------------- | ------------------------------------------------------------------------------------------ |
| MCP tool filtering               | ✅ Shipped          | `filterToolsForConfig(...)` is active in `chat-send-message-service.ts`                    |
| MCP tool browser                 | 🔶 Partial          | `mcp.listTools` endpoint and `McpToolsPanel` component exist; primary UX placement remains |
| Bulk tagging                     | ✅ Shipped          | bulk tag router/service, selection UI, context-menu entry, and `BulkTagBar` are present    |
| Favorites                        | ✅ Shipped          | favorite service/router plus file-tree and dashboard surfaces are present                  |
| Project summary + hero image     | ✅ Shipped baseline | `summary` column, `setHeroImage`, project cards, and settings wiring exist                 |
| Node history / compare / restore | ✅ Shipped          | provenance APIs plus projects-page History dialog and restore flow are live                |
| Agent contribution highlighting  | 🔶 Partial baseline | node-level attribution exists; exact range highlighting still needs dedicated work         |

## Completed Phases

### Phase 0: Infrastructure ✅

- Docker development stack, split dev/test databases, and versioned migrations
- MinIO-backed object storage and core node schema
- GraphQL server with relationship resolvers and batching
- MCP server scaffold

### Phase 1: Node Management & File System ✅

- TipTap editor
- File tree with drag/drop and context menus
- Media attachment system
- File CRUD and recursive operations
- Existing PDF export pipeline foundation

### Phase 2: Tagging System ✅

- Tag schema and node-tag relations
- Tag management UI and tag picker
- Entity-tag navigation helpers
- Tag browser, cloud, and filters

### Phase 3: Search & RAG ✅

- Embeddings, HNSW vector search, and hybrid retrieval
- Background embedding generation
- Search UI and RAG context builder

### Phase 4: Chat & LLM Integration ✅

- Chat threads/messages and provider abstraction
- Tool calling, streaming, and agent modes
- Chat UI with tool-call visualization

### Phase 5: Provenance & Version Control ✅

- Node history and diff tracking
- Rollback and audit log foundations
- Attribution badges and provenance APIs

## Phase 6: UX Improvements & Agent Management 🔶 Mostly Complete

- [x] **6.1 Unified filter panel**
- [x] **6.2 Chat right sidebar**
- [x] **6.3 Agent mode CRUD**
- [x] **6.4 Independent model selection**
- [ ] **6.5 MCP tool visibility polish**

### 6.5 MCP Tool Visibility — Reconciled Scope

#### 6.5 Already present

- `mcp.listTools` router endpoint
- `McpToolsPanel` browse/search component
- inline tool-call rendering in chat messages

#### 6.5 Still worth doing

- surface the panel in the primary chat/settings UX
- make active/permitted tools obvious for the selected agent mode
- add targeted component/integration coverage for discoverability

## Phase 7: AI-First Enhancements 🔶 Reconciled

This phase is no longer “planned from scratch.” Several items are already shipped and should be treated as baseline product capability.

| Item                                 | Status              | Roadmap interpretation                                                     |
| ------------------------------------ | ------------------- | -------------------------------------------------------------------------- |
| 7.1 Tool filtering                   | ✅ Shipped          | maintain with tests; not a new feature                                     |
| 7.2 AI/Human attribution             | 🔶 Partial          | keep baseline; exact content-range highlighting moves to Phase 8.7         |
| 7.3 Bulk tagging                     | ✅ Shipped          | expand only if UX gaps remain                                              |
| 7.4 Favorites                        | ✅ Shipped baseline | maintain and polish; adjacent recents/collapse-state UX moves to Phase 8.3 |
| 7.5 AI image generation              | 📋 Planned          | still real roadmap work                                                    |
| 7.6 Project hero image + summary     | ✅ Shipped baseline | continue with polish/style-profile support as needed                       |
| 7.7 Node history / compare / restore | ✅ Shipped          | user ask already satisfied                                                 |

## Phase 8: Reliability, Collaboration, and Agent Workflows 📋 Active Roadmap

### Recommended Delivery Order

| Order | Workstream                                                  | Why first                                                                  |
| ----- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1     | 8.1 Selected-node live refresh + remaining chat correctness | immediate user-facing correctness pain; stabilizes note/chat state         |
| 2     | 8.2 Chat authoring UX + node context injection              | high-frequency chat workflow improvement with existing composer groundwork |
| 3     | 8.3 Navigation memory + sidebar polish                      | high-frequency navigation polish with low architecture risk                |
| 4     | 8.4 Ontology navigation                                     | high-value reading/navigation improvement on current notes                 |
| 5     | 8.5 Semaphore lock                                          | protects content from human/agent collisions                               |
| 6     | 8.6 Agent task list                                         | improves reliability of longer agent workflows                             |
| 7     | 8.7 Project memory                                          | enables higher-quality continuity across chats                             |
| 8     | 8.8 Agent orchestration                                     | depends on tasks and shared memory being real                              |
| 9     | 8.9 Fine-grained agent contribution highlighting            | extends current provenance baseline                                        |
| 10    | 8.10 Folder/project subtree export to single PDF            | builds on current export pipeline                                          |

### Already Delivered from the New Ask List

- **Rollback to previous version** is already shipped via provenance history, compare, and restore in the app.
- **Chat composer local-draft isolation + capped auto-grow** are now shipped baseline.
- The roadmap work here is no longer “make chat minimally usable,” but rather layer richer context injection, authoring, and navigation-state UX onto the stabilized baseline.

### 8.1 Selected-Node Live Refresh + Remaining Chat Correctness

#### 8.1 Current baseline

- duplicate optimistic-message rendering has been addressed in the web chat flow
- composer typing churn has been reduced by localizing draft state
- selected-node refresh after agent-backed updates still needs a reliable end-to-end path

#### 8.1 Problems

- when an agent updates the selected node, the browser view does not refresh until navigation changes
- remaining chat correctness should reuse one shared invalidation path rather than add one-off refresh hacks

#### 8.1 Likely touch points

- `apps/web/src/components/chat/chat-panel.tsx`
- `apps/web/src/app/[locale]/(app)/projects/page.tsx`
- `apps/api/src/api/routers/chat.ts`

#### 8.1 Incremental TDD slices

1. **RED:** add a page/integration test proving a selected node refreshes after an agent-backed node update.
2. **GREEN:** first ship invalidation/refetch-based live refresh for the selected node; defer real-time subscriptions unless needed.
3. **RED:** add a web test proving chat-originated and non-chat agent updates both hit the same refresh behavior.
4. **GREEN:** centralize “node freshness” logic so chat mutations and other agent updates share one path.
5. **REFACTOR:** only consider subscriptions/push updates after the invalidation path is stable and tested.

### 8.2 Chat Authoring UX + Node Context Injection

#### 8.2 Problem

Users need a faster way to inject project-node context into chat while composing prompts, plus the remaining chat-authoring improvements already requested.

#### 8.2 Current baseline

- composer auto-grow to a readable maximum height is shipped
- `contextNodeIds` support already exists in the send path
- context selection is still clunky/manual from the surrounding UI rather than inline in the composer

#### 8.2 Likely touch points

- `apps/web/src/components/chat/chat-panel.tsx`
- chat composer helpers/components adjacent to `ChatPanel`
- node search/query surfaces used to filter project nodes for selection

#### 8.2 Incremental TDD slices

1. **RED:** add composer tests for detecting `@` and `#` triggers, filtering project nodes by typed text, and navigating results with keyboard/mouse.
2. **GREEN:** add an inline mention-style picker that converts a selected node into explicit injected context instead of raw prompt text hacks.
3. **RED:** add web tests for multiple injected context items, removal/backspace behavior, and preserving Enter/Shift+Enter send semantics.
4. **GREEN:** wire injected items to the existing `contextNodeIds` send path and render clear chips/tokens in the composer.
5. **RED:** add web tests for a markdown-friendly authoring mode that preserves current send behavior.
6. **GREEN:** introduce markdown editor support for input messages.
7. **RED:** add tests for queueing messages while an agent response is in progress, including edit/delete and force-submit behavior.
8. **GREEN:** ship editable queued messages on top of the stabilized composer.

### 8.3 Navigation Memory + Sidebar Polish

#### 8.3 Problem

The sidebar should remember recent work and preserve collapse-state UX across reloads instead of resetting every session.

#### 8.3 Current baseline

- Favorites exist today
- sidebar collapse exists but resets on reload
- there is no Recents section for the last opened nodes

#### 8.3 Likely touch points

- projects page/sidebar navigation components
- favorites/section chrome components
- device-local storage and/or preferences persistence if user-scoped sync becomes necessary

#### 8.3 Incremental TDD slices

1. **RED:** add component tests for recording recently opened nodes and showing the latest five in a collapsible Recents section.
2. **GREEN:** add device-scoped Recents tracking driven by actual node-open events.
3. **RED:** add component tests proving collapsed Favorites and Recents retain the bottom divider/border chrome.
4. **GREEN:** ship consistent collapsed-section borders across sidebar sections.
5. **RED:** add tests proving the sidebar collapsed state survives reloads and is restored on first render.
6. **GREEN:** persist sidebar collapse state device-local first; only extend to user-scoped sync if cross-device continuity becomes a real requirement.
7. **RED/GREEN:** optionally persist Favorites/Recents expanded-state too if the base sidebar persistence lands cleanly and users still want it.

### 8.4 Ontology Navigation

#### 8.4 Problem

In read-only mode, a note should show cards for linked notes at the bottom, and ideally reciprocal backlinks as well.

#### 8.4 Likely touch points

- `apps/web/src/app/[locale]/(app)/projects/page.tsx`
- editor/linking utilities
- node query/router surface for outgoing and incoming links

#### 8.4 Incremental TDD slices

1. **RED:** add parser/service tests that extract Arbor note-link references from stored content.
2. **GREEN:** add API support for `getLinkedNodes({ nodeId, direction })` for outgoing links first.
3. **RED:** add page tests for showing outgoing linked-note cards beneath read-only content.
4. **GREEN:** ship outgoing links UI in projects page.
5. **RED/GREEN:** add reciprocal backlinks as a second slice, not in the first cut.

### 8.5 Semaphore Lock / Edit Queue

#### 8.5 Problem

Human edits and agent edits can collide. We need a visible lock or queue with manual release to avoid deadlocks.

#### 8.5 Architecture direction

Start with a simple exclusive lock plus TTL and manual force-release. Add queueing only after lock semantics are stable.

#### 8.5 Incremental TDD slices

1. **RED:** service tests for acquire, reject-on-conflict, release, expire, and force-release.
2. **GREEN:** add persistent lock state and a `NodeLockService`.
3. **RED:** router/integration tests for lock-aware update attempts from both user and agent flows.
4. **GREEN:** surface lock badge, disable editing while locked, and provide manual unlock UI.
5. **RED/GREEN:** add queueing only after exclusive-lock behavior is stable and tested.

### 8.6 Agent Task List

#### 8.6 Problem

Agents need a structured planning surface so they can create a plan, track progress, and execute in steps rather than keeping everything implicit in chat text.

#### 8.6 Incremental TDD slices

1. **RED:** service tests for chat-scoped task CRUD, ordering, status changes, and parent/child tasks.
2. **GREEN:** add task persistence and chat-scoped task APIs.
3. **RED:** add agent-tool tests proving agents can list/create/update tasks within a chat.
4. **GREEN:** add a task-list panel in chat UI with explicit planning vs execution states.
5. **REFACTOR:** add project roll-ups later only if the chat-scoped model works well first.

### 8.7 Project Memory (Per Project)

#### 8.7 Problem

Agents need shared project memory for preferences, observations, and durable context across chats.

#### 8.7 Architecture direction

Use explicit project-scoped memory entries first; do not start with opaque long-context prompt stuffing.

#### 8.7 Incremental TDD slices

1. **RED:** service tests for create/update/delete/search of project memory entries.
2. **GREEN:** add project-memory storage plus retrieval APIs.
3. **RED:** chat-service tests proving relevant memory is injected into prompt construction by project.
4. **GREEN:** add memory management UI with provenance/citation back to source entries.
5. **REFACTOR:** add summarization/compaction once real usage patterns exist.

### 8.8 Agent Orchestration

#### 8.8 Problem

Agents should be able to delegate subtasks to specialist agents, but only with clear boundaries and visible results.

#### 8.8 Architecture direction

Do not start with unrestricted multi-agent swarms. Start with one parent run delegating to one specialist run and returning artifacts.

#### 8.8 Incremental TDD slices

1. **RED:** orchestration-service tests for spawning a delegated run, passing scoped context, and collecting results.
2. **GREEN:** add a limited orchestration service with explicit specialist selection.
3. **RED:** add chat integration coverage for a parent assistant delegating a bounded task.
4. **GREEN:** expose delegated-run events/results in chat UI.
5. **REFACTOR:** add cancellation, concurrency limits, and richer delegation rules later.

### 8.9 Fine-Grained Agent Contribution Highlighting

#### 8.9 Problem

We already know whether AI touched a node. We do not yet show exactly which content ranges were created or modified by AI versus the human author.

#### 8.9 Current baseline

- provenance history exists
- node-level attribution exists
- compare/restore exists
- editor attribution UI groundwork exists

#### 8.9 Incremental TDD slices

1. **RED:** add pure unit tests for converting provenance diffs/version comparisons into stable content ranges.
2. **GREEN:** implement range derivation from provenance/version data.
3. **RED:** add web tests for toggling highlights on read-only note cards and in the editor.
4. **GREEN:** ship highlight overlays/tinted ranges with actor/model tooltips.
5. **REFACTOR:** merge adjacent ranges, improve readability, and let users filter by actor type.

### 8.10 Folder / Project Subtree Export to a Single PDF

#### 8.10 Problem

Users should be able to right-click a folder or project and export its entire subtree as one ordered PDF, especially for book-like projects.

#### 8.10 Current baseline

- HTML export paths already exist
- a PDF pipeline already exists elsewhere in the stack
- what is missing is recursive subtree assembly and a clean single-document export flow

#### 8.10 Incremental TDD slices

1. **RED:** add service tests that collect a node subtree in deterministic order and compile it into one export document.
2. **GREEN:** add subtree HTML/Markdown export support for folders and projects.
3. **RED:** add router/UI coverage for context-menu export on folders/projects.
4. **GREEN:** connect compiled export output to the existing PDF pipeline and download flow.
5. **REFACTOR:** add title pages, table of contents, page-break rules, and book-oriented formatting after the basic export works.

## Cross-Cutting Delivery Rules for Phase 8

- Every item starts with a failing targeted test.
- Prefer one small vertical slice per PR.
- Keep integration tests real; avoid mocks there.
- Reuse provenance, export, chat, and sidebar-state infrastructure already in the repo.
- When a feature depends on another roadmap item, ship the dependency first rather than building around it.

## Immediate Next Implementation Recommendation

Proceed in this order:

1. finish **Phase 8.1** selected-node live refresh on top of the already-stabilized chat correctness baseline
2. then ship **Phase 8.2** inline `@` / `#` node-context injection as the next high-frequency chat workflow improvement
3. then ship **Phase 8.3** Recents + collapsed-border polish + persisted sidebar state

That order keeps the roadmap aligned with the most frequent user pain: first correctness, then faster chat composition, then navigation/session-state polish.
