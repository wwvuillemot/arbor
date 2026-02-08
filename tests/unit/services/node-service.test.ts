import { describe, it, expect, beforeEach } from "vitest";
import { NodeService } from "@server/services/node-service";
import {
  createTestProject,
  createTestFolder,
  createTestNote,
} from "@tests/helpers/fixtures";
import type { NodeType } from "@server/db/schema";

describe("NodeService", () => {
  let nodeService: NodeService;

  beforeEach(() => {
    nodeService = new NodeService();
  });

  describe("createNode", () => {
    it("should create a project node", async () => {
      const node = await nodeService.createNode({
        type: "project",
        name: "My Novel",
        slug: "my-novel",
      });

      expect(node).toBeDefined();
      expect(node.id).toBeDefined();
      expect(node.type).toBe("project");
      expect(node.name).toBe("My Novel");
      expect(node.slug).toBe("my-novel");
      expect(node.parentId).toBeNull();
    });

    it("should create a folder under a project", async () => {
      const project = await nodeService.createNode({
        type: "project",
        name: "My Novel",
      });

      const folder = await nodeService.createNode({
        type: "folder",
        name: "Characters",
        parentId: project.id,
      });

      expect(folder.parentId).toBe(project.id);
      expect(folder.type).toBe("folder");
    });

    it("should auto-generate slug if not provided", async () => {
      const node = await nodeService.createNode({
        type: "project",
        name: "My Fantasy Novel",
      });

      expect(node.slug).toBe("my-fantasy-novel");
    });

    it("should throw error if project has a parent", async () => {
      const project = await createTestProject();

      await expect(
        nodeService.createNode({
          type: "project",
          name: "Invalid Project",
          parentId: project.id,
        }),
      ).rejects.toThrow("Projects cannot have a parent");
    });

    it("should throw error if non-project node has no parent", async () => {
      await expect(
        nodeService.createNode({
          type: "folder",
          name: "Orphan Folder",
        }),
      ).rejects.toThrow("Only projects can be top-level nodes");
    });
  });

  describe("getNodeById", () => {
    it("should retrieve a node by id", async () => {
      const created = await createTestProject("My Novel");
      const retrieved = await nodeService.getNodeById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe("My Novel");
    });

    it("should return null for non-existent id", async () => {
      const retrieved = await nodeService.getNodeById(
        "00000000-0000-0000-0000-000000000000",
      );

      expect(retrieved).toBeNull();
    });
  });

  describe("getNodesByParentId", () => {
    it("should retrieve all children of a node", async () => {
      const project = await createTestProject("My Novel");
      await createTestFolder("Characters", project.id);
      await createTestFolder("Locations", project.id);
      await createTestFolder("Plot", project.id);

      const children = await nodeService.getNodesByParentId(project.id);

      expect(children).toHaveLength(3);
      children.forEach((child) => {
        expect(child.parentId).toBe(project.id);
      });
    });

    it("should return empty array if node has no children", async () => {
      const project = await createTestProject("My Novel");
      const children = await nodeService.getNodesByParentId(project.id);

      expect(children).toHaveLength(0);
    });
  });

  describe("getAllProjects", () => {
    it("should retrieve all top-level projects", async () => {
      await createTestProject("Novel 1");
      await createTestProject("Novel 2");
      await createTestProject("D&D Campaign");

      const projects = await nodeService.getAllProjects();

      expect(projects).toHaveLength(3);
      projects.forEach((project) => {
        expect(project.type).toBe("project");
        expect(project.parentId).toBeNull();
      });
    });

    it("should return empty array if no projects exist", async () => {
      const projects = await nodeService.getAllProjects();

      expect(projects).toHaveLength(0);
    });
  });

  describe("updateNode", () => {
    it("should update node name", async () => {
      const node = await createTestProject("My Novel");
      const updated = await nodeService.updateNode(node.id, {
        name: "My Fantasy Novel",
      });

      expect(updated.name).toBe("My Fantasy Novel");
      expect(updated.id).toBe(node.id);
    });

    it("should update node content", async () => {
      const project = await createTestProject("My Novel");
      const note = await createTestNote("Character", project.id, "Initial");

      const updated = await nodeService.updateNode(note.id, {
        content: "Updated content",
      });

      expect(updated.content).toBe("Updated content");
    });

    it("should update node slug", async () => {
      const node = await createTestProject("My Novel");
      const updated = await nodeService.updateNode(node.id, {
        slug: "my-awesome-novel",
      });

      expect(updated.slug).toBe("my-awesome-novel");
    });

    it("should throw error for non-existent node", async () => {
      await expect(
        nodeService.updateNode("00000000-0000-0000-0000-000000000000", {
          name: "Updated",
        }),
      ).rejects.toThrow("Node not found");
    });
  });

  describe("deleteNode", () => {
    it("should delete a node", async () => {
      const node = await createTestProject("My Novel");
      await nodeService.deleteNode(node.id);

      const retrieved = await nodeService.getNodeById(node.id);
      expect(retrieved).toBeNull();
    });

    it("should cascade delete children", async () => {
      const project = await createTestProject("My Novel");
      const folder = await createTestFolder("Characters", project.id);
      const note = await createTestNote("Aria", folder.id);

      await nodeService.deleteNode(project.id);

      const retrievedProject = await nodeService.getNodeById(project.id);
      const retrievedFolder = await nodeService.getNodeById(folder.id);
      const retrievedNote = await nodeService.getNodeById(note.id);

      expect(retrievedProject).toBeNull();
      expect(retrievedFolder).toBeNull();
      expect(retrievedNote).toBeNull();
    });
  });

  describe('Phase 0.2: New Schema Fields', () => {
    describe('position field', () => {
      it('should create node with position', async () => {
        const node = await nodeService.createNode({
          type: 'project',
          name: 'My Novel',
          position: 10,
        });

        expect(node.position).toBe(10);
      });

      it('should default position to 0 if not provided', async () => {
        const node = await nodeService.createNode({
          type: 'project',
          name: 'My Novel',
        });

        expect(node.position).toBe(0);
      });

      it('should update node position', async () => {
        const node = await createTestProject('My Novel');
        const updated = await nodeService.updateNode(node.id, {
          position: 20,
        });

        expect(updated.position).toBe(20);
      });
    });

    describe('createdBy and updatedBy fields', () => {
      it('should create node with createdBy and updatedBy', async () => {
        const node = await nodeService.createNode({
          type: 'project',
          name: 'My Novel',
          createdBy: 'user:alice',
          updatedBy: 'user:alice',
        });

        expect(node.createdBy).toBe('user:alice');
        expect(node.updatedBy).toBe('user:alice');
      });

      it('should default createdBy and updatedBy to user:system', async () => {
        const node = await nodeService.createNode({
          type: 'project',
          name: 'My Novel',
        });

        expect(node.createdBy).toBe('user:system');
        expect(node.updatedBy).toBe('user:system');
      });

      it('should update updatedBy when updating node', async () => {
        const node = await createTestProject('My Novel');
        const updated = await nodeService.updateNode(node.id, {
          name: 'My Fantasy Novel',
          updatedBy: 'llm:gpt-4o',
        });

        expect(updated.name).toBe('My Fantasy Novel');
        expect(updated.updatedBy).toBe('llm:gpt-4o');
        expect(updated.createdBy).toBe('user:system'); // Should not change
      });

      it('should support LLM provenance format', async () => {
        const node = await nodeService.createNode({
          type: 'project',
          name: 'AI Generated Novel',
          createdBy: 'llm:claude-3.5-sonnet',
          updatedBy: 'llm:claude-3.5-sonnet',
        });

        expect(node.createdBy).toBe('llm:claude-3.5-sonnet');
        expect(node.updatedBy).toBe('llm:claude-3.5-sonnet');
      });
    });

    describe('JSONB content field', () => {
      it('should create node with JSONB content', async () => {
        const project = await createTestProject('My Novel');
        const note = await nodeService.createNode({
          type: 'note',
          name: 'Character',
          parentId: project.id,
          content: { text: 'Character description', blocks: [] },
        });

        expect(note.content).toEqual({ text: 'Character description', blocks: [] });
      });

      it('should update node with JSONB content', async () => {
        const project = await createTestProject('My Novel');
        const note = await createTestNote('Character', project.id);

        const updated = await nodeService.updateNode(note.id, {
          content: { text: 'Updated description', blocks: [{ type: 'paragraph' }] },
        });

        expect(updated.content).toEqual({ text: 'Updated description', blocks: [{ type: 'paragraph' }] });
      });

      it('should handle null content', async () => {
        const project = await createTestProject('My Novel');
        const note = await nodeService.createNode({
          type: 'note',
          name: 'Empty Note',
          parentId: project.id,
          content: null,
        });

        expect(note.content).toBeNull();
      });
    });
  });
});
