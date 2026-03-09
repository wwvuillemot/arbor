import { describe, expect, it } from "vitest";
import {
  buildUpdatedContent,
  markdownToTipTap,
} from "@/services/mcp-tool-executor-content";

describe("mcp-tool-executor content helpers", () => {
  it("converts markdown into TipTap headings, links, and code blocks", () => {
    const document = markdownToTipTap(
      "# Chapter One\n\nMeet the [hero](/notes/hero).\n\n```ts\nconst answer = 42;\n```",
    );

    expect(document.content[0]).toMatchObject({
      type: "heading",
      attrs: { level: 1 },
    });
    expect(document.content[1]).toMatchObject({ type: "paragraph" });
    expect(document.content[1]?.content?.[1]).toMatchObject({
      type: "text",
      text: "hero",
      marks: [{ type: "link", attrs: { href: "/notes/hero" } }],
    });
    expect(document.content[2]).toMatchObject({
      type: "codeBlock",
      attrs: { language: "ts" },
    });
  });

  it("preserves existing image nodes when replacing markdown content", () => {
    const existingDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Original text" }],
        },
        {
          type: "image",
          attrs: { src: "https://example.com/cover.png", alt: "Cover art" },
        },
      ],
    };

    const updatedDocument = buildUpdatedContent(
      existingDocument,
      "# Revised\n\nFresh copy.",
    ) as {
      content: Array<{ type: string; attrs?: Record<string, unknown> }>;
    };

    expect(
      updatedDocument.content.some((node) => node.type === "heading"),
    ).toBe(true);
    expect(updatedDocument.content).toContainEqual({
      type: "image",
      attrs: { src: "https://example.com/cover.png", alt: "Cover art" },
    });
  });

  it("returns non-string content unchanged", () => {
    const nextContent = { type: "doc", content: [] };

    expect(buildUpdatedContent(undefined, nextContent)).toBe(nextContent);
  });
});
