import { getTestDb } from "./db";
import { nodes } from "@server/db/schema";
import type { NodeType, AuthorType } from "@server/db/schema";

export interface CreateNodeParams {
  type: NodeType;
  name: string;
  parentId?: string | null;
  slug?: string;
  content?: string;
  metadata?: Record<string, any>;
  authorType?: AuthorType;
}

/**
 * Create a test node in the database
 */
export async function createTestNode(params: CreateNodeParams) {
  const db = getTestDb();

  const [node] = await db
    .insert(nodes)
    .values({
      type: params.type,
      name: params.name,
      parentId: params.parentId || null,
      slug: params.slug,
      content: params.content,
      metadata: params.metadata || {},
      authorType: params.authorType || "human",
    })
    .returning();

  return node;
}

/**
 * Create a test project
 */
export async function createTestProject(name: string = "Test Project") {
  return createTestNode({
    type: "project",
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
  });
}

/**
 * Create a test folder
 */
export async function createTestFolder(name: string, parentId: string) {
  return createTestNode({
    type: "folder",
    name,
    parentId,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
  });
}

/**
 * Create a test note
 */
export async function createTestNote(
  name: string,
  parentId: string,
  content: string = "",
) {
  return createTestNode({
    type: "note",
    name,
    parentId,
    content,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
  });
}

/**
 * Create a complete test project hierarchy
 */
export async function createTestProjectHierarchy() {
  // Create project
  const project = await createTestProject("My Fantasy Novel");

  // Create folders
  const charactersFolder = await createTestFolder("Characters", project.id);
  const worldBuildingFolder = await createTestFolder(
    "World Building",
    project.id,
  );

  // Create notes
  const protagonist = await createTestNote(
    "Protagonist: Aria",
    charactersFolder.id,
    "A young mage discovering her powers.",
  );

  const antagonist = await createTestNote(
    "Antagonist: Lord Malachar",
    charactersFolder.id,
    "The dark lord seeking to control all magic.",
  );

  const magicSystem = await createTestNote(
    "Magic System",
    worldBuildingFolder.id,
    "Magic is drawn from the natural world and requires balance.",
  );

  return {
    project,
    folders: {
      characters: charactersFolder,
      worldBuilding: worldBuildingFolder,
    },
    notes: {
      protagonist,
      antagonist,
      magicSystem,
    },
  };
}
