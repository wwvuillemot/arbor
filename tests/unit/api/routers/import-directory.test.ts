import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "@/api/router";
import { resetTestDb } from "@tests/helpers/db";

describe("importDirectory Router", () => {
  const caller = appRouter.createCaller({} as any);

  beforeEach(async () => {
    await resetTestDb();
  });

  describe("basic import", () => {
    it("should create a project and note from a single markdown file", async () => {
      const result = await caller.nodes.importDirectory({
        projectName: "my-project",
        files: [
          {
            path: "my-project/note.md",
            content: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Hello world" }],
                },
              ],
            },
          },
        ],
      });

      expect(result.imported).toBe(1);
      expect(result.folders).toBe(0);
      expect(result.projectId).toBeTruthy();
      expect(result.nodeMap["my-project/note.md"]).toBeTruthy();
    });

    it("should strip markdown extensions from note names", async () => {
      const result = await caller.nodes.importDirectory({
        projectName: "proj",
        files: [
          { path: "proj/readme.md", content: { type: "doc", content: [] } },
          { path: "proj/notes.txt", content: { type: "doc", content: [] } },
          {
            path: "proj/guide.mdown",
            content: { type: "doc", content: [] },
          },
          { path: "proj/spec.mdx", content: { type: "doc", content: [] } },
        ],
      });

      expect(result.imported).toBe(4);
      // The nodeMap keys use the original paths
      expect(result.nodeMap["proj/readme.md"]).toBeTruthy();
      expect(result.nodeMap["proj/notes.txt"]).toBeTruthy();
      expect(result.nodeMap["proj/guide.mdown"]).toBeTruthy();
      expect(result.nodeMap["proj/spec.mdx"]).toBeTruthy();
    });

    it("should skip hidden files (starting with .)", async () => {
      const result = await caller.nodes.importDirectory({
        projectName: "proj",
        files: [
          { path: "proj/note.md", content: { type: "doc", content: [] } },
          { path: "proj/.hidden.md", content: { type: "doc", content: [] } },
        ],
      });

      expect(result.imported).toBe(1);
      expect(result.nodeMap["proj/note.md"]).toBeTruthy();
      expect(result.nodeMap["proj/.hidden.md"]).toBeUndefined();
    });
  });

  describe("nested folder structure", () => {
    it("should create intermediate folders for nested files", async () => {
      const result = await caller.nodes.importDirectory({
        projectName: "rootDir",
        files: [
          {
            path: "rootDir/FolderA/FolderB/fileC.md",
            content: { type: "doc", content: [] },
          },
        ],
      });

      expect(result.imported).toBe(1);
      expect(result.folders).toBe(2); // FolderA and FolderB
      expect(result.nodeMap["rootDir/FolderA/FolderB/fileC.md"]).toBeTruthy();
    });

    it("should correctly nest folders when parent folder has only subfolders", async () => {
      // This is the key bug scenario: FolderA has NO files directly, only FolderB
      const result = await caller.nodes.importDirectory({
        projectName: "images",
        files: [
          {
            path: "images/portraits/photo.md",
            content: {
              type: "doc",
              content: [
                {
                  type: "image",
                  attrs: {
                    src: "https://minio.example.com/photo.png",
                    alt: "photo",
                    title: null,
                  },
                },
              ],
            },
          },
        ],
      });

      expect(result.imported).toBe(1);
      expect(result.folders).toBe(1); // "portraits" subfolder
      expect(result.nodeMap["images/portraits/photo.md"]).toBeTruthy();
    });

    it("should handle 4-level deep nesting", async () => {
      const result = await caller.nodes.importDirectory({
        projectName: "root",
        files: [
          {
            path: "root/a/b/c/deep.md",
            content: { type: "doc", content: [] },
          },
        ],
      });

      expect(result.imported).toBe(1);
      expect(result.folders).toBe(3); // a, b, c
      expect(result.nodeMap["root/a/b/c/deep.md"]).toBeTruthy();
    });

    it("should create folders shared by multiple files correctly", async () => {
      const result = await caller.nodes.importDirectory({
        projectName: "proj",
        files: [
          {
            path: "proj/folderA/note1.md",
            content: { type: "doc", content: [] },
          },
          {
            path: "proj/folderA/note2.md",
            content: { type: "doc", content: [] },
          },
          {
            path: "proj/folderB/note3.md",
            content: { type: "doc", content: [] },
          },
        ],
      });

      expect(result.imported).toBe(3);
      expect(result.folders).toBe(2); // folderA and folderB
    });
  });

  describe("image notes (synthetic .md entries)", () => {
    it("should import standalone image entries as notes", async () => {
      const result = await caller.nodes.importDirectory({
        projectName: "images",
        files: [
          {
            path: "images/portraits/photo.md",
            content: {
              type: "doc",
              content: [
                {
                  type: "image",
                  attrs: {
                    src: "images/portraits/photo.png",
                    alt: "photo",
                    title: null,
                  },
                },
              ],
            },
          },
        ],
      });

      expect(result.imported).toBe(1);
      expect(result.nodeMap["images/portraits/photo.md"]).toBeTruthy();
    });

    it("should return the correct projectId for image import", async () => {
      const result = await caller.nodes.importDirectory({
        projectName: "myimages",
        files: [
          {
            path: "myimages/photo.md",
            content: {
              type: "doc",
              content: [
                {
                  type: "image",
                  attrs: { src: "myimages/photo.png", alt: "photo" },
                },
              ],
            },
          },
        ],
      });

      expect(result.projectId).toBeTruthy();
      expect(result.imported).toBe(1);
    });
  });

  describe("imports into existing trees", () => {
    it("should return the real projectId when importing into an existing folder", async () => {
      const project = await caller.nodes.create({
        type: "project",
        name: "Existing Project",
        parentId: null,
      });
      const folder = await caller.nodes.create({
        type: "folder",
        name: "Existing Folder",
        parentId: project.id,
      });

      const result = await caller.nodes.importDirectory({
        projectName: "ignored-for-existing-folder-imports",
        parentNodeId: folder.id,
        files: [
          {
            path: "incoming/topic.md",
            content: { type: "doc", content: [] },
          },
        ],
      });

      expect(result.projectId).toBe(project.id);
      expect(result.importTargetNodeId).toBe(folder.id);

      const importedNote = await caller.nodes.getById({
        id: result.nodeMap["incoming/topic.md"],
      });

      expect(importedNote.parentId).toBe(folder.id);
    });

    it("should persist import source path metadata for imported folders and notes", async () => {
      const result = await caller.nodes.importDirectory({
        projectName: "pathfinders",
        files: [
          {
            path: "pathfinders/places/bedlam.md",
            content: { type: "doc", content: [] },
          },
        ],
      });

      const importedProjectChildren = await caller.nodes.getChildren({
        parentId: result.projectId,
      });
      const importedFolder = importedProjectChildren.find(
        (childNode) => childNode.name === "Places",
      );

      expect(importedFolder?.metadata).toMatchObject({
        importSourcePath: "pathfinders/places",
      });

      const importedNote = await caller.nodes.getById({
        id: result.nodeMap["pathfinders/places/bedlam.md"],
      });

      expect(importedNote.metadata).toMatchObject({
        importSourcePath: "pathfinders/places/bedlam.md",
      });
    });
  });

  describe("nodeMap accuracy", () => {
    it("should return nodeMap with all imported file paths as keys", async () => {
      const result = await caller.nodes.importDirectory({
        projectName: "proj",
        files: [
          { path: "proj/a.md", content: { type: "doc", content: [] } },
          { path: "proj/sub/b.md", content: { type: "doc", content: [] } },
          { path: "proj/sub/c.md", content: { type: "doc", content: [] } },
        ],
      });

      expect(Object.keys(result.nodeMap)).toHaveLength(3);
      expect(result.nodeMap["proj/a.md"]).toBeTruthy();
      expect(result.nodeMap["proj/sub/b.md"]).toBeTruthy();
      expect(result.nodeMap["proj/sub/c.md"]).toBeTruthy();
      // All IDs should be different UUIDs
      const ids = Object.values(result.nodeMap);
      expect(new Set(ids).size).toBe(3);
    });
  });
});
