/**
 * Phase 1.7: ExportService Tests
 *
 * Tests for export operations:
 * - prosemirrorToMarkdown: Convert ProseMirror JSON to Markdown
 * - exportNodeAsMarkdown: Export a single node
 * - exportProjectAsMarkdown: Export project with all descendants
 * - exportNodeAsHtml: Export a single node as HTML
 * - exportProjectAsHtml: Export project as HTML
 * - Handles all TipTap node types and marks
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ExportService } from "@server/services/export-service";
import {
  createTestProject,
  createTestFolder,
  createTestNode,
} from "@tests/helpers/fixtures";

describe("ExportService", () => {
  let exportService: ExportService;

  beforeEach(() => {
    exportService = new ExportService();
  });

  describe("prosemirrorToMarkdown", () => {
    it("should convert a simple paragraph to Markdown", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello world" }],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toBe("Hello world\n");
    });

    it("should convert headings to Markdown", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "My Heading" }],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toBe("## My Heading\n");
    });

    it("should convert bold and italic marks", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "bold",
                marks: [{ type: "bold" }],
              },
              { type: "text", text: " and " },
              {
                type: "text",
                text: "italic",
                marks: [{ type: "italic" }],
              },
            ],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toBe("**bold** and *italic*\n");
    });

    it("should convert bullet lists", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Item 1" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Item 2" }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("- Item 1");
      expect(result).toContain("- Item 2");
    });

    it("should convert code blocks", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "typescript" },
            content: [{ type: "text", text: "const x = 1;" }],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("```typescript");
      expect(result).toContain("const x = 1;");
      expect(result).toContain("```");
    });

    it("should convert blockquotes", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "A wise quote" }],
              },
            ],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("> A wise quote");
    });

    it("should convert horizontal rules", () => {
      const doc = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Before" }] },
          { type: "horizontalRule" },
          { type: "paragraph", content: [{ type: "text", text: "After" }] },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("---");
    });

    it("should convert images", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { src: "https://example.com/img.png", alt: "An image" },
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("![An image](https://example.com/img.png)");
    });

    it("should convert links", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Click here",
                marks: [
                  { type: "link", attrs: { href: "https://example.com" } },
                ],
              },
            ],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("[Click here](https://example.com)");
    });

    it("should convert strikethrough and inline code", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "deleted",
                marks: [{ type: "strike" }],
              },
              { type: "text", text: " and " },
              {
                type: "text",
                text: "code",
                marks: [{ type: "code" }],
              },
            ],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toBe("~~deleted~~ and `code`\n");
    });

    it("should return empty string for empty document", () => {
      const doc = { type: "doc", content: [] };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toBe("");
    });

    it("should return empty string for document with no content property", () => {
      const doc = { type: "doc" };
      const result = exportService.prosemirrorToMarkdown(doc as any);
      expect(result).toBe("");
    });

    it("should convert heading without level attribute to h1", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "heading",
            content: [{ type: "text", text: "No Level" }],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toBe("# No Level\n");
    });

    it("should convert ordered lists", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "First" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Second" }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("1. First");
      expect(result).toContain("2. Second");
    });

    it("should convert hard breaks", () => {
      const doc = {
        type: "doc",
        content: [
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
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("Line one");
      expect(result).toContain("Line two");
    });

    it("should handle unknown node types with content", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "customBlock",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Custom" }],
              },
            ],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("Custom");
    });

    it("should handle unknown node types without content", () => {
      const doc = {
        type: "doc",
        content: [{ type: "unknownEmpty" }],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toBe("");
    });

    it("should handle image without src or alt attrs", () => {
      const doc = {
        type: "doc",
        content: [{ type: "image" }],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("![](");
    });

    it("should handle code block without language", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            content: [{ type: "text", text: "let x = 1;" }],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("```\nlet x = 1;```");
    });

    it("should handle nested bullet lists", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Parent item" }],
                  },
                  {
                    type: "bulletList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          {
                            type: "paragraph",
                            content: [{ type: "text", text: "Child item" }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("Parent item");
      expect(result).toContain("Child item");
    });

    it("should handle inline image in renderInlineNode", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Before " },
              {
                type: "image",
                attrs: { src: "http://img.png", alt: "pic" },
              },
              { type: "text", text: " After" },
            ],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("![pic](http://img.png)");
    });

    it("should handle inline hardBreak in renderInlineNode", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "First" },
              { type: "hardBreak" },
              { type: "text", text: "Second" },
            ],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("First  \nSecond");
    });

    it("should handle text with link mark that has no href", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "broken link",
                marks: [{ type: "link", attrs: {} }],
              },
            ],
          },
        ],
      };
      const result = exportService.prosemirrorToMarkdown(doc);
      expect(result).toContain("broken link");
    });
  });

  describe("exportNodeAsMarkdown", () => {
    it("should export a note with ProseMirror content", async () => {
      const project = await createTestProject("Export Project");
      const noteContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello from export" }],
          },
        ],
      };
      const note = await createTestNode({
        type: "note",
        name: "My Note",
        parentId: project.id,
        content: noteContent,
      });

      const result = await exportService.exportNodeAsMarkdown(note.id);
      expect(result).toContain("# My Note");
      expect(result).toContain("Hello from export");
    });

    it("should throw for non-existent node", async () => {
      await expect(
        exportService.exportNodeAsMarkdown(
          "00000000-0000-0000-0000-000000000000",
        ),
      ).rejects.toThrow("Node not found");
    });

    it("should handle node with no content", async () => {
      const project = await createTestProject("Empty Project");
      const note = await createTestNode({
        type: "note",
        name: "Empty Note",
        parentId: project.id,
      });

      const result = await exportService.exportNodeAsMarkdown(note.id);
      expect(result).toContain("# Empty Note");
    });

    it("should export a folder node (non-note type)", async () => {
      const project = await createTestProject("Folder Export Project");
      const folder = await createTestFolder("My Folder", project.id);

      const result = await exportService.exportNodeAsMarkdown(folder.id);
      expect(result).toContain("# My Folder");
    });
  });

  describe("exportProjectAsMarkdown", () => {
    it("should export a project with descendants", async () => {
      const project = await createTestProject("My Novel");
      const chapter = await createTestFolder("Chapter 1", project.id);
      const noteContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "It was a dark and stormy night." },
            ],
          },
        ],
      };
      await createTestNode({
        type: "note",
        name: "Scene 1",
        parentId: chapter.id,
        content: noteContent,
      });

      const result = await exportService.exportProjectAsMarkdown(project.id);
      expect(result).toContain("# My Novel");
      expect(result).toContain("## Chapter 1");
      expect(result).toContain("### Scene 1");
      expect(result).toContain("It was a dark and stormy night.");
    });

    it("should throw for non-existent project", async () => {
      await expect(
        exportService.exportProjectAsMarkdown(
          "00000000-0000-0000-0000-000000000000",
        ),
      ).rejects.toThrow("Node not found");
    });
  });

  describe("exportNodeAsHtml", () => {
    it("should return valid HTML document", async () => {
      const project = await createTestProject("HTML Project");
      const noteContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "HTML test content" }],
          },
        ],
      };
      const note = await createTestNode({
        type: "note",
        name: "HTML Note",
        parentId: project.id,
        content: noteContent,
      });

      const result = await exportService.exportNodeAsHtml(note.id);
      expect(result).toContain("<!DOCTYPE html>");
      expect(result).toContain("<html");
      expect(result).toContain("</html>");
      expect(result).toContain("HTML test content");
    });
  });

  describe("exportProjectAsHtml", () => {
    it("should return valid HTML with title", async () => {
      const project = await createTestProject("PDF Export Project");
      await createTestNode({
        type: "note",
        name: "A Note",
        parentId: project.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Content for PDF" }],
            },
          ],
        },
      });

      const result = await exportService.exportProjectAsHtml(project.id);
      expect(result).toContain("<!DOCTYPE html>");
      expect(result).toContain("<title>PDF Export Project</title>");
      expect(result).toContain("Content for PDF");
    });

    it("should throw for non-existent project", async () => {
      await expect(
        exportService.exportProjectAsHtml(
          "00000000-0000-0000-0000-000000000000",
        ),
      ).rejects.toThrow("Node not found");
    });
  });
});
