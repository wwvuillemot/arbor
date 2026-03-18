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

    it("should omit a note heading when note names are excluded", async () => {
      const project = await createTestProject("Hidden Note Heading Project");
      const note = await createTestNode({
        type: "note",
        name: "Hidden Note",
        parentId: project.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Heading-free content" }],
            },
          ],
        },
      });

      const result = await exportService.exportNodeAsMarkdown(note.id, {
        includeNoteNames: false,
      });

      expect(result).toContain("Heading-free content");
      expect(result).not.toContain("# Hidden Note");
    });

    it("should export a folder node (non-note type)", async () => {
      const project = await createTestProject("Folder Export Project");
      const folder = await createTestFolder("My Folder", project.id);

      const result = await exportService.exportNodeAsMarkdown(folder.id);
      expect(result).toContain("# My Folder");
    });

    it("should export hero images for container nodes", async () => {
      const project = await createTestProject("Folder Hero Export Project");
      const folder = await createTestNode({
        type: "folder",
        name: "Mood Board",
        parentId: project.id,
        metadata: { heroAttachmentId: "hero-folder-1" },
      });

      const result = await exportService.exportNodeAsMarkdown(folder.id, {
        includeFolderNames: false,
      });

      expect(result).toContain(
        "![Mood Board](http://localhost:3001/media/hero-folder-1)",
      );
      expect(result).not.toContain("# Mood Board");
    });

    it("should emit a LaTeX title page for a folder with hero image when outputFormat is pdf", async () => {
      const project = await createTestProject("PDF Folder Hero Project");
      const folder = await createTestNode({
        type: "folder",
        name: "Visual Chapter",
        parentId: project.id,
        metadata: { heroAttachmentId: "hero-pdf-1" },
      });

      const result = await exportService.exportNodeAsMarkdown(folder.id, {
        outputFormat: "pdf",
      });

      expect(result).toContain("```{=latex}");
      expect(result).toContain("\\includegraphics");
      expect(result).toContain("http://localhost:3001/media/hero-pdf-1");
      expect(result).toContain("{\\Large Visual Chapter}");
      // Should not use standard markdown image syntax
      expect(result).not.toContain("![Visual Chapter]");
      // Should not have a separate Markdown heading
      expect(result).not.toContain("# Visual Chapter");
    });

    it("should emit a plain heading with no newpage for a folder without hero image when outputFormat is pdf", async () => {
      const project = await createTestProject("PDF No-Hero Folder Project");
      const folder = await createTestNode({
        type: "folder",
        name: "Plain Chapter",
        parentId: project.id,
      });

      const result = await exportService.exportNodeAsMarkdown(folder.id, {
        outputFormat: "pdf",
      });

      expect(result).toContain("# Plain Chapter");
      expect(result).not.toContain("\\newpage");
      expect(result).not.toContain("```{=latex}");
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

    it("should omit folder headings when folder names are excluded", async () => {
      const project = await createTestProject("Manual Sort Novel");
      const chapter = await createTestFolder("Chapter Hidden", project.id);
      await createTestNode({
        type: "note",
        name: "Scene Visible",
        parentId: chapter.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Visible scene content" }],
            },
          ],
        },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id, {
        includeFolderNames: false,
      });

      expect(result).not.toContain("# Manual Sort Novel");
      expect(result).not.toContain("## Chapter Hidden");
      expect(result).toContain("### Scene Visible");
      expect(result).toContain("Visible scene content");
    });

    it("should emit pdf layout for folders (image+title) and notes (newpage+title+content) when outputFormat is pdf", async () => {
      const project = await createTestNode({
        type: "project",
        name: "PDF Novel",
        slug: "pdf-novel",
        metadata: { heroAttachmentId: "hero-cover" },
      });
      const chapter = await createTestNode({
        type: "folder",
        name: "Chapter One",
        parentId: project.id,
        slug: "chapter-one",
        metadata: { heroAttachmentId: "hero-ch1" },
      });
      await createTestNode({
        type: "note",
        name: "Opening Scene",
        parentId: chapter.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "It was a dark night." }],
            },
          ],
        },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id, {
        outputFormat: "pdf",
      });

      // Root project: LaTeX title page (no \newpage since it's first)
      expect(result).toContain("http://localhost:3001/media/hero-cover");
      expect(result).toContain("{\\Large PDF Novel}");
      // The first LaTeX block (root project) must NOT contain \newpage
      const firstLatexBlock = result.split("```{=latex}")[1] ?? "";
      expect(firstLatexBlock).not.toContain("\\newpage");

      // Folder child: LaTeX title page with \newpage
      expect(result).toContain("http://localhost:3001/media/hero-ch1");
      expect(result).toContain("{\\Large Chapter One}");

      // Note child: \newpage before heading + content
      expect(result).toContain("\\newpage");
      expect(result).toContain("Opening Scene");
      expect(result).toContain("It was a dark night.");

      // No standard markdown image syntax
      expect(result).not.toContain("![PDF Novel]");
      expect(result).not.toContain("![Chapter One]");
    });

    it("should emit newpage before each note in pdf format even without a name", async () => {
      const project = await createTestProject("PDF Note Newpage Project");
      await createTestNode({
        type: "note",
        name: "Hidden Note",
        parentId: project.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Body text here" }],
            },
          ],
        },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id, {
        outputFormat: "pdf",
        includeNoteNames: false,
      });

      expect(result).toContain("\\newpage");
      expect(result).toContain("Body text here");
      expect(result).not.toContain("# Hidden Note");
    });

    it("should place folder hero image before heading in standard markdown export", async () => {
      const project = await createTestNode({
        type: "project",
        name: "Image Order Project",
        slug: "image-order-project",
        metadata: { heroAttachmentId: "hero-order-cover" },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id);

      const imageIndex = result.indexOf(
        "![Image Order Project](http://localhost:3001/media/hero-order-cover)",
      );
      const headingIndex = result.indexOf("# Image Order Project");

      expect(imageIndex).toBeGreaterThanOrEqual(0);
      expect(headingIndex).toBeGreaterThanOrEqual(0);
      // Image must appear before the heading
      expect(imageIndex).toBeLessThan(headingIndex);
    });

    it("should add a horizontal rule separator before notes in standard markdown export", async () => {
      const project = await createTestProject("HR Separator Project");
      await createTestNode({
        type: "note",
        name: "First Note",
        parentId: project.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Note body" }],
            },
          ],
        },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id);

      expect(result).toContain("---");
      expect(result).toContain("## First Note");
      expect(result).toContain("Note body");
    });

    it("should add an OOXML page break before notes in docx export", async () => {
      const project = await createTestProject("DOCX Page Break Project");
      await createTestNode({
        type: "note",
        name: "Docx Note",
        parentId: project.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Docx note body" }],
            },
          ],
        },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id, {
        outputFormat: "docx",
      });

      expect(result).toContain("```{=openxml}");
      expect(result).toContain('<w:br w:type="page"');
      expect(result).toContain("## Docx Note");
      expect(result).toContain("Docx note body");
      // Should NOT use PDF page break syntax
      expect(result).not.toContain("```{=latex}");
      expect(result).not.toContain("\\newpage");
    });

    it("should exclude root heading and hero image from epub exports", async () => {
      const project = await createTestNode({
        type: "project",
        name: "My Novel",
        slug: "my-novel-epub",
        metadata: { heroAttachmentId: "hero-epub-cover" },
      });
      const section = await createTestFolder("Part One", project.id);
      await createTestNode({
        type: "note",
        name: "Chapter 1",
        parentId: section.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Opening words." }],
            },
          ],
        },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id, {
        outputFormat: "epub",
      });

      // Root heading and its hero must be absent
      expect(result).not.toContain("# My Novel");
      expect(result).not.toContain("hero-epub-cover");
      // Section is H1, note is H2
      expect(result).toContain("# Part One");
      expect(result).toContain("## Chapter 1");
      expect(result).toContain("Opening words.");
    });

    it("should map epub sections to H1 and their notes to H2", async () => {
      const project = await createTestProject("EPUB Novel");
      const sectionB = await createTestFolder("Section B", project.id);
      const sectionC = await createTestFolder("Section C", project.id);
      await createTestNode({
        type: "note",
        name: "Chapter 1",
        parentId: sectionB.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Ch1 body." }],
            },
          ],
        },
      });
      await createTestNode({
        type: "note",
        name: "Chapter 2",
        parentId: sectionB.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Ch2 body." }],
            },
          ],
        },
      });
      await createTestNode({
        type: "note",
        name: "Chapter 3",
        parentId: sectionC.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Ch3 body." }],
            },
          ],
        },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id, {
        outputFormat: "epub",
      });

      // Root is excluded
      expect(result).not.toContain("# EPUB Novel");
      // Sections are H1
      expect(result).toContain("# Section B");
      expect(result).toContain("# Section C");
      // Notes are H2
      expect(result).toContain("## Chapter 1");
      expect(result).toContain("## Chapter 2");
      expect(result).toContain("## Chapter 3");
      // No horizontal-rule separators between notes
      expect(result).not.toContain("\n---\n");
    });

    it("should include folder hero images as section images in epub exports", async () => {
      const project = await createTestProject("EPUB Illustrated Novel");
      const section = await createTestNode({
        type: "folder",
        name: "Visual Section",
        parentId: project.id,
        metadata: { heroAttachmentId: "hero-section-epub" },
      });
      await createTestNode({
        type: "note",
        name: "Scene 1",
        parentId: section.id,
        content: { type: "doc", content: [] },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id, {
        outputFormat: "epub",
      });

      // Section hero image is present and appears AFTER the H1 heading so
      // that Pandoc's --split-level=1 can split a new page at the heading
      // boundary and display both the title and image on that page.
      // The hero uses an empty alt string so Pandoc does not emit a <figcaption>
      // that would duplicate the folder name shown in the H1.
      expect(result).toContain("hero-section-epub");
      expect(result).toContain("![](");
      const heroIndex = result.indexOf("hero-section-epub");
      const headingIndex = result.indexOf("# Visual Section");
      expect(heroIndex).toBeGreaterThanOrEqual(0);
      expect(headingIndex).toBeGreaterThanOrEqual(0);
      expect(headingIndex).toBeLessThan(heroIndex);
    });

    it("should render chapter icon centered below each note title in epub exports", async () => {
      const project = await createTestProject("EPUB Icon Novel");
      const section = await createTestNode({
        type: "folder",
        name: "Icon Section",
        parentId: project.id,
        metadata: { chapterIconAttachmentId: "icon-svg-1" },
      });
      await createTestNode({
        type: "note",
        name: "Opening",
        parentId: section.id,
        content: { type: "doc", content: [] },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id, {
        outputFormat: "epub",
      });

      const lines = result.split("\n");

      // Folder H1: title only — the chapter icon does NOT appear on the folder page.
      const folderHeading = lines.find((line) => line.startsWith("# "));
      expect(folderHeading).toBeDefined();
      expect(folderHeading).toContain("Icon Section");
      expect(folderHeading).not.toContain("icon-svg-1");

      // Note H2: just the note name — icon is NOT inline in the heading.
      const noteHeading = lines.find((line) => line.startsWith("## "));
      expect(noteHeading).toBeDefined();
      expect(noteHeading).toContain("Opening");
      expect(noteHeading).not.toContain("icon-svg-1");

      // Chapter icon appears immediately after the note heading as a plain
      // centered fenced div.  The CSS rule section.level2 { break-before: page }
      // starts each note on a new page; the icon follows the heading naturally
      // on that same page without any outer wrapper div.
      const noteHeadingIndex = lines.indexOf(noteHeading!);
      const afterHeading = lines.slice(noteHeadingIndex + 1).join("\n");
      expect(afterHeading).toContain("icon-svg-1");
      expect(afterHeading).toContain("{width=15%}");
      expect(afterHeading).toContain("text-align:center");
    });

    it("should apply chapter icon and dinkus to all sibling folders, inheriting from the nearest ancestor with a value", async () => {
      // Root project has a fallback chapter icon.
      const project = await createTestNode({
        type: "project",
        name: "EPUB Multi-Section Novel",
        metadata: { chapterIconAttachmentId: "icon-root" },
      });
      // Section A overrides the icon with its own.
      const sectionA = await createTestNode({
        type: "folder",
        name: "Section A",
        parentId: project.id,
        metadata: { chapterIconAttachmentId: "icon-section-a" },
      });
      // Section B has no icon — must inherit the root project icon.
      const sectionB = await createTestNode({
        type: "folder",
        name: "Section B",
        parentId: project.id,
        metadata: {},
      });
      await createTestNode({
        type: "note",
        name: "Note in A",
        parentId: sectionA.id,
        content: { type: "doc", content: [] },
      });
      await createTestNode({
        type: "note",
        name: "Note in B",
        parentId: sectionB.id,
        content: { type: "doc", content: [] },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id, {
        outputFormat: "epub",
      });

      // Section A uses its own icon.
      expect(result).toContain("icon-section-a");
      // Section B has no icon of its own; it must inherit the root project icon.
      expect(result).toContain("icon-root");
    });

    it("should inject chapter icon after first heading in note body when includeNoteNames is false", async () => {
      const project = await createTestProject("EPUB Icon No Names Novel");
      const section = await createTestNode({
        type: "folder",
        name: "Icon Section No Names",
        parentId: project.id,
        metadata: { chapterIconAttachmentId: "icon-svg-nonames" },
      });
      await createTestNode({
        type: "note",
        name: "Opening",
        parentId: section.id,
        content: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "My Chapter Title" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Chapter body text." }],
            },
          ],
        },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id, {
        outputFormat: "epub",
        includeNoteNames: false,
      });

      // Icon must appear in the output (injected after the note-body H1).
      expect(result).toContain("icon-svg-nonames");
      expect(result).toContain("{width=15%}");
      expect(result).toContain("text-align:center");

      // Icon must come AFTER the chapter heading, not before.
      const headingPos = result.indexOf("# My Chapter Title");
      const iconPos = result.indexOf("icon-svg-nonames");
      expect(headingPos).toBeGreaterThanOrEqual(0);
      expect(iconPos).toBeGreaterThan(headingPos);
    });

    it("should not inject chapter icon in standard markdown exports", async () => {
      const project = await createTestProject("Standard Icon Novel");
      const section = await createTestNode({
        type: "folder",
        name: "Icon Section Std",
        parentId: project.id,
        metadata: { chapterIconAttachmentId: "icon-svg-std" },
      });
      await createTestNode({
        type: "note",
        name: "Scene",
        parentId: section.id,
        content: { type: "doc", content: [] },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id);

      expect(result).not.toContain("icon-svg-std");
    });

    it("should inject dinkus between consecutive notes but not before the first note in a section", async () => {
      const project = await createTestProject("EPUB Dinkus Novel");
      const section = await createTestNode({
        type: "folder",
        name: "Dinkus Section",
        parentId: project.id,
        metadata: { dinkusAttachmentId: "dinkus-svg-1" },
      });
      await createTestNode({
        type: "note",
        name: "Note A",
        parentId: section.id,
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Body A." }] },
          ],
        },
      });
      await createTestNode({
        type: "note",
        name: "Note B",
        parentId: section.id,
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Body B." }] },
          ],
        },
      });
      await createTestNode({
        type: "note",
        name: "Note C",
        parentId: section.id,
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Body C." }] },
          ],
        },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id, {
        outputFormat: "epub",
      });

      // Dinkus appears between notes but NOT before Note A (first note after folder heading)
      const firstNoteIndex = result.indexOf("## Note A");
      const firstDinkusIndex = result.indexOf("dinkus-svg-1");

      expect(firstDinkusIndex).toBeGreaterThanOrEqual(0);
      // Dinkus must come AFTER the first note heading (not before it)
      expect(firstNoteIndex).toBeLessThan(firstDinkusIndex);
      // There should be exactly 2 dinkus occurrences (between A↔B and B↔C)
      const dinkusCount = (result.match(/dinkus-svg-1/g) ?? []).length;
      expect(dinkusCount).toBe(2);
    });

    it("should use project-level dinkus as fallback when folder has none", async () => {
      const project = await createTestNode({
        type: "project",
        name: "EPUB Fallback Novel",
        slug: "epub-fallback-novel",
        metadata: { dinkusAttachmentId: "dinkus-fallback" },
      });
      const section = await createTestNode({
        type: "folder",
        name: "Fallback Section",
        parentId: project.id,
        // No dinkusAttachmentId — should inherit from project
      });
      await createTestNode({
        type: "note",
        name: "Note 1",
        parentId: section.id,
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Body 1." }] },
          ],
        },
      });
      await createTestNode({
        type: "note",
        name: "Note 2",
        parentId: section.id,
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Body 2." }] },
          ],
        },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id, {
        outputFormat: "epub",
      });

      // Project-level dinkus used between the two notes
      expect(result).toContain("dinkus-fallback");
      const note1Index = result.indexOf("## Note 1");
      const dinkusIndex = result.indexOf("dinkus-fallback");
      expect(note1Index).toBeLessThan(dinkusIndex);
    });

    it("should use folder dinkus over project-level dinkus when both are set", async () => {
      const project = await createTestNode({
        type: "project",
        name: "EPUB Override Novel",
        slug: "epub-override-novel",
        metadata: { dinkusAttachmentId: "dinkus-project" },
      });
      const section = await createTestNode({
        type: "folder",
        name: "Override Section",
        parentId: project.id,
        metadata: { dinkusAttachmentId: "dinkus-folder" },
      });
      await createTestNode({
        type: "note",
        name: "Note X",
        parentId: section.id,
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Body X." }] },
          ],
        },
      });
      await createTestNode({
        type: "note",
        name: "Note Y",
        parentId: section.id,
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Body Y." }] },
          ],
        },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id, {
        outputFormat: "epub",
      });

      expect(result).toContain("dinkus-folder");
      expect(result).not.toContain("dinkus-project");
    });

    it("should replace standalone --- lines inside note content with the dinkus in EPUB mode", async () => {
      const project = await createTestProject("EPUB Inline HR Novel");
      const section = await createTestNode({
        type: "folder",
        name: "HR Section",
        parentId: project.id,
        metadata: { dinkusAttachmentId: "dinkus-hr-svg" },
      });
      // Note whose content contains a thematic break (---)
      await createTestNode({
        type: "note",
        name: "Scene Note",
        parentId: section.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Before break." }],
            },
            { type: "horizontalRule" },
            {
              type: "paragraph",
              content: [{ type: "text", text: "After break." }],
            },
          ],
        },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id, {
        outputFormat: "epub",
      });

      // The raw --- should not appear; the dinkus attachment ID should replace it
      expect(result).not.toMatch(/^---$/m);
      expect(result).toContain("dinkus-hr-svg");
      // Both paragraphs must still be present
      expect(result).toContain("Before break.");
      expect(result).toContain("After break.");
      // Dinkus block must appear between the two paragraphs
      const beforeIdx = result.indexOf("Before break.");
      const dinkusIdx = result.indexOf("dinkus-hr-svg");
      const afterIdx = result.indexOf("After break.");
      expect(beforeIdx).toBeLessThan(dinkusIdx);
      expect(dinkusIdx).toBeLessThan(afterIdx);
    });

    it("should include project and folder hero images in project exports", async () => {
      const project = await createTestNode({
        type: "project",
        name: "Illustrated Novel",
        slug: "illustrated-novel",
        metadata: { heroAttachmentId: "hero-project-1" },
      });
      const chapter = await createTestNode({
        type: "folder",
        name: "Chapter One",
        parentId: project.id,
        slug: "chapter-one",
        metadata: { heroAttachmentId: "hero-folder-2" },
      });

      await createTestNode({
        type: "note",
        name: "Opening Scene",
        parentId: chapter.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Hero-driven section content" }],
            },
          ],
        },
      });

      const result = await exportService.exportProjectAsMarkdown(project.id);

      expect(result).toContain(
        "![Illustrated Novel](http://localhost:3001/media/hero-project-1)",
      );
      expect(result).toContain("## Chapter One");
      expect(result).toContain(
        "![Chapter One](http://localhost:3001/media/hero-folder-2)",
      );
      expect(result).toContain("Hero-driven section content");
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

    it("should omit the HTML title when folder names are excluded", async () => {
      const project = await createTestProject("Untitled PDF Project");
      await createTestNode({
        type: "note",
        name: "A Note",
        parentId: project.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Content with hidden title" }],
            },
          ],
        },
      });

      const result = await exportService.exportProjectAsHtml(project.id, {
        includeFolderNames: false,
      });

      expect(result).toContain("<title>Export</title>");
      expect(result).toContain("Content with hidden title");
      expect(result).not.toContain("<title>Untitled PDF Project</title>");
    });

    it("should render hero images as centered section images in HTML exports", async () => {
      const project = await createTestNode({
        type: "project",
        name: "Illustrated PDF Project",
        slug: "illustrated-pdf-project",
        metadata: { heroAttachmentId: "hero-project-html-1" },
      });
      const chapter = await createTestNode({
        type: "folder",
        name: "Visual Chapter",
        parentId: project.id,
        slug: "visual-chapter",
        metadata: { heroAttachmentId: "hero-folder-html-1" },
      });

      await createTestNode({
        type: "note",
        name: "Visual Scene",
        parentId: chapter.id,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Illustrated export body" }],
            },
          ],
        },
      });

      const result = await exportService.exportProjectAsHtml(project.id);

      expect(result).toContain(
        '<img src="http://localhost:3001/media/hero-project-html-1" alt="Illustrated PDF Project">',
      );
      expect(result).toContain(
        '<img src="http://localhost:3001/media/hero-folder-html-1" alt="Visual Chapter">',
      );
      // CSS styles standalone images (body > img) for hero presentation
      expect(result).toContain("body > img");
      expect(result).toContain("Illustrated export body");
    });
  });
});
