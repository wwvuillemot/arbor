import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  integer,
  bigint,
  timestamp,
  index,
  primaryKey,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Vector embedding dimensions for different models:
// - OpenAI text-embedding-3-small: 1536
// - OpenAI text-embedding-3-large: 3072
// - Cohere embed-english-v3.0: 1024
// - all-MiniLM-L6-v2 (local): 384
// Default: 1536 (OpenAI text-embedding-3-small)
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Node Types Hierarchy:
 *
 * Project (top-level, parent_id = NULL)
 * └── Folder
 *     └── Folder (nested)
 *         └── Note/File
 *
 * This allows organizing multiple writing projects:
 * - "My Novel" (project)
 * - "D&D Campaign: Lost Mines" (project)
 * - "Short Story Collection" (project)
 */

export const nodeTypeEnum = [
  "project",
  "folder",
  "note",
  "link",
  "ai_suggestion",
  "audio_note",
] as const;
export type NodeType = (typeof nodeTypeEnum)[number];

export const authorTypeEnum = ["human", "ai", "mixed"] as const;
export type AuthorType = (typeof authorTypeEnum)[number];

export const nodes = pgTable(
  "nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Self-referential hierarchy
    // NULL for top-level projects, otherwise references parent node
    parentId: uuid("parent_id").references(() => nodes.id, {
      onDelete: "cascade",
    }),

    // Node type: project, folder, note, link, ai_suggestion, audio_note
    type: varchar("type", { length: 50 }).notNull(),

    // Display name
    name: varchar("name", { length: 255 }).notNull(),

    // URL-friendly identifier (optional, for sharing/linking)
    slug: varchar("slug", { length: 255 }),

    // Rich content (JSONB for structured data like TipTap/ProseMirror documents)
    // Phase 0.2: Changed from TEXT to JSONB for structured content
    // Examples:
    // - TipTap: {"type": "doc", "content": [{"type": "paragraph", "content": [...]}]}
    // - Plain text: {"text": "Simple markdown content"}
    // - null for folders/projects
    content: jsonb("content"),

    // Position for sibling ordering (drag-drop reordering)
    // Phase 0.2: Added for UI ordering within same parent
    // Lower numbers appear first, gaps are allowed (0, 10, 20, ...)
    position: integer("position").default(0).notNull(),

    // Flexible metadata per node type (JSONB)
    // Examples:
    // - project: {"description": "...", "status": "active", "created_date": "2024-01-01"}
    // - folder: {"color": "#3b82f6", "icon": "folder"}
    // - note: {"tags": ["writing", "ideas"], "word_count": 1500, "reading_time": 6}
    // - link: {"source_id": "uuid", "target_id": "uuid", "link_type": "references"}
    // - ai_suggestion: {"original_text": "...", "suggested_text": "...", "status": "pending"}
    // - audio_note: {"duration": 120, "transcription_id": "uuid", "audio_url": "/files/..."}
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),

    // Provenance tracking: who created this node
    // Phase 0.2: Added for LLM attribution
    // Format: "user:{user_id}" or "llm:{model_name}"
    // Examples: "user:alice", "llm:gpt-4o", "llm:claude-3.5-sonnet"
    createdBy: varchar("created_by", { length: 255 })
      .default("user:system")
      .notNull(),

    // Provenance tracking: who last updated this node
    // Phase 0.2: Added for LLM attribution
    // Format: "user:{user_id}" or "llm:{model_name}"
    updatedBy: varchar("updated_by", { length: 255 })
      .default("user:system")
      .notNull(),

    // Track authorship (human, ai, mixed) - DEPRECATED in favor of createdBy/updatedBy
    // Keeping for backward compatibility, will remove in future migration
    authorType: varchar("author_type", { length: 20 }).default("human"),

    // Vector embedding for semantic search (pgvector)
    // Dimensions: 1536 (OpenAI text-embedding-3-small default)
    // Nullable: not all nodes need embeddings (e.g., folders, projects)
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),

    // Soft delete
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    // Indexes for performance
    parentIdIdx: index("idx_nodes_parent").on(table.parentId),
    typeIdx: index("idx_nodes_type").on(table.type),
    slugIdx: index("idx_nodes_slug").on(table.slug),
    deletedAtIdx: index("idx_nodes_deleted_at").on(table.deletedAt),
    // HNSW index for fast approximate nearest neighbor search on embeddings
    // HNSW is preferred over IVFFlat for better recall and no need for training
    embeddingIdx: index("idx_nodes_embedding").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  }),
);

// Type inference for TypeScript
export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;

