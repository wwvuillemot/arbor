import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { NodeService } from "../../services/node-service";
import { ExportService } from "../../services/export-service";

/** Convert a file/folder name to Title Case, replacing underscores and hyphens with spaces. */
function toTitleCase(name: string): string {
  return name
    .replace(/[_-]/g, " ")
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

/** Return the text of the first heading in a TipTap doc, or null if it doesn't start with one. */
function extractFirstHeading(doc: unknown): string | null {
  if (!doc || typeof doc !== "object") return null;
  const first = (doc as any).content?.[0];
  if (!first || first.type !== "heading") return null;
  return (
    (first.content ?? [])
      .filter((n: any) => n.type === "text")
      .map((n: any) => n.text ?? "")
      .join("")
      .trim() || null
  );
}

const nodeService = new NodeService();
const exportService = new ExportService();

// Zod schemas for validation
const nodeTypeSchema = z.enum([
  "project",
  "folder",
  "note",
  "link",
  "ai_suggestion",
  "audio_note",
]);
const authorTypeSchema = z.enum(["human", "ai", "mixed"]); // DEPRECATED

// Provenance format: "user:{id}" or "llm:{model}"
// Examples: "user:alice", "llm:gpt-4o", "llm:claude-3.5-sonnet"
const provenanceSchema = z
  .string()
  .regex(/^(user|llm):.+$/, "Must be in format 'user:{id}' or 'llm:{model}'");

const createNodeSchema = z.object({
  type: nodeTypeSchema,
  name: z.string().min(1),
  parentId: z.string().uuid().optional().nullable(),
  slug: z.string().optional(),
  content: z.any().optional(), // JSONB content (can be object, string, or null)
  metadata: z.record(z.any()).optional(),
  authorType: authorTypeSchema.optional(), // DEPRECATED: Use createdBy/updatedBy instead
  position: z.number().int().optional(), // Position for ordering siblings
  createdBy: provenanceSchema.optional(), // Defaults to "user:system"
  updatedBy: provenanceSchema.optional(), // Defaults to "user:system"
});

const updateNodeSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().optional(),
  content: z.any().optional(), // JSONB content (can be object, string, or null)
  metadata: z.record(z.any()).optional(),
  authorType: authorTypeSchema.optional(), // DEPRECATED: Use updatedBy instead
  position: z.number().int().optional(), // Position for ordering siblings
  updatedBy: provenanceSchema.optional(), // Who last updated this node
});

