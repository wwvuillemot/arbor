import { describe, it, expect } from 'vitest';
import { getTestDb } from '@tests/helpers/db';
import { createTestProjectHierarchy } from '@tests/helpers/fixtures';
import { nodes } from '@server/db/schema';
import { eq } from 'drizzle-orm';

describe('Database - Cascade Deletion', () => {
  it('should cascade delete all children when project is deleted', async () => {
    const hierarchy = await createTestProjectHierarchy();
    const db = getTestDb();
    
    // Verify all nodes exist
    const allNodes = await db.select().from(nodes);
    expect(allNodes.length).toBeGreaterThan(1);
    
    // Delete the project
    await db.delete(nodes).where(eq(nodes.id, hierarchy.project.id));
    
    // Verify all nodes are deleted
    const remainingNodes = await db.select().from(nodes);
    expect(remainingNodes).toHaveLength(0);
  });

  it('should cascade delete folder and its children when folder is deleted', async () => {
    const hierarchy = await createTestProjectHierarchy();
    const db = getTestDb();
    
    // Count nodes before deletion
    const nodesBefore = await db.select().from(nodes);
    const initialCount = nodesBefore.length;
    
    // Delete the characters folder (should delete protagonist and antagonist notes)
    await db.delete(nodes).where(eq(nodes.id, hierarchy.folders.characters.id));
    
    // Verify folder and its notes are deleted
    const nodesAfter = await db.select().from(nodes);
    expect(nodesAfter.length).toBe(initialCount - 3); // folder + 2 notes
    
    // Verify specific nodes are gone
    const [deletedFolder] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, hierarchy.folders.characters.id));
    expect(deletedFolder).toBeUndefined();
    
    const [deletedNote1] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, hierarchy.notes.protagonist.id));
    expect(deletedNote1).toBeUndefined();
    
    const [deletedNote2] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, hierarchy.notes.antagonist.id));
    expect(deletedNote2).toBeUndefined();
    
    // Verify other nodes still exist
    const [project] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, hierarchy.project.id));
    expect(project).toBeDefined();
    
    const [worldBuildingFolder] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, hierarchy.folders.worldBuilding.id));
    expect(worldBuildingFolder).toBeDefined();
  });

  it('should not affect sibling nodes when deleting a node', async () => {
    const hierarchy = await createTestProjectHierarchy();
    const db = getTestDb();
    
    // Delete protagonist note
    await db.delete(nodes).where(eq(nodes.id, hierarchy.notes.protagonist.id));
    
    // Verify antagonist note still exists
    const [antagonist] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, hierarchy.notes.antagonist.id));
    expect(antagonist).toBeDefined();
    expect(antagonist.name).toBe('Antagonist: Lord Malachar');
    
    // Verify parent folder still exists
    const [folder] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, hierarchy.folders.characters.id));
    expect(folder).toBeDefined();
  });
});