/**
 * User Preferences Table
 *
 * Stores app-scope preferences that persist across sessions.
 * Session-scope preferences are stored in Redis and not persisted here.
 *
 * For now, we use a single "default" user since we don't have auth yet.
 * When auth is added, we'll add a userId column.
 */
export const userPreferences = pgTable(
  "user_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Preference key (e.g., 'theme', 'language', 'sidebarWidth')
    key: varchar("key", { length: 255 }).notNull().unique(),

    // Preference value (stored as JSONB for flexibility)
    // Examples:
    // - theme: {"mode": "dark", "accentColor": "#3b82f6"}
    // - language: {"locale": "en-US"}
    // - editor: {"fontSize": 16, "lineHeight": 1.6, "fontFamily": "monospace"}
    value: jsonb("value").notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Index for fast key lookups
    keyIdx: index("idx_user_preferences_key").on(table.key),
  }),
);

// Type inference for TypeScript
export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;

/**
 * App Settings Table
 *
 * Stores encrypted sensitive settings (API keys, tokens, etc.).
 * All values are encrypted at rest using AES-256-GCM with a master key
 * stored in the OS keychain.
 *
 * Separation of concerns:
 * - app_preferences: Non-sensitive user choices (theme, language)
 * - app_settings: Encrypted sensitive data (API keys, tokens)
 */
export const appSettings = pgTable(
  "app_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Setting key (e.g., 'openai_api_key', 'anthropic_api_key')
    key: varchar("key", { length: 255 }).notNull().unique(),

    // Encrypted value (base64-encoded ciphertext + auth tag)
    encryptedValue: text("encrypted_value").notNull(),

    // Initialization vector for AES-256-GCM (base64-encoded, 12 bytes)
    iv: text("iv").notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Index for fast key lookups
    keyIdx: index("idx_app_settings_key").on(table.key),
  }),
);

// Type inference for TypeScript
export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;

/**
 * Media Attachments Table
 *
 * Tracks media files stored in MinIO (S3-compatible object storage).
 * Each attachment is linked to a node (e.g., images in a note, audio for audio_note).
 *
 * Storage strategy:
 * - Object key format: {project_id}/{node_id}/{timestamp}_{filename}
 * - Bucket: "arbor-media" for all media
 * - Pre-signed URLs for secure download (expire after 1 hour)
 */
export const mediaAttachments = pgTable(
  "media_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // The node this attachment belongs to
    nodeId: uuid("node_id")
      .references(() => nodes.id, { onDelete: "cascade" })
      .notNull(),

    // MinIO bucket name (e.g., "arbor-media")
    bucket: varchar("bucket", { length: 255 }).notNull(),

    // MinIO object key (e.g., "{project_id}/{node_id}/{timestamp}_{filename}")
    objectKey: varchar("object_key", { length: 1024 }).notNull(),

    // Original filename as uploaded by the user
    filename: varchar("filename", { length: 255 }).notNull(),

    // MIME type (e.g., "image/png", "audio/mp3", "application/pdf")
    mimeType: varchar("mime_type", { length: 255 }).notNull(),

    // File size in bytes
    size: bigint("size", { mode: "number" }).notNull(),

    // Flexible metadata (e.g., dimensions, duration, thumbnail key)
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),

    // Provenance: who uploaded this attachment
    // Format: "user:{id}" or "llm:{model}"
    createdBy: varchar("created_by", { length: 255 })
      .default("user:system")
      .notNull(),
  },
  (table) => ({
    // Index for fast lookup by node
    nodeIdIdx: index("idx_media_node").on(table.nodeId),
    // Index for fast lookup by bucket + object key
    bucketKeyIdx: index("idx_media_bucket_key").on(
      table.bucket,
      table.objectKey,
    ),
  }),
);

// Type inference for TypeScript
export type MediaAttachment = typeof mediaAttachments.$inferSelect;
export type NewMediaAttachment = typeof mediaAttachments.$inferInsert;

/**
 * Tags Table
 *
 * Stores tag definitions with name, color, icon, and type.
 * Tags can be of different types (general, character, location, event, concept)
 * to support rich entity tagging in writing projects.
 */