export const nodesRouter = router({
  // Get all projects
  getAllProjects: publicProcedure.query(async () => {
    return await nodeService.getAllProjects();
  }),

  // Get node by ID
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const node = await nodeService.getNodeById(input.id);
      if (!node) {
        throw new Error("Node not found");
      }
      return node;
    }),

  // Get children of a node
  getChildren: publicProcedure
    .input(z.object({ parentId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await nodeService.getNodesByParentId(input.parentId);
    }),

  // Get all descendants of a node (recursive)
  getDescendants: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        maxDepth: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ input }) => {
      return await nodeService.getDescendants(input.nodeId, input.maxDepth);
    }),

  // Create a new node
  create: publicProcedure
    .input(createNodeSchema)
    .mutation(async ({ input }) => {
      return await nodeService.createNode({
        type: input.type,
        name: input.name,
        parentId: input.parentId,
        slug: input.slug,
        content: input.content,
        metadata: input.metadata,
        authorType: input.authorType, // DEPRECATED
        position: input.position,
        createdBy: input.createdBy,
        updatedBy: input.updatedBy,
      });
    }),

  // Update a node
  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateNodeSchema,
      }),
    )
    .mutation(async ({ input }) => {
      return await nodeService.updateNode(input.id, input.data);
    }),

  // Delete a node
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await nodeService.deleteNode(input.id);
      return { success: true };
    }),

  // Move a node to a new parent
  move: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        newParentId: z.string().uuid(),
        position: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return await nodeService.moveNode(
        input.id,
        input.newParentId,
        input.position,
      );
    }),

  // Copy a node (deep copy with children)
  copy: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        targetParentId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      return await nodeService.copyNode(input.id, input.targetParentId);
    }),

  // Reorder children of a parent
  reorder: publicProcedure
    .input(
      z.object({
        parentId: z.string().uuid(),
        childIds: z.array(z.string().uuid()),
      }),
    )
    .mutation(async ({ input }) => {
      await nodeService.reorderChildren(input.parentId, input.childIds);
      return { success: true };
    }),

  // Export a node or project as Markdown
  exportMarkdown: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        includeDescendants: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      if (input.includeDescendants) {
        return {
          content: await exportService.exportProjectAsMarkdown(input.id),
        };
      }
      return { content: await exportService.exportNodeAsMarkdown(input.id) };
    }),

  // Export a node or project as HTML (for PDF printing)
  exportHtml: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        includeDescendants: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      if (input.includeDescendants) {
        return { content: await exportService.exportProjectAsHtml(input.id) };
      }
      return { content: await exportService.exportNodeAsHtml(input.id) };
    }),

  /**
   * Import a directory of markdown/text files as a node hierarchy.
   * If parentNodeId is provided, imports into that existing node (folder/project) instead
   * of creating a new project. Otherwise always creates a new project node.
   * Returns both the actual project root ID and the specific node that served as the
   * import target so clients can distinguish folder imports from new-project imports.
   * Client reads files via webkitdirectory input and sends relative paths + text content.
   * Subdirectories are created as folder nodes; files become note nodes.
   */
  importDirectory: publicProcedure
    .input(
      z.object({
        projectName: z.string().min(1),
        parentNodeId: z.string().uuid().optional(), // Import into existing node instead of creating new project
        files: z.array(
          z.object({
            path: z.string(), // e.g. "rootDir/subfolder/note.md"
            content: z.unknown(), // TipTap JSON object or raw string
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const { files, projectName, parentNodeId } = input;

      // If parentNodeId is provided, import into that node; otherwise create a new project.
      let importTargetNodeId: string;
      let projectId: string;

      if (parentNodeId) {
        importTargetNodeId = parentNodeId;
        projectId = await nodeService.getProjectIdForNode(parentNodeId);
      } else {
        const project = await nodeService.createNode({
          type: "project",
          name: projectName,
          parentId: null,
          createdBy: "user:import",
          updatedBy: "user:import",
        });
        projectId = project.id;
        importTargetNodeId = project.id;
      }

      const pathToId = new Map<string, string>();

      // Collect all unique directory paths (excluding the root — it maps to the root node)
      const dirPaths = new Set<string>();
      for (const file of files) {
        const parts = file.path.split("/");
        for (let i = 2; i < parts.length; i++) {
          dirPaths.add(parts.slice(0, i).join("/"));
        }
      }

      const rootPrefix = files[0]?.path.split("/")[0] ?? "";
      if (rootPrefix) pathToId.set(rootPrefix, importTargetNodeId);

      const sortedDirs = [...dirPaths].sort(
        (a, b) => a.split("/").length - b.split("/").length,
      );

      for (const dirPath of sortedDirs) {
        const parts = dirPath.split("/");
        const name = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join("/");
        const parentId = pathToId.get(parentPath) ?? importTargetNodeId;
        const node = await nodeService.createNode({
          type: "folder",
          name: toTitleCase(name),
          parentId,
          metadata: { importSourcePath: dirPath },
          createdBy: "user:import",
          updatedBy: "user:import",
        });
        pathToId.set(dirPath, node.id);
      }

      // Create note nodes; track path→nodeId for post-import image attachment
      let imported = 0;
      const nodeMap: Record<string, string> = {}; // filePath → nodeId
      const positionCounters = new Map<string, number>(); // parentId → next position

      // Sort files alphabetically so notes get ascending positions by name
      const sortedFiles = [...files].sort((a, b) =>
        a.path.localeCompare(b.path, undefined, { sensitivity: "base" }),
      );

      for (const file of sortedFiles) {
        const parts = file.path.split("/");
        const fileName = parts[parts.length - 1];
        if (
          !fileName.match(/\.(md|txt|markdown|mdown|mkd|mdx)$/i) ||
          fileName.startsWith(".")
        ) {
          continue;
        }

        const parentPath = parts.slice(0, -1).join("/");
        const parentId = pathToId.get(parentPath) ?? importTargetNodeId;

        // Accept pre-parsed TipTap JSON (object) or raw string
        let tiptapContent: unknown;
        if (file.content && typeof file.content === "object") {
          tiptapContent = file.content;
        } else if (typeof file.content === "string") {
          // Try JSON parse first, then wrap as plain text
          try {
            tiptapContent = JSON.parse(file.content as string);
          } catch {
            tiptapContent = {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: file.content as string }],
                },
              ],
            };
          }
        } else {
          tiptapContent = { type: "doc", content: [] };
        }

        const notePosition = positionCounters.get(parentId) ?? 0;
        positionCounters.set(parentId, notePosition + 1);

        try {
          const node = await nodeService.createNode({
            type: "note",
            name:
              extractFirstHeading(tiptapContent) ??
              toTitleCase(
                fileName.replace(/\.(md|txt|markdown|mdown|mkd|mdx)$/i, ""),
              ),
            parentId,
            content: tiptapContent,
            metadata: { importSourcePath: file.path },
            position: notePosition,
            createdBy: "user:import",
            updatedBy: "user:import",
          });
          nodeMap[file.path] = node.id; // key by original path for nodeMap lookups
          imported++;
        } catch (err) {
          console.error(`Failed to import file ${file.path}:`, err);
          // Continue importing other files — one bad file shouldn't abort everything
        }
      }

      return {
        imported,
        folders: sortedDirs.length,
        projectId,
        importTargetNodeId,
        nodeMap,
      };
    }),
});
