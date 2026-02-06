import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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

export const nodeTypeEnum = ['project', 'folder', 'note', 'link', 'ai_suggestion', 'audio_note'] as const;
export type NodeType = typeof nodeTypeEnum[number];

export const authorTypeEnum = ['human', 'ai', 'mixed'] as const;
export type AuthorType = typeof authorTypeEnum[number];

export const nodes = pgTable('nodes', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Self-referential hierarchy
  // NULL for top-level projects, otherwise references parent node
  parentId: uuid('parent_id').references(() => nodes.id, { onDelete: 'cascade' }),

  // Node type: project, folder, note, link, ai_suggestion, audio_note
  type: varchar('type', { length: 50 }).notNull(),

  // Display name
  name: varchar('name', { length: 255 }).notNull(),

  // URL-friendly identifier (optional, for sharing/linking)
  slug: varchar('slug', { length: 255 }),

  // Markdown content (for notes)
  content: text('content'),

  // Flexible metadata per node type (JSONB)
  // Examples:
  // - project: {"description": "...", "status": "active", "created_date": "2024-01-01"}
  // - folder: {"color": "#3b82f6", "icon": "folder"}
  // - note: {"tags": ["writing", "ideas"], "word_count": 1500, "reading_time": 6}
  // - link: {"source_id": "uuid", "target_id": "uuid", "link_type": "references"}
  // - ai_suggestion: {"original_text": "...", "suggested_text": "...", "status": "pending"}
  // - audio_note: {"duration": 120, "transcription_id": "uuid", "audio_url": "/files/..."}
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),

  // Track authorship (human, ai, mixed)
  authorType: varchar('author_type', { length: 20 }).default('human'),

  // TODO: Add vector embedding column via migration
  // embedding: vector('embedding'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),

  // Soft delete
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  // Indexes for performance
  parentIdIdx: index('idx_nodes_parent').on(table.parentId),
  typeIdx: index('idx_nodes_type').on(table.type),
  slugIdx: index('idx_nodes_slug').on(table.slug),
  deletedAtIdx: index('idx_nodes_deleted_at').on(table.deletedAt),
  // Note: GIN and IVFFlat indexes for metadata and embedding will be created via raw SQL migration
}));

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
export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Preference key (e.g., 'theme', 'language', 'sidebarWidth')
  key: varchar('key', { length: 255 }).notNull().unique(),

  // Preference value (stored as JSONB for flexibility)
  // Examples:
  // - theme: {"mode": "dark", "accentColor": "#3b82f6"}
  // - language: {"locale": "en-US"}
  // - editor: {"fontSize": 16, "lineHeight": 1.6, "fontFamily": "monospace"}
  value: jsonb('value').notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index for fast key lookups
  keyIdx: index('idx_user_preferences_key').on(table.key),
}));

// Type inference for TypeScript
export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;