export const tagTypeEnum = [
  "general",
  "character",
  "location",
  "event",
  "concept",
] as const;
export type TagType = (typeof tagTypeEnum)[number];

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Tag display name (e.g., "protagonist", "magic system", "New York")
    name: varchar("name", { length: 255 }).notNull(),

    // Hex color for visual display (e.g., "#3b82f6")
    color: varchar("color", { length: 7 }),

    // Icon name from Lucide icons (e.g., "user", "map-pin", "sword")
    icon: varchar("icon", { length: 50 }),

    // Tag type for categorization
    type: varchar("type", { length: 50 }).default("general").notNull(),

    // Optional reference to a dedicated entity node (character sheet, location page, etc.)
    // Only meaningful for entity-type tags: character, location, event, concept
    entityNodeId: uuid("entity_node_id").references(() => nodes.id, {
      onDelete: "set null",
    }),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Index for searching tags by name
    nameIdx: index("idx_tags_name").on(table.name),
    // Index for filtering tags by type
    typeIdx: index("idx_tags_type").on(table.type),
    // Index for looking up entity node links
    entityNodeIdx: index("idx_tags_entity_node").on(table.entityNodeId),
  }),
);

// Type inference for TypeScript
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

/**
 * Node Tags Junction Table
 *
 * Many-to-many relationship between nodes and tags.
 * Allows assigning multiple tags to any node and querying
 * nodes by their tags.
 */
export const nodeTags = pgTable(
  "node_tags",
  {
    // The node being tagged
    nodeId: uuid("node_id")
      .references(() => nodes.id, { onDelete: "cascade" })
      .notNull(),

    // The tag being assigned
    tagId: uuid("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),

    // When the tag was assigned to this node
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Composite primary key (each node-tag pair is unique)
    pk: primaryKey({ columns: [table.nodeId, table.tagId] }),
    // Index for finding all tags for a node
    nodeIdIdx: index("idx_node_tags_node").on(table.nodeId),
    // Index for finding all nodes with a tag
    tagIdIdx: index("idx_node_tags_tag").on(table.tagId),
  }),
);

// Type inference for TypeScript
export type NodeTag = typeof nodeTags.$inferSelect;
export type NewNodeTag = typeof nodeTags.$inferInsert;

/**
 * Chat Thread Agent Modes
 *
 * Different modes change the AI behavior and available tools:
 * - assistant: General-purpose helper with all tools
 * - planner: Focus on structure and organization
 * - editor: Content refinement and improvement
 * - researcher: Information gathering and synthesis
 */
export const agentModeEnum = [
  "assistant",
  "planner",
  "editor",
  "researcher",
] as const;
export type AgentMode = (typeof agentModeEnum)[number];

/**
 * Chat Message Roles
 *
 * Standard message roles for LLM conversation:
 * - user: Messages from the human user
 * - assistant: Messages from the AI model
 * - system: System prompt / instructions
 * - tool: Tool call results
 */
export const chatRoleEnum = ["user", "assistant", "system", "tool"] as const;
export type ChatRole = (typeof chatRoleEnum)[number];

/**
 * Chat Threads Table
 *
 * Stores conversation threads linked to projects.
 * Each thread maintains its own agent mode and message history.
 */
export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // The project this chat thread belongs to (optional)
    projectId: uuid("project_id").references(() => nodes.id, {
      onDelete: "cascade",
    }),

    // Thread display name
    name: varchar("name", { length: 255 }).notNull(),

    // Agent mode for this thread
    agentMode: varchar("agent_mode", { length: 50 })
      .default("assistant")
      .notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Index for finding threads by project
    projectIdIdx: index("idx_chat_threads_project").on(table.projectId),
    // Index for sorting by updated time
    updatedAtIdx: index("idx_chat_threads_updated").on(table.updatedAt),
  }),
);

// Type inference for TypeScript
export type ChatThread = typeof chatThreads.$inferSelect;
export type NewChatThread = typeof chatThreads.$inferInsert;

/**
 * Chat Messages Table
 *
 * Stores individual messages within a thread.
 * Supports user, assistant, system, and tool message roles.
 * Tracks model used, token usage, and tool calls.
 */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // The thread this message belongs to
    threadId: uuid("thread_id")
      .references(() => chatThreads.id, { onDelete: "cascade" })
      .notNull(),

    // Message role: user, assistant, system, tool
    role: varchar("role", { length: 20 }).notNull(),

    // Message content (text)
    content: text("content"),

    // LLM model used (e.g., "gpt-4o", "claude-3.5-sonnet")
    model: varchar("model", { length: 100 }),

    // Number of tokens used for this message
    tokensUsed: integer("tokens_used"),

    // Tool/function calls made by the assistant (JSONB array)
    toolCalls: jsonb("tool_calls"),

    // Additional metadata (reasoning steps, etc.)
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),

    // Timestamp
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Composite index for thread + time ordering (most common query)
    threadCreatedIdx: index("idx_chat_messages_thread_created").on(
      table.threadId,
      table.createdAt,
    ),
  }),
);

// Type inference for TypeScript
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
