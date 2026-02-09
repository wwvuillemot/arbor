import SchemaBuilder from "@pothos/core";
import { NodeService } from "../services/node-service";
import { db } from "../db/index";
import { nodes } from "../db/schema";
import { eq, and, sql, or } from "drizzle-orm";

// Define the Node type from database
type DbNode = typeof nodes.$inferSelect;

// Create Pothos schema builder with default context
const builder = new SchemaBuilder<{
  Objects: {
    Node: DbNode;
    NodeTree: { root: DbNode; nodes: DbNode[]; totalCount: number };
  };
}>({});

// Create default node service instance
const nodeService = new NodeService();

// Node type definition
const NodeType = builder.objectRef<DbNode>("Node");

// NodeTree type definition
const NodeTreeType = builder.objectRef<{
  root: DbNode;
  nodes: DbNode[];
  totalCount: number;
}>("NodeTree");

// TagOperator enum
const TagOperator = builder.enumType("TagOperator", {
  values: {
    AND: { value: "AND", description: "All tags must match" },
    OR: { value: "OR", description: "Any tag matches" },
  },
});

// Add JSON scalar
builder.scalarType("JSON", {
  serialize: (value) => value,
  parseValue: (value) => value,
});

// Node type implementation
NodeType.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    nodeType: t.string({
      resolve: (node) => node.type,
    }),
    content: t.field({
      type: "JSON",
      nullable: true,
      resolve: (node) => node.content,
    }),
    position: t.int({
      nullable: true,
      resolve: (node) => node.position,
    }),
    parentId: t.string({
      nullable: true,
      resolve: (node) => node.parentId,
    }),
    projectId: t.string({
      nullable: true,
      resolve: async (node) => {
        // Traverse up to find the root project
        let current = node;
        while (current.parentId) {
          const parent = await nodeService.getNodeById(current.parentId);
          if (!parent) break;
          current = parent;
        }
        return current.type === "project" ? current.id : null;
      },
    }),
    tags: t.field({
      type: ["String"],
      resolve: (node) => {
        const metadata = node.metadata as Record<string, any> | null;
        return (metadata?.tags as string[]) || [];
      },
    }),
    metadata: t.field({
      type: "JSON",
      nullable: true,
      resolve: (node) => node.metadata,
    }),
    createdBy: t.string({
      nullable: true,
      resolve: (node) => node.createdBy,
    }),
    updatedBy: t.string({
      nullable: true,
      resolve: (node) => node.updatedBy,
    }),
    createdAt: t.string({
      resolve: (node) => node.createdAt.toISOString(),
    }),
    updatedAt: t.string({
      resolve: (node) => node.updatedAt.toISOString(),
    }),
    // Relationship resolvers
    parent: t.field({
      type: NodeType,
      nullable: true,
      resolve: async (node) => {
        if (!node.parentId) return null;
        return await nodeService.getNodeById(node.parentId);
      },
    }),
    children: t.field({
      type: [NodeType],
      resolve: async (node) => {
        return await nodeService.getNodesByParentId(node.id);
      },
    }),
    project: t.field({
      type: NodeType,
      nullable: true,
      resolve: async (node) => {
        // Traverse up to find the root project
        let current = node;
        while (current.parentId) {
          const parent = await nodeService.getNodeById(current.parentId);
          if (!parent) break;
          current = parent;
        }
        return current.type === "project" ? current : null;
      },
    }),
    ancestors: t.field({
      type: [NodeType],
      resolve: async (node) => {
        const ancestors: DbNode[] = [];
        let current = node;
        while (current.parentId) {
          const parent = await nodeService.getNodeById(current.parentId);
          if (!parent) break;
          ancestors.push(parent);
          current = parent;
        }
        return ancestors;
      },
    }),
    descendants: t.field({
      type: [NodeType],
      args: {
        maxDepth: t.arg.int(),
      },
      resolve: async (node, args) => {
        return nodeService.getDescendants(node.id, args.maxDepth ?? undefined);
      },
    }),
  }),
});

// NodeTree type implementation
NodeTreeType.implement({
  fields: (t) => ({
    root: t.field({
      type: NodeType,
      resolve: (tree) => tree.root,
    }),
    nodes: t.field({
      type: [NodeType],
      resolve: (tree) => tree.nodes,
    }),
    totalCount: t.int({
      resolve: (tree) => tree.totalCount,
    }),
  }),
});

// getAllDescendants is now provided by NodeService.getDescendants()

// Query type
builder.queryType({
  fields: (t) => ({
    node: t.field({
      type: NodeType,
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: async (_root, args) => {
        return await nodeService.getNodeById(args.id as string);
      },
    }),
    nodes: t.field({
      type: [NodeType],
      args: {
        parentId: t.arg.id(),
        projectId: t.arg.id(),
        nodeType: t.arg.string(),
        limit: t.arg.int({ defaultValue: 100 }),
        offset: t.arg.int({ defaultValue: 0 }),
      },
      resolve: async (_root, args) => {
        const conditions: any[] = [];

        // Filter by parentId
        if (args.parentId) {
          conditions.push(eq(nodes.parentId, args.parentId as string));
        }

        // Filter by nodeType
        if (args.nodeType) {
          conditions.push(eq(nodes.type, args.nodeType));
        }

        // Build query
        let query = db.select().from(nodes);

        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as any;
        }

        // Apply pagination
        query = query.limit(args.limit).offset(args.offset) as any;

        let results = await query;

        // Filter by projectId if specified (requires traversal)
        if (args.projectId) {
          const filtered: DbNode[] = [];
          for (const node of results) {
            let current = node;
            while (current.parentId) {
              const parent = await nodeService.getNodeById(current.parentId);
              if (!parent) break;
              current = parent;
            }
            if (current.type === "project" && current.id === args.projectId) {
              filtered.push(node);
            }
          }
          results = filtered;
        }

        return results;
      },
    }),
    nodeTree: t.field({
      type: NodeTreeType,
      nullable: true,
      args: {
        projectId: t.arg.id({ required: true }),
        maxDepth: t.arg.int(),
      },
      resolve: async (_root, args) => {
        const root = await nodeService.getNodeById(args.projectId as string);
        if (!root || root.type !== "project") {
          return null;
        }

        const descendants = await nodeService.getDescendants(
          root.id,
          args.maxDepth ?? undefined,
        );

        return {
          root,
          nodes: descendants,
          totalCount: descendants.length,
        };
      },
    }),
    nodesByTags: t.field({
      type: [NodeType],
      args: {
        tags: t.arg.stringList({ required: true }),
        operator: t.arg({ type: TagOperator, defaultValue: "OR" }),
      },
      resolve: async (_root, args) => {
        const tagList = args.tags as string[];
        const operator = args.operator as "AND" | "OR";

        if (tagList.length === 0) {
          return [];
        }

        // Query nodes with tags in metadata
        const allNodes = await db.select().from(nodes);

        // Filter nodes based on tags
        const filtered = allNodes.filter((node) => {
          const metadata = node.metadata as Record<string, any> | null;
          const nodeTags = (metadata?.tags as string[]) || [];

          if (operator === "AND") {
            // All tags must match
            return tagList.every((tag) => nodeTags.includes(tag));
          } else {
            // Any tag matches (OR)
            return tagList.some((tag) => nodeTags.includes(tag));
          }
        });

        return filtered;
      },
    }),
  }),
});

// Build and export schema
export const schema = builder.toSchema();
