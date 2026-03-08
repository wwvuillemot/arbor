import { describe, expect, it } from "vitest";

import {
  buildArborLinkNameCandidates,
  buildFlatLinkPickerTreeNodes,
  buildUnsupportedImportDirectoryMessage,
  createImportHealingContext,
  deriveEditorLinkNavigationTarget,
  deriveFilteredNodeIds,
  deriveImportDirectoryHandling,
  deriveImportHealingUpdates,
  deriveImportTargetNodeId,
  deriveNodeMoveMutationInput,
  findMatchingArborSearchResult,
  getImportSourcePath,
  getNoteFileNameCandidates,
  joinImportSourcePath,
  normalizeImportSourcePath,
  normalizeTiptapContent,
  prepareImportDirectoryEntries,
  replaceImportedImageSourceUrls,
  rewriteImportedNoteContent,
  resolveArborEditorLinkTargetNodeId,
  stripTopLevelImportSegment,
  summarizeImportFileExtensions,
  transformTiptapContent,
  type ImportDirectoryFile,
  type ImportHealingNode,
  type LinkPickerSourceNode,
} from "@/app/[locale]/(app)/projects/projects-page-helpers";

describe("projects-page-helpers", () => {
  it("normalizes and joins imported source paths", () => {
    expect(normalizeImportSourcePath(" incoming\\maps / world.md ")).toBe(
      "incoming/maps/world.md",
    );
    expect(joinImportSourcePath(" incoming/maps ", " ./world.md ")).toBe(
      "incoming/maps/./world.md",
    );
    expect(stripTopLevelImportSegment("incoming/maps/world.md")).toBe(
      "maps/world.md",
    );
    expect(stripTopLevelImportSegment("world.md")).toBeNull();
  });

  it("reads import source paths and note filename candidates", () => {
    const importedNote: ImportHealingNode = {
      id: "node-1",
      name: "World Guide",
      type: "note",
      parentId: null,
      metadata: { importSourcePath: " incoming/world_guide.mdx " },
    };

    expect(getImportSourcePath(importedNote.metadata)).toBe(
      "incoming/world_guide.mdx",
    );
    expect(getNoteFileNameCandidates(importedNote)).toEqual([
      "world_guide.mdx",
      "World Guide.md",
    ]);
  });

  it("normalizes TipTap content from object and JSON string inputs", () => {
    const tiptapDocument = { type: "doc", content: [] };

    expect(normalizeTiptapContent(tiptapDocument)).toEqual(tiptapDocument);
    expect(normalizeTiptapContent(JSON.stringify(tiptapDocument))).toEqual(
      tiptapDocument,
    );
    expect(normalizeTiptapContent("not json")).toBeNull();
    expect(normalizeTiptapContent(42)).toBeNull();
  });

  it("transforms TipTap content without mutating the original value", () => {
    const tiptapDocument = {
      type: "doc",
      content: [{ type: "image", attrs: { src: "incoming/map.png" } }],
    };

    const transformedDocument = transformTiptapContent(
      tiptapDocument,
      (key, value) => {
        if (key === "src") {
          return "http://api.arbor.local/media/media-1";
        }

        return value;
      },
    );

    expect(transformedDocument).toEqual({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "http://api.arbor.local/media/media-1" },
        },
      ],
    });
    expect(tiptapDocument).toEqual({
      type: "doc",
      content: [{ type: "image", attrs: { src: "incoming/map.png" } }],
    });
    expect(
      transformTiptapContent("not json", (_key, value) => value),
    ).toBeNull();
  });

  it("replaces imported image placeholder src values without mutating the original content", () => {
    const tiptapDocument = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "incoming/map.png", alt: "Map" },
        },
        {
          type: "image",
          attrs: { src: "incoming/keep.png", alt: "Keep" },
        },
      ],
    };

    const { changed, content } = replaceImportedImageSourceUrls(
      tiptapDocument,
      new Map([["incoming/map.png", "/media/media-1"]]),
    );

    expect(changed).toBe(true);
    expect(content).toEqual({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "/media/media-1", alt: "Map" },
        },
        {
          type: "image",
          attrs: { src: "incoming/keep.png", alt: "Keep" },
        },
      ],
    });
    expect(tiptapDocument).toEqual({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "incoming/map.png", alt: "Map" },
        },
        {
          type: "image",
          attrs: { src: "incoming/keep.png", alt: "Keep" },
        },
      ],
    });

    expect(
      replaceImportedImageSourceUrls(
        tiptapDocument,
        new Map([["incoming/missing.png", "/media/media-2"]]),
      ),
    ).toEqual({ changed: false, content: tiptapDocument });
    expect(replaceImportedImageSourceUrls("not json", new Map())).toEqual({
      changed: false,
      content: null,
    });
  });

  it("builds import-healing aliases for imported notes and folders", () => {
    const descendants: ImportHealingNode[] = [
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
      },
      {
        id: "note-2",
        name: "Roadmap",
        type: "note",
        parentId: "folder-1",
      },
    ];

    const { getNotePathCandidates, projectWideNodeMap } =
      createImportHealingContext("project-1", descendants, {
        "incoming/guides/intro.md": "note-1",
      });

    expect(getNotePathCandidates(descendants[1]!)).toEqual(
      expect.arrayContaining([
        "incoming/guides/intro.md",
        "guides/intro.md",
        "Guides/Intro.md",
      ]),
    );
    expect(getNotePathCandidates(descendants[2]!)).toEqual(
      expect.arrayContaining([
        "incoming/guides/Roadmap.md",
        "guides/Roadmap.md",
        "Guides/Roadmap.md",
      ]),
    );
    expect(projectWideNodeMap["guides/intro.md"]).toBe("note-1");
    expect(projectWideNodeMap["Guides/Roadmap.md"]).toBe("note-2");
  });

  it("derives import-healing updates only for notes with rewritten links", () => {
    const descendants: ImportHealingNode[] = [
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
        content: JSON.stringify({
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
        }),
      },
      {
        id: "note-3",
        name: "Loose Notes",
        type: "note",
        parentId: "folder-1",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "No links" }],
            },
          ],
        },
      },
    ];

    const importHealingContext = createImportHealingContext(
      "project-1",
      descendants,
      { "incoming/guides/intro.md": "note-1" },
    );

    expect(
      deriveImportHealingUpdates(descendants, importHealingContext),
    ).toEqual([
      {
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
      },
    ]);
  });

  it("rewrites imported internal hrefs inside TipTap content", () => {
    const originalDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Intro",
              marks: [
                {
                  type: "link",
                  attrs: { href: "./intro.md" },
                },
              ],
            },
          ],
        },
      ],
    };

    const { changed, content } = rewriteImportedNoteContent(
      originalDocument,
      ["incoming/guides/roadmap.md"],
      { "incoming/guides/intro.md": "node-1" },
    );

    expect(changed).toBe(true);
    expect(content).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Intro",
              marks: [
                {
                  type: "link",
                  attrs: { href: "?node=node-1" },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(
      originalDocument.content[0]?.content?.[0]?.marks?.[0]?.attrs?.href,
    ).toBe("./intro.md");
  });

  it("prepares markdown and image import entries from directory files", async () => {
    const importedImageFile: ImportDirectoryFile = {
      name: "map.png",
      webkitRelativePath: "pathfinders/images/map.png",
      text: async () => "",
    };
    const importedMarkdownFile: ImportDirectoryFile = {
      name: "readme.md",
      webkitRelativePath: "pathfinders/readme.md",
      text: async () => "# Pathfinders\n\n![Map](images/map.png)",
    };

    const { entries, imageFilesByNotePath, rootDirectoryNames } =
      await prepareImportDirectoryEntries([
        importedMarkdownFile,
        importedImageFile,
      ]);

    expect(entries.map((entry) => entry.path)).toEqual([
      "pathfinders/readme.md",
      "pathfinders/images/map.md",
    ]);
    expect(
      imageFilesByNotePath.get("pathfinders/readme.md")?.get("images/map.png"),
    ).toBe(importedImageFile);
    expect(
      imageFilesByNotePath
        .get("pathfinders/images/map.md")
        ?.get("pathfinders/images/map.png"),
    ).toBe(importedImageFile);
    expect(rootDirectoryNames).toEqual(["pathfinders"]);
  });

  it("summarizes import file extensions without duplicates", () => {
    expect(
      summarizeImportFileExtensions([
        { name: "readme.md" },
        { name: "map.PNG" },
        { name: "notes.txt" },
        { name: "LICENSE" },
        { name: "draft.md" },
      ]),
    ).toBe("md, png, txt, (no ext)");
  });

  it("builds unsupported import-directory messages", () => {
    expect(buildUnsupportedImportDirectoryMessage(0, "")).toBe(
      "No files were received from the browser. Try selecting the folder again.",
    );
    expect(buildUnsupportedImportDirectoryMessage(3, "md, png")).toBe(
      "No supported files found among 3 files (extensions: md, png). Supported: .md, .txt, .png, .jpg, .jpeg, .gif, .webp, .svg",
    );
    expect(buildUnsupportedImportDirectoryMessage(2, "")).toBe(
      "No supported files found among 2 files (extensions: none). Supported: .md, .txt, .png, .jpg, .jpeg, .gif, .webp, .svg",
    );
  });

  it("derives import-directory handling for single-root and prompt flows", () => {
    expect(
      deriveImportDirectoryHandling("Preferred Name", ["pathfinders"], true),
    ).toEqual({
      kind: "import-now",
      projectName: "Preferred Name",
      createNewProject: true,
    });
    expect(deriveImportDirectoryHandling("", ["pathfinders"], false)).toEqual({
      kind: "import-now",
      projectName: "pathfinders",
      createNewProject: false,
    });
    expect(
      deriveImportDirectoryHandling("Queued Name", ["alpha", "beta"], true),
    ).toEqual({
      kind: "prompt-for-project-name",
      initialProjectName: "Queued Name",
      createNewProject: true,
    });
  });

  it("derives editor link navigation targets for internal, Arbor, and external links", () => {
    const currentLocationHref =
      "https://app.arbor.local/en/projects?view=board";
    const currentOrigin = "https://app.arbor.local";

    expect(
      deriveEditorLinkNavigationTarget(
        "https://example.com/projects?node=node-7",
        currentLocationHref,
        currentOrigin,
      ),
    ).toEqual({ kind: "push", href: "/projects?node=node-7" });
    expect(
      deriveEditorLinkNavigationTarget(
        "?tab=list",
        currentLocationHref,
        currentOrigin,
      ),
    ).toEqual({ kind: "push", href: "/en/projects?tab=list" });
    expect(
      deriveEditorLinkNavigationTarget(
        "https://app.arbor.local/settings?mode=advanced",
        currentLocationHref,
        currentOrigin,
      ),
    ).toEqual({ kind: "push", href: "/settings?mode=advanced" });
    expect(
      deriveEditorLinkNavigationTarget(
        "https://arbor/world/great-city",
        currentLocationHref,
        currentOrigin,
      ),
    ).toEqual({
      kind: "resolve-arbor-url",
      pathSegments: ["world", "great-city"],
    });
    expect(
      deriveEditorLinkNavigationTarget(
        "https://example.com/docs",
        currentLocationHref,
        currentOrigin,
      ),
    ).toEqual({ kind: "external", href: "https://example.com/docs" });
  });

  it("builds Arbor link name candidates without duplicates", () => {
    expect(buildArborLinkNameCandidates("great_city")).toEqual([
      "great_city",
      "great city",
    ]);
    expect(buildArborLinkNameCandidates("great-city")).toEqual([
      "great-city",
      "great city",
    ]);
  });

  it("finds Arbor search results by exact candidate or underscored name", () => {
    const results = [
      { node: { id: "node-1", name: "Great City" } },
      { node: { id: "node-2", name: "great city" } },
    ];

    expect(
      findMatchingArborSearchResult("great_city", "great city", results),
    ).toEqual({ node: { id: "node-2", name: "great city" } });
    expect(
      findMatchingArborSearchResult("Great_City", "Great City", results),
    ).toEqual({ node: { id: "node-1", name: "Great City" } });
  });

  it("resolves Arbor editor links from deepest matching segment first", async () => {
    const searchQueries: string[] = [];

    const matchedNodeId = await resolveArborEditorLinkTargetNodeId(
      ["world", "great-city"],
      async (query) => {
        searchQueries.push(query);
        if (query === "great city") {
          return [{ node: { id: "node-city", name: "great city" } }];
        }

        return [];
      },
    );

    expect(matchedNodeId).toBe("node-city");
    expect(searchQueries).toEqual(["great-city", "great city"]);
  });

  it("continues Arbor editor link resolution past search errors and unmatched candidates", async () => {
    const searchQueries: string[] = [];

    const matchedNodeId = await resolveArborEditorLinkTargetNodeId(
      ["world", "great-city"],
      async (query) => {
        searchQueries.push(query);
        if (query === "great-city") {
          throw new Error("search failed");
        }
        if (query === "world") {
          return [{ node: { id: "node-world", name: "world" } }];
        }

        return [];
      },
    );

    expect(matchedNodeId).toBe("node-world");
    expect(searchQueries).toEqual(["great-city", "great city", "world"]);
  });

  it("builds flat link-picker tree nodes in folder tree order", () => {
    const projectNodes: LinkPickerSourceNode[] = [
      {
        id: "folder-world",
        name: "World",
        type: "folder",
        parentId: "project-1",
      },
      {
        id: "note-intro",
        name: "Intro",
        type: "note",
        parentId: "folder-world",
      },
      {
        id: "folder-places",
        name: "Places",
        type: "folder",
        parentId: "folder-world",
      },
      {
        id: "note-bedlam",
        name: "Bedlam",
        type: "note",
        parentId: "folder-places",
      },
      {
        id: "note-readme",
        name: "Readme",
        type: "note",
        parentId: "project-1",
      },
      {
        id: "orphan-note",
        name: "Orphan",
        type: "note",
        parentId: "other-project",
      },
    ];

    expect(buildFlatLinkPickerTreeNodes("project-1", projectNodes)).toEqual([
      { id: "folder-world", name: "World", type: "folder", depth: 0 },
      { id: "note-intro", name: "Intro", type: "note", depth: 1 },
      { id: "folder-places", name: "Places", type: "folder", depth: 1 },
      { id: "note-bedlam", name: "Bedlam", type: "note", depth: 2 },
      { id: "note-readme", name: "Readme", type: "note", depth: 0 },
    ]);
    expect(buildFlatLinkPickerTreeNodes(null, projectNodes)).toEqual([]);
  });

  it("derives filtered node ids for tag, search, and intersection cases", () => {
    expect(deriveFilteredNodeIds([], undefined, "", undefined)).toBeNull();
    expect(
      deriveFilteredNodeIds(["tag-1"], ["node-1", "node-2"], "", undefined),
    ).toEqual(new Set(["node-1", "node-2"]));
    expect(
      deriveFilteredNodeIds([], undefined, "bed", ["node-2", "node-3"]),
    ).toEqual(new Set(["node-2", "node-3"]));
    expect(
      deriveFilteredNodeIds(["tag-1"], ["node-1", "node-2"], "bed", [
        "node-2",
        "node-3",
      ]),
    ).toEqual(new Set(["node-2"]));
  });

  it("derives import target node ids for project, folder, and note selections", () => {
    expect(deriveImportTargetNodeId(true, "project-1", false, undefined)).toBe(
      undefined,
    );
    expect(deriveImportTargetNodeId(false, undefined, false, undefined)).toBe(
      undefined,
    );
    expect(deriveImportTargetNodeId(false, "project-1", true, undefined)).toBe(
      undefined,
    );
    expect(deriveImportTargetNodeId(false, "project-1", false, undefined)).toBe(
      "project-1",
    );
    expect(
      deriveImportTargetNodeId(false, "project-1", false, {
        id: "folder-1",
        type: "folder",
        parentId: "project-1",
      }),
    ).toBe("folder-1");
    expect(
      deriveImportTargetNodeId(false, "project-1", false, {
        id: "note-1",
        type: "note",
        parentId: "folder-1",
      }),
    ).toBe("folder-1");
    expect(
      deriveImportTargetNodeId(false, "project-1", false, {
        id: "note-2",
        type: "note",
        parentId: null,
      }),
    ).toBe("project-1");
    expect(
      deriveImportTargetNodeId(false, "project-1", false, {
        id: "other-1",
        type: "project",
        parentId: null,
      }),
    ).toBe("project-1");
  });

  it("derives node move mutation inputs for inside, before, after, and missing parent cases", () => {
    const siblingNodes = [{ id: "node-a" }, { id: "node-b" }, { id: "node-c" }];

    expect(
      deriveNodeMoveMutationInput(
        "dragged-node",
        "target-folder",
        "inside",
        undefined,
        [],
      ),
    ).toEqual({ id: "dragged-node", newParentId: "target-folder" });
    expect(
      deriveNodeMoveMutationInput(
        "dragged-node",
        "node-b",
        "before",
        { id: "node-b", parentId: "folder-1" },
        siblingNodes,
      ),
    ).toEqual({
      id: "dragged-node",
      newParentId: "folder-1",
      position: 1,
    });
    expect(
      deriveNodeMoveMutationInput(
        "dragged-node",
        "node-b",
        "after",
        { id: "node-b", parentId: "folder-1" },
        siblingNodes,
      ),
    ).toEqual({
      id: "dragged-node",
      newParentId: "folder-1",
      position: 2,
    });
    expect(
      deriveNodeMoveMutationInput(
        "dragged-node",
        "missing-node",
        "before",
        { id: "missing-node", parentId: "folder-1" },
        siblingNodes,
      ),
    ).toEqual({
      id: "dragged-node",
      newParentId: "folder-1",
      position: 0,
    });
    expect(
      deriveNodeMoveMutationInput(
        "dragged-node",
        "missing-node",
        "after",
        { id: "missing-node", parentId: "folder-1" },
        siblingNodes,
      ),
    ).toEqual({
      id: "dragged-node",
      newParentId: "folder-1",
      position: siblingNodes.length,
    });
    expect(
      deriveNodeMoveMutationInput(
        "dragged-node",
        "node-b",
        "before",
        { id: "node-b", parentId: null },
        siblingNodes,
      ),
    ).toBeNull();
  });
});
