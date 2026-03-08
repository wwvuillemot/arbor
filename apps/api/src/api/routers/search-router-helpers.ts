import { z } from "zod";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index";
import { nodeTags, nodeTypeEnum, tags } from "../../db/schema";
import type { SearchResult } from "../../services/search-types";

export interface SearchResultTagInfo {
  id: string;
  name: string;
  color: string | null;
}

export interface AugmentedSearchResult extends SearchResult {
  tags: SearchResultTagInfo[];
  projectId: string | null;
  projectName: string | null;
}

const searchFiltersObjectSchema = z.object({
  projectId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  nodeTypes: z.array(z.enum(nodeTypeEnum)).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  excludeDeleted: z.boolean().optional(),
});

const searchOptionsObjectSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  minScore: z.number().min(0).max(1).optional(),
});

export const searchInputSchema = z.object({
  query: z.string().min(1),
  filters: searchFiltersObjectSchema.optional(),
  options: searchOptionsObjectSchema.optional(),
});

export const hybridSearchInputSchema = z.object({
  query: z.string().min(1),
  filters: searchFiltersObjectSchema.optional(),
  options: searchOptionsObjectSchema
    .extend({
      vectorWeight: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

export async function augmentSearchResults(
  results: SearchResult[],
): Promise<AugmentedSearchResult[]> {
  if (results.length === 0) {
    return [];
  }

  const nodeIds = results.map((result) => result.node.id);

  const tagRows = await db
    .select({
      nodeId: nodeTags.nodeId,
      tagId: tags.id,
      tagName: tags.name,
      tagColor: tags.color,
    })
    .from(nodeTags)
    .innerJoin(tags, eq(tags.id, nodeTags.tagId))
    .where(inArray(nodeTags.nodeId, nodeIds));

  const tagsByNodeId = new Map<string, SearchResultTagInfo[]>();
  for (const tagRow of tagRows) {
    if (!tagsByNodeId.has(tagRow.nodeId)) {
      tagsByNodeId.set(tagRow.nodeId, []);
    }

    tagsByNodeId.get(tagRow.nodeId)!.push({
      id: tagRow.tagId,
      name: tagRow.tagName,
      color: tagRow.tagColor,
    });
  }

  const ancestryRows = await db.execute(sql`
    SELECT
      n.id,
      COALESCE(
        CASE WHEN n.type = 'project' THEN n.id END,
        CASE WHEN p1.type = 'project' THEN p1.id END,
        CASE WHEN p2.type = 'project' THEN p2.id END,
        CASE WHEN p3.type = 'project' THEN p3.id END
      ) AS project_id,
      COALESCE(
        CASE WHEN n.type = 'project' THEN n.name END,
        CASE WHEN p1.type = 'project' THEN p1.name END,
        CASE WHEN p2.type = 'project' THEN p2.name END,
        CASE WHEN p3.type = 'project' THEN p3.name END
      ) AS project_name
    FROM nodes n
    LEFT JOIN nodes p1 ON p1.id = n.parent_id
    LEFT JOIN nodes p2 ON p2.id = p1.parent_id
    LEFT JOIN nodes p3 ON p3.id = p2.parent_id
    WHERE n.id = ANY(ARRAY[${sql.join(
      nodeIds.map((nodeId) => sql`${nodeId}::uuid`),
      sql`, `,
    )}])
  `);

  const ancestryByNodeId = new Map<
    string,
    { projectId: string | null; projectName: string | null }
  >();
  for (const ancestryRow of ancestryRows) {
    ancestryByNodeId.set(ancestryRow.id as string, {
      projectId: (ancestryRow.project_id as string) ?? null,
      projectName: (ancestryRow.project_name as string) ?? null,
    });
  }

  return results.map((result) => ({
    ...result,
    tags: tagsByNodeId.get(result.node.id) ?? [],
    projectId: ancestryByNodeId.get(result.node.id)?.projectId ?? null,
    projectName: ancestryByNodeId.get(result.node.id)?.projectName ?? null,
  }));
}
