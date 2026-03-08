import { describe, expect, it } from "vitest";
import {
  buildEmbeddingText,
  extractTextFromContent,
} from "@/services/embedding-content";

describe("embedding content helpers", () => {
  it("extracts text from nested ProseMirror content with hard breaks", () => {
    const document = {
      type: "doc",
      content: [
        {
          type: "heading",
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Line one" },
            { type: "hardBreak" },
            { type: "text", text: "Line two" },
          ],
        },
      ],
    };

    const extractedText = extractTextFromContent(document);

    expect(extractedText).toContain("Title");
    expect(extractedText).toContain("Line one");
    expect(extractedText).toContain("Line two");
  });

  it("builds embedding text from the node name and content", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body text" }],
        },
      ],
    };

    expect(buildEmbeddingText("Chapter One", content)).toBe(
      "Chapter One\nBody text",
    );
  });

  it("returns the trimmed node name when content is empty", () => {
    expect(buildEmbeddingText("Standalone Title", null)).toBe(
      "Standalone Title",
    );
  });
});
