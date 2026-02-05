import { pgTable, uuid, varchar, text, jsonb, timestamp, index, customType } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Custom vector type for pgvector (until drizzle-orm adds native support)
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

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

  // Vector embedding for semantic search (1536 dimensions for OpenAI embeddings)
  embedding: vector('embedding'),

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

