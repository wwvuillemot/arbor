import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  DEFAULT_PDF_TEMPLATE_ID,
  PandocExportService,
} from "@server/services/pandoc-export-service";

describe("PandocExportService", () => {
  beforeEach(() => {
    delete process.env.ARBOR_DOCX_REFERENCE_PATH;
  });

  it("exports markdown to docx bytes and passes a reference doc when configured", async () => {
    const tempRootDirectory = await mkdtemp(
      path.join(tmpdir(), "arbor-pandoc-unit-"),
    );
    const referenceDocPath = path.join(tempRootDirectory, "reference.docx");
    await writeFile(referenceDocPath, "reference-bytes");

    const runPandoc = vi.fn(async (_command: string, args: string[]) => {
      const inputPath = args.find((arg) => arg.endsWith("input.md"));
      const outputArg = args.find((arg) => arg.startsWith("--output="));
      const referenceArg = args.find((arg) =>
        arg.startsWith("--reference-doc="),
      );

      expect(inputPath).toBeTruthy();
      expect(outputArg).toBeTruthy();
      expect(referenceArg).toBe(`--reference-doc=${referenceDocPath}`);

      const markdown = await readFile(inputPath!, "utf8");
      const outputPath = outputArg!.replace("--output=", "");

      await writeFile(outputPath, `DOCX:${markdown}`);
    });

    const pandocExportService = new PandocExportService({
      pandocPath: "pandoc-test",
      referenceDocPath,
      runPandoc,
      temporaryDirectoryRoot: tempRootDirectory,
    });

    const docxBuffer =
      await pandocExportService.exportMarkdownAsDocx("# Arbor\n\nHello");

    expect(runPandoc).toHaveBeenCalledTimes(1);
    expect(docxBuffer.toString("utf8")).toBe("DOCX:# Arbor\n\nHello");
  });

  it("exports markdown to pdf bytes with the selected template arguments", async () => {
    const tempRootDirectory = await mkdtemp(
      path.join(tmpdir(), "arbor-pandoc-pdf-"),
    );

    const runPandoc = vi.fn(async (_command: string, args: string[]) => {
      const inputPath = args.find((arg) => arg.endsWith("input.md"));
      const outputArg = args.find((arg) => arg.startsWith("--output="));

      expect(args).toContain("--pdf-engine=xelatex");
      expect(args).toContain("--toc");
      expect(args).toContain("--variable=geometry:margin=1.15in");
      expect(args).not.toContain("--number-sections");
      expect(args).not.toContain("--top-level-division=chapter");
      expect(args).not.toContain("--variable=documentclass:book");

      const markdown = await readFile(inputPath!, "utf8");
      const outputPath = outputArg!.replace("--output=", "");

      await writeFile(outputPath, `PDF:${markdown}`);
    });

    const pandocExportService = new PandocExportService({
      pandocPath: "pandoc-test",
      runPandoc,
      temporaryDirectoryRoot: tempRootDirectory,
    });

    const pdfBuffer = await pandocExportService.exportMarkdownAsPdf(
      "# Arbor\n\nHello",
      "book",
    );

    expect(runPandoc).toHaveBeenCalledTimes(1);
    expect(pdfBuffer.toString("utf8")).toBe("PDF:# Arbor\n\nHello");
  });

  it("exposes the default pdf template metadata", () => {
    const pandocExportService = new PandocExportService();

    expect(pandocExportService.getPdfTemplates()).toEqual([
      {
        id: DEFAULT_PDF_TEMPLATE_ID,
        label: "Standard",
        description: "Clean PDF with balanced margins for everyday sharing.",
        isDefault: true,
      },
      {
        id: "book",
        label: "Book",
        description:
          "Long-form layout with a table of contents reflecting the document hierarchy.",
        isDefault: false,
      },
    ]);
  });

  it("exports markdown to epub bytes and passes title metadata", async () => {
    const tempRootDirectory = await mkdtemp(
      path.join(tmpdir(), "arbor-pandoc-epub-"),
    );

    const runPandoc = vi.fn(async (_command: string, args: string[]) => {
      const inputPath = args.find((arg) => arg.endsWith("input.md"));
      const outputArg = args.find((arg) => arg.startsWith("--output="));
      const cssArg = args.find((arg) => arg.startsWith("--css="));

      expect(args).toContain("--standalone");
      expect(args).toContain("--split-level=2");
      expect(args).toContain("--metadata=title:My Book");
      expect(outputArg).toMatch(/\.epub$/);
      expect(args).not.toContain("--epub-cover-image");

      // Verify CSS file was written.  With --split-level=2 each note gets its
      // own XHTML file so the file boundary provides the page break; no CSS
      // break-before rule is needed for notes.
      expect(cssArg).toBeTruthy();
      const cssPath = cssArg!.replace("--css=", "");
      const cssContent = await readFile(cssPath, "utf8");
      expect(cssContent).toContain("section.level2");

      const markdown = await readFile(inputPath!, "utf8");
      const outputPath = outputArg!.replace("--output=", "");

      await writeFile(outputPath, `EPUB:${markdown}`);
    });

    const pandocExportService = new PandocExportService({
      pandocPath: "pandoc-test",
      runPandoc,
      temporaryDirectoryRoot: tempRootDirectory,
    });

    const epubBuffer = await pandocExportService.exportMarkdownAsEpub(
      "# Arbor\n\nHello",
      "My Book",
    );

    expect(runPandoc).toHaveBeenCalledTimes(1);
    expect(epubBuffer.toString("utf8")).toBe("EPUB:# Arbor\n\nHello");
  });

  it("passes author, description, and language metadata flags to pandoc", async () => {
    const tempRootDirectory = await mkdtemp(
      path.join(tmpdir(), "arbor-pandoc-epub-meta-"),
    );

    const runPandoc = vi.fn(async (_command: string, args: string[]) => {
      expect(args).toContain("--metadata=author:Jane Doe");
      expect(args).toContain("--metadata=description:A great book");
      expect(args).toContain("--metadata=lang:en-US");

      const outputPath = args
        .find((arg) => arg.startsWith("--output="))!
        .replace("--output=", "");
      await writeFile(outputPath, "EPUB:meta-test");
    });

    const pandocExportService = new PandocExportService({
      pandocPath: "pandoc-test",
      runPandoc,
      temporaryDirectoryRoot: tempRootDirectory,
    });

    await pandocExportService.exportMarkdownAsEpub(
      "# Book",
      "My Title",
      undefined,
      undefined,
      { author: "Jane Doe", description: "A great book", language: "en-US" },
    );

    expect(runPandoc).toHaveBeenCalledTimes(1);
  });

  it("omits metadata flags when epubMetadata fields are empty or absent", async () => {
    const tempRootDirectory = await mkdtemp(
      path.join(tmpdir(), "arbor-pandoc-epub-nometa-"),
    );

    const capturedArgs: string[] = [];
    const runPandoc = vi.fn(async (_command: string, args: string[]) => {
      capturedArgs.push(...args);
      const outputPath = args
        .find((arg) => arg.startsWith("--output="))!
        .replace("--output=", "");
      await writeFile(outputPath, "EPUB:no-meta");
    });

    const pandocExportService = new PandocExportService({
      pandocPath: "pandoc-test",
      runPandoc,
      temporaryDirectoryRoot: tempRootDirectory,
    });

    await pandocExportService.exportMarkdownAsEpub("# Book", "Title");

    expect(capturedArgs.some((a) => a.startsWith("--metadata=author"))).toBe(
      false,
    );
    expect(
      capturedArgs.some((a) => a.startsWith("--metadata=description")),
    ).toBe(false);
    expect(capturedArgs.some((a) => a.startsWith("--metadata=lang"))).toBe(
      false,
    );
  });

  it("passes cover image path to pandoc when a cover buffer is provided", async () => {
    const tempRootDirectory = await mkdtemp(
      path.join(tmpdir(), "arbor-pandoc-epub-cover-"),
    );
    const fakeCoverBuffer = Buffer.from("PNG-IMAGE-BYTES");

    const runPandoc = vi.fn(async (_command: string, args: string[]) => {
      const coverArg = args.find((arg) =>
        arg.startsWith("--epub-cover-image="),
      );

      expect(coverArg).toBeTruthy();
      expect(coverArg).toMatch(/cover\.png$/);

      // Verify the cover file was written to disk with the right content
      const coverPath = coverArg!.replace("--epub-cover-image=", "");
      const writtenCover = await readFile(coverPath);
      expect(writtenCover).toEqual(fakeCoverBuffer);

      const outputArg = args.find((arg) => arg.startsWith("--output="));
      const outputPath = outputArg!.replace("--output=", "");
      await writeFile(outputPath, "EPUB:with-cover");
    });

    const pandocExportService = new PandocExportService({
      pandocPath: "pandoc-test",
      runPandoc,
      temporaryDirectoryRoot: tempRootDirectory,
    });

    await pandocExportService.exportMarkdownAsEpub(
      "# Arbor\n\nHello",
      "Covered Book",
      fakeCoverBuffer,
      "png",
    );

    expect(runPandoc).toHaveBeenCalledTimes(1);
  });

  it("embeds markdown content verbatim (data-URLs are handled by caller)", async () => {
    const tempRootDirectory = await mkdtemp(
      path.join(tmpdir(), "arbor-pandoc-dataurl-"),
    );
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

    const runPandoc = vi.fn(async (_command: string, args: string[]) => {
      const inputPath = args.find((arg) => arg.endsWith("input.md"))!;
      const markdownOnDisk = await readFile(inputPath, "utf8");
      // The data-URL must survive unchanged so Pandoc can embed it natively.
      expect(markdownOnDisk).toContain(dataUrl);
      expect(args).not.toContain("--resource-path");
      const outputPath = args
        .find((arg) => arg.startsWith("--output="))!
        .replace("--output=", "");
      await writeFile(outputPath, "EPUB:ok");
    });

    const pandocExportService = new PandocExportService({
      pandocPath: "pandoc-test",
      runPandoc,
      temporaryDirectoryRoot: tempRootDirectory,
    });

    const result = await pandocExportService.exportMarkdownAsEpub(
      `# Arbor\n\n![hero](${dataUrl})`,
      "DataURL Book",
    );

    expect(runPandoc).toHaveBeenCalledTimes(1);
    expect(result.toString("utf8")).toBe("EPUB:ok");
  });

  describe("downloadIncludegraphicsImages (PDF image localization)", () => {
    it("replaces http URL in \\includegraphics with a local file path", async () => {
      const tempRootDirectory = await mkdtemp(
        path.join(tmpdir(), "arbor-pandoc-pdf-img-"),
      );

      const fakeImageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // minimal JPEG header

      const mockFetch = vi.fn(async (_url: string) => ({
        ok: true,
        headers: { get: () => "image/jpeg" },
        arrayBuffer: async () => fakeImageBytes.buffer,
      }));
      vi.stubGlobal("fetch", mockFetch);

      let capturedMarkdown = "";
      const runPandoc = vi.fn(async (_command: string, args: string[]) => {
        const inputPath = args.find((arg) => arg.endsWith("input.md"))!;
        capturedMarkdown = await readFile(inputPath, "utf8");
        const outputPath = args
          .find((arg) => arg.startsWith("--output="))!
          .replace("--output=", "");
        await writeFile(outputPath, "PDF:ok");
      });

      const pandocExportService = new PandocExportService({
        pandocPath: "pandoc-test",
        runPandoc,
        temporaryDirectoryRoot: tempRootDirectory,
      });

      const markdown =
        "# Book\n\n```{=latex}\n\\includegraphics[width=0.8\\textwidth]{http://api.arbor.local/media/abc123}\n```\n";

      await pandocExportService.exportMarkdownAsPdf(markdown);

      // The URL must have been swapped out for a local path.
      expect(capturedMarkdown).not.toContain("http://");
      expect(capturedMarkdown).toContain(
        "\\includegraphics[width=0.8\\textwidth]{",
      );
      expect(capturedMarkdown).toContain("pdf-img-0.jpg");

      // fetch should have been called exactly once with the original URL.
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(
        "http://api.arbor.local/media/abc123",
      );

      vi.unstubAllGlobals();
    });

    it("deduplicates identical URLs — fetches each unique URL only once", async () => {
      const tempRootDirectory = await mkdtemp(
        path.join(tmpdir(), "arbor-pandoc-pdf-dedup-"),
      );

      const fakeImageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header

      const mockFetch = vi.fn(async (_url: string) => ({
        ok: true,
        headers: { get: () => "image/png" },
        arrayBuffer: async () => fakeImageBytes.buffer,
      }));
      vi.stubGlobal("fetch", mockFetch);

      let capturedMarkdown = "";
      const runPandoc = vi.fn(async (_command: string, args: string[]) => {
        const inputPath = args.find((arg) => arg.endsWith("input.md"))!;
        capturedMarkdown = await readFile(inputPath, "utf8");
        const outputPath = args
          .find((arg) => arg.startsWith("--output="))!
          .replace("--output=", "");
        await writeFile(outputPath, "PDF:ok");
      });

      const pandocExportService = new PandocExportService({
        pandocPath: "pandoc-test",
        runPandoc,
        temporaryDirectoryRoot: tempRootDirectory,
      });

      // Same URL appears twice in the document.
      const url = "http://api.arbor.local/media/img42";
      const markdown =
        `# Book\n\n\`\`\`{=latex}\n\\includegraphics{${url}}\n\`\`\`\n\n` +
        `\`\`\`{=latex}\n\\includegraphics{${url}}\n\`\`\`\n`;

      await pandocExportService.exportMarkdownAsPdf(markdown);

      // fetch called only once despite two occurrences.
      expect(mockFetch).toHaveBeenCalledOnce();

      // Both occurrences replaced with the same local path.
      const localPathMatches = [
        ...capturedMarkdown.matchAll(/\\includegraphics\{([^}]+)\}/g),
      ];
      expect(localPathMatches).toHaveLength(2);
      expect(localPathMatches[0][1]).toBe(localPathMatches[1][1]);
      expect(localPathMatches[0][1]).toContain("pdf-img-0");

      vi.unstubAllGlobals();
    });

    it("leaves \\includegraphics unchanged when fetch fails", async () => {
      const tempRootDirectory = await mkdtemp(
        path.join(tmpdir(), "arbor-pandoc-pdf-fetchfail-"),
      );

      const mockFetch = vi.fn(async (_url: string) => ({
        ok: false,
        headers: { get: () => null },
        arrayBuffer: async () => new ArrayBuffer(0),
      }));
      vi.stubGlobal("fetch", mockFetch);

      let capturedMarkdown = "";
      const runPandoc = vi.fn(async (_command: string, args: string[]) => {
        const inputPath = args.find((arg) => arg.endsWith("input.md"))!;
        capturedMarkdown = await readFile(inputPath, "utf8");
        const outputPath = args
          .find((arg) => arg.startsWith("--output="))!
          .replace("--output=", "");
        await writeFile(outputPath, "PDF:ok");
      });

      const pandocExportService = new PandocExportService({
        pandocPath: "pandoc-test",
        runPandoc,
        temporaryDirectoryRoot: tempRootDirectory,
      });

      const originalUrl = "http://api.arbor.local/media/missing";
      const markdown = `# Book\n\n\`\`\`{=latex}\n\\includegraphics{${originalUrl}}\n\`\`\`\n`;

      await pandocExportService.exportMarkdownAsPdf(markdown);

      // The URL must remain as-is when the fetch fails.
      expect(capturedMarkdown).toContain(`\\includegraphics{${originalUrl}}`);

      vi.unstubAllGlobals();
    });

    it("does not alter markdown that has no \\includegraphics URLs", async () => {
      const tempRootDirectory = await mkdtemp(
        path.join(tmpdir(), "arbor-pandoc-pdf-noop-"),
      );

      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      let capturedMarkdown = "";
      const runPandoc = vi.fn(async (_command: string, args: string[]) => {
        const inputPath = args.find((arg) => arg.endsWith("input.md"))!;
        capturedMarkdown = await readFile(inputPath, "utf8");
        const outputPath = args
          .find((arg) => arg.startsWith("--output="))!
          .replace("--output=", "");
        await writeFile(outputPath, "PDF:ok");
      });

      const pandocExportService = new PandocExportService({
        pandocPath: "pandoc-test",
        runPandoc,
        temporaryDirectoryRoot: tempRootDirectory,
      });

      const plainMarkdown = "# My Book\n\nSome plain content.\n";
      await pandocExportService.exportMarkdownAsPdf(plainMarkdown);

      // fetch must never be called for documents with no remote images.
      expect(mockFetch).not.toHaveBeenCalled();
      expect(capturedMarkdown).toBe(plainMarkdown);

      vi.unstubAllGlobals();
    });

    it("uses resolveImageUrl instead of fetch when provided", async () => {
      const tempRootDirectory = await mkdtemp(
        path.join(tmpdir(), "arbor-pandoc-pdf-resolver-"),
      );

      const fakeImageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
      // Return { buffer, mimeType } — URL has no extension so the extension must
      // come from the mimeType (this is the real-world /media/<uuid> scenario).
      const resolveImageUrl = vi.fn(async (_url: string) => ({
        buffer: fakeImageBytes,
        mimeType: "image/png",
      }));
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      let capturedMarkdown = "";
      const runPandoc = vi.fn(async (_command: string, args: string[]) => {
        const inputPath = args.find((arg) => arg.endsWith("input.md"))!;
        capturedMarkdown = await readFile(inputPath, "utf8");
        const outputPath = args
          .find((arg) => arg.startsWith("--output="))!
          .replace("--output=", "");
        await writeFile(outputPath, "PDF:ok");
      });

      const pandocExportService = new PandocExportService({
        pandocPath: "pandoc-test",
        runPandoc,
        temporaryDirectoryRoot: tempRootDirectory,
        resolveImageUrl,
      });

      // URL has no file extension — extension must be derived from the mimeType.
      const imageUrl =
        "http://api.arbor.local/media/00000000-0000-0000-0000-000000000001";
      const markdown = `# Book\n\n\`\`\`{=latex}\n\\includegraphics{${imageUrl}}\n\`\`\`\n`;

      await pandocExportService.exportMarkdownAsPdf(markdown);

      // The resolver must be preferred over fetch.
      expect(resolveImageUrl).toHaveBeenCalledOnce();
      expect(resolveImageUrl).toHaveBeenCalledWith(imageUrl);
      expect(mockFetch).not.toHaveBeenCalled();

      // The URL must have been replaced with a local .png path (not .bin).
      expect(capturedMarkdown).not.toContain("http://");
      expect(capturedMarkdown).toContain("pdf-img-0.png");

      vi.unstubAllGlobals();
    });

    it("falls back to fetch when resolveImageUrl returns null", async () => {
      const tempRootDirectory = await mkdtemp(
        path.join(tmpdir(), "arbor-pandoc-pdf-resolver-fallback-"),
      );

      const fakeImageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
      const resolveImageUrl = vi.fn(async (_url: string) => null);
      const mockFetch = vi.fn(async (_url: string) => ({
        ok: true,
        headers: { get: () => "image/jpeg" },
        arrayBuffer: async () => fakeImageBytes.buffer,
      }));
      vi.stubGlobal("fetch", mockFetch);

      let capturedMarkdown = "";
      const runPandoc = vi.fn(async (_command: string, args: string[]) => {
        const inputPath = args.find((arg) => arg.endsWith("input.md"))!;
        capturedMarkdown = await readFile(inputPath, "utf8");
        const outputPath = args
          .find((arg) => arg.startsWith("--output="))!
          .replace("--output=", "");
        await writeFile(outputPath, "PDF:ok");
      });

      const pandocExportService = new PandocExportService({
        pandocPath: "pandoc-test",
        runPandoc,
        temporaryDirectoryRoot: tempRootDirectory,
        resolveImageUrl,
      });

      const imageUrl = "http://external.example.com/image.jpg";
      const markdown = `# Book\n\n\`\`\`{=latex}\n\\includegraphics{${imageUrl}}\n\`\`\`\n`;

      await pandocExportService.exportMarkdownAsPdf(markdown);

      // Both the resolver and fetch must have been called.
      expect(resolveImageUrl).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(imageUrl);

      // The URL must still have been replaced with a local path via fetch.
      expect(capturedMarkdown).not.toContain("http://");
      expect(capturedMarkdown).toContain("pdf-img-0.jpg");

      vi.unstubAllGlobals();
    });
  });

  it("cleans up its temporary working directory after export", async () => {
    const tempRootDirectory = await mkdtemp(
      path.join(tmpdir(), "arbor-pandoc-cleanup-"),
    );
    let workingDirectoryPath = "";

    const pandocExportService = new PandocExportService({
      runPandoc: vi.fn(async (_command: string, args: string[]) => {
        const inputPath = args.find((arg) => arg.endsWith("input.md"));
        const outputPath = args
          .find((arg) => arg.startsWith("--output="))!
          .replace("--output=", "");

        workingDirectoryPath = path.dirname(inputPath!);
        await writeFile(outputPath, "docx-bytes");
      }),
      temporaryDirectoryRoot: tempRootDirectory,
    });

    await pandocExportService.exportMarkdownAsDocx("Body text");

    await expect(stat(workingDirectoryPath)).rejects.toThrow();
  });
});
