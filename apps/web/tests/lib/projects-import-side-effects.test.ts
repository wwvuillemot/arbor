import { describe, expect, it, vi } from "vitest";

import {
  healImportedProjectInternalLinks,
  patchImportedNodeInternalLinks,
  uploadImportedImagesAndPatchNodes,
} from "@/app/[locale]/(app)/projects/projects-import-side-effects";

describe("projects import side-effect helpers", () => {
  it("uploads imported images and patches note content with stable media URLs", async () => {
    const importedImageFile = {
      name: "map.png",
      type: "image/png",
      arrayBuffer: vi.fn(
        async () => new TextEncoder().encode("image-bytes").buffer,
      ),
    };
    const uploadImportedMedia = vi
      .fn()
      .mockResolvedValue({ id: "attachment-1" });
    const fetchNodeById = vi.fn().mockResolvedValue({
      content: {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { src: "images/map.png", alt: "Map", title: null },
          },
        ],
      },
    });
    const updateNodeContent = vi.fn();

    await uploadImportedImagesAndPatchNodes({
      nodeMap: { "incoming/map.md": "node-map" },
      projectId: "proj-imported",
      imageFilesByNotePath: new Map([
        ["incoming/map.md", new Map([["images/map.png", importedImageFile]])],
      ]),
      uploadImportedMedia,
      fetchNodeById,
      updateNodeContent,
    });

    expect(uploadImportedMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: "node-map",
        projectId: "proj-imported",
        filename: "map.png",
        mimeType: "image/png",
        createdBy: "user:import",
      }),
    );
    expect(fetchNodeById).toHaveBeenCalledWith({ id: "node-map" });
    expect(updateNodeContent).toHaveBeenCalledWith({
      id: "node-map",
      content: {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: {
              src: "http://api.arbor.local/media/attachment-1",
              alt: "Map",
              title: null,
            },
          },
        ],
      },
    });
  });

  it("patches imported note links to internal node ids", async () => {
    const fetchNodeById = vi.fn().mockResolvedValue({
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Intro",
                marks: [{ type: "link", attrs: { href: "./intro.md" } }],
              },
            ],
          },
        ],
      },
    });
    const updateNodeContent = vi.fn();

    await patchImportedNodeInternalLinks({
      nodeMap: {
        "incoming/guides/roadmap.md": "node-roadmap",
        "incoming/guides/intro.md": "node-intro",
      },
      entries: [
        { path: "incoming/guides/roadmap.md", content: { type: "doc" } },
      ],
      fetchNodeById,
      updateNodeContent,
    });

    expect(updateNodeContent).toHaveBeenCalledWith({
      id: "node-roadmap",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Intro",
                marks: [{ type: "link", attrs: { href: "?node=node-intro" } }],
              },
            ],
          },
        ],
      },
    });
  });

  it("heals older imported notes using project-wide import aliases", async () => {
    const fetchDescendants = vi.fn().mockResolvedValue([
      {
        id: "folder-1",
        name: "Guides",
        type: "folder",
        parentId: "project-1",
        metadata: { importSourcePath: "incoming/guides" },
      },
      {
        id: "note-1",
        name: "Intro",
        type: "note",
        parentId: "folder-1",
        metadata: { importSourcePath: "incoming/guides/intro.md" },
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Intro" }] },
          ],
        },
      },
      {
        id: "note-2",
        name: "Roadmap",
        type: "note",
        parentId: "folder-1",
        metadata: { importSourcePath: "incoming/guides/roadmap.md" },
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Intro",
                  marks: [{ type: "link", attrs: { href: "./intro.md" } }],
                },
              ],
            },
          ],
        },
      },
    ]);
    const updateNodeContent = vi.fn();

    await healImportedProjectInternalLinks({
      projectId: "project-1",
      importedNodeMap: { "incoming/guides/intro.md": "note-1" },
      fetchDescendants,
      updateNodeContent,
    });

    expect(fetchDescendants).toHaveBeenCalledWith({ nodeId: "project-1" });
    expect(updateNodeContent).toHaveBeenCalledWith({
      id: "note-2",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Intro",
                marks: [{ type: "link", attrs: { href: "?node=note-1" } }],
              },
            ],
          },
        ],
      },
    });
  });
});
