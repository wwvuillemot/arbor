import { eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { nodes } from "../db/schema";
import type { SearchFilters } from "./search-types";

export function buildSearchFilterConditions(filters: SearchFilters) {
  const conditions: ReturnType<typeof sql>[] = [];

  if (filters.excludeDeleted !== false) {
    conditions.push(isNull(nodes.deletedAt));
  }

  if (filters.projectId) {
    conditions.push(
      or(
        eq(nodes.id, filters.projectId),
        eq(nodes.parentId, filters.projectId),
        sql`${nodes.id} IN (
          SELECT n2.id FROM nodes n2
          WHERE n2.parent_id IN (
            SELECT n3.id FROM nodes n3 WHERE n3.parent_id = ${filters.projectId}
          )
        )`,
      )!,
    );
  }

  if (filters.parentId) {
    conditions.push(eq(nodes.parentId, filters.parentId));
  }

  if (filters.nodeTypes && filters.nodeTypes.length > 0) {
    conditions.push(inArray(nodes.type, filters.nodeTypes));
  }

  if (filters.tagIds && filters.tagIds.length > 0) {
    conditions.push(
      sql`${nodes.id} IN (
        SELECT nt.node_id FROM node_tags nt
        WHERE nt.tag_id IN (${sql.join(
          filters.tagIds.map((tagId) => sql`${tagId}`),
          sql`, `,
        )})
      )`,
    );
  }

  return conditions;
}

export function buildKeywordMatchCondition(query: string) {
  const pattern = `%${query}%`;

  return or(
    ilike(nodes.name, pattern),
    sql`${nodes.content}::text ILIKE ${pattern}`,
  )!;
}
