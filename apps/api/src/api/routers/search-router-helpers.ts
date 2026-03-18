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
    WITH RECURSIVE ancestry AS (
      SELECT
        n.id AS requested_id,
        n.id AS current_id,
        n.parent_id,
        n.type,
        n.name,
        0 AS depth
      FROM nodes n
      WHERE n.id = ANY(ARRAY[${sql.join(
        nodeIds.map((nodeId) => sql`${nodeId}::uuid`),
        sql`, `,
      )}])

      UNION ALL

      SELECT
        ancestry.requested_id,
        parent.id AS current_id,
        parent.parent_id,
        parent.type,
        parent.name,
        ancestry.depth + 1 AS depth
      FROM ancestry
      INNER JOIN nodes parent ON parent.id = ancestry.parent_id
    ),
    project_ancestry AS (
      SELECT DISTINCT ON (requested_id)
        requested_id,
        current_id AS project_id,
        name AS project_name
      FROM ancestry
      WHERE type = 'project'
      ORDER BY requested_id, depth ASC
    )
    SELECT
      requested_nodes.id,
      project_ancestry.project_id,
      project_ancestry.project_name
    FROM (
      SELECT UNNEST(ARRAY[${sql.join(
        nodeIds.map((nodeId) => sql`${nodeId}::uuid`),
        sql`, `,
      )}]) AS id
    ) AS requested_nodes
    LEFT JOIN project_ancestry
      ON project_ancestry.requested_id = requested_nodes.id
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
