import { describe, expect, it } from "vitest";

import {
  getImportSourcePath,
  getNoteFileNameCandidates,
  joinImportSourcePath,
  normalizeImportSourcePath,
  normalizeTiptapContent,
  stripTopLevelImportSegment,
  transformTiptapContent,
  type ImportHealingNode,
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
});
