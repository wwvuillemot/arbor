import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// TODO: Add vector embedding column after initial schema is pushed
// The customType approach doesn't work with drizzle-kit v0.20.18
// We'll add this via raw SQL migration or upgrade drizzle-orm later

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

    // TODO: Add vector embedding column via migration
    // embedding: vector('embedding'),

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
    // Note: GIN and IVFFlat indexes for metadata and embedding will be created via raw SQL migration
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
