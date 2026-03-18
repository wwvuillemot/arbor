import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { appRouter } from "@server/api/router";
import { createContext } from "@server/api/trpc";
import { resetTestDb } from "@tests/helpers/db";
import { MediaAttachmentService } from "@/services/media-attachment-service";
import { MinioService } from "@/services/minio";
import { createTestNote, createTestProject } from "@tests/helpers/fixtures";

function createCaller() {
  return appRouter.createCaller(
    createContext({ req: {} as any, res: {} as any, info: {} as any }),
  );
}

describe("DOCX export integration", () => {
  let tempDirectoryPath = "";
  let previousPandocPath = "";
  let previousReferenceDocPath = "";

  beforeEach(async () => {
    await resetTestDb();
    tempDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "arbor-docx-integration-"),
    );
    previousPandocPath = process.env.ARBOR_PANDOC_PATH ?? "";
    previousReferenceDocPath = process.env.ARBOR_DOCX_REFERENCE_PATH ?? "";
  });

  afterEach(async () => {
    process.env.ARBOR_PANDOC_PATH = previousPandocPath;
    process.env.ARBOR_DOCX_REFERENCE_PATH = previousReferenceDocPath;
    if (tempDirectoryPath) {
      await rm(tempDirectoryPath, { recursive: true, force: true });
    }
  });

  it("exports a node as docx through the nodes router", async () => {
    const caller = createCaller();
    const project = await caller.nodes.create({
      type: "project",
      name: "Export Project",
      parentId: null,
    });
    const note = await caller.nodes.create({
      type: "note",
      name: "Field Notes",
      parentId: project.id,
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello from Pandoc export" }],
          },
        ],
      },
    });

    const fakePandocPath = path.join(tempDirectoryPath, "fake-pandoc.js");
    const referenceDocPath = path.join(tempDirectoryPath, "reference.docx");
    await writeFile(referenceDocPath, "reference");
    await writeFile(
      fakePandocPath,
      `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const inputPath = args.find((arg) => arg.endsWith("input.md"));
const outputArg = args.find((arg) => arg.startsWith("--output="));
const referenceArg = args.find((arg) => arg.startsWith("--reference-doc=")) ?? "";
const markdown = fs.readFileSync(inputPath, "utf8");
fs.writeFileSync(outputArg.replace("--output=", ""), JSON.stringify({ markdown, referenceArg }));
`,
    );
    await chmod(fakePandocPath, 0o755);

    process.env.ARBOR_PANDOC_PATH = fakePandocPath;
    process.env.ARBOR_DOCX_REFERENCE_PATH = referenceDocPath;

    const exportResult = await caller.nodes.exportDocx({
      id: note.id,
      includeDescendants: false,
      includeFolderNames: true,
      includeNoteNames: true,
      sortMode: "alphabetical",
    });

    expect(exportResult.fileName).toBe("Field Notes.docx");
    expect(exportResult.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    const exportedPayload = JSON.parse(
      Buffer.from(exportResult.contentBase64, "base64").toString("utf8"),
    ) as { markdown: string; referenceArg: string };

    expect(exportedPayload.markdown).toContain("# Field Notes");
    expect(exportedPayload.markdown).toContain("Hello from Pandoc export");
    expect(exportedPayload.referenceArg).toBe(
      `--reference-doc=${referenceDocPath}`,
    );
  });

  it("exports a node as pdf through the nodes router", async () => {
    const caller = createCaller();
    const project = await caller.nodes.create({
      type: "project",
      name: "Export Project",
      parentId: null,
    });
    const note = await caller.nodes.create({
      type: "note",
      name: "Field Notes",
      parentId: project.id,
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello from Pandoc PDF export" }],
          },
        ],
      },
    });

    const fakePandocPath = path.join(tempDirectoryPath, "fake-pandoc-pdf.js");
    await writeFile(
      fakePandocPath,
      `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const inputPath = args.find((arg) => arg.endsWith("input.md"));
const outputArg = args.find((arg) => arg.startsWith("--output="));
const markdown = fs.readFileSync(inputPath, "utf8");
fs.writeFileSync(
  outputArg.replace("--output=", ""),
  JSON.stringify({ markdown, args })
);
`,
    );
    await chmod(fakePandocPath, 0o755);

    process.env.ARBOR_PANDOC_PATH = fakePandocPath;

    const exportResult = await caller.nodes.exportPdf({
      id: note.id,
      includeDescendants: false,
      includeFolderNames: true,
      includeNoteNames: true,
      sortMode: "alphabetical",
      templateId: "book",
    });

    expect(exportResult.fileName).toBe("Field Notes.pdf");
    expect(exportResult.mimeType).toBe("application/pdf");

    const exportedPayload = JSON.parse(
      Buffer.from(exportResult.contentBase64, "base64").toString("utf8"),
    ) as { markdown: string; args: string[] };

    expect(exportedPayload.markdown).toContain("# Field Notes");
    expect(exportedPayload.markdown).toContain("Hello from Pandoc PDF export");
    expect(exportedPayload.args).toContain("--pdf-engine=xelatex");
    expect(exportedPayload.args).toContain("--toc");
    expect(exportedPayload.args).toContain("--variable=geometry:margin=1.15in");
    expect(exportedPayload.args).not.toContain("--number-sections");
    expect(exportedPayload.args).not.toContain("--top-level-division=chapter");
    expect(exportedPayload.args).not.toContain("--variable=documentclass:book");
  });
});

describe("EPUB export integration", () => {
  let tempDirectoryPath = "";
  let previousPandocPath = "";

  beforeEach(async () => {
    await resetTestDb();
    tempDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "arbor-epub-integration-"),
    );
    previousPandocPath = process.env.ARBOR_PANDOC_PATH ?? "";
  });

  afterEach(async () => {
    process.env.ARBOR_PANDOC_PATH = previousPandocPath;
    if (tempDirectoryPath) {
      await rm(tempDirectoryPath, { recursive: true, force: true });
    }
  });

  it("exports a node as epub through the nodes router", async () => {
    const caller = appRouter.createCaller(
      createContext({ req: {} as any, res: {} as any, info: {} as any }),
    );
    const project = await caller.nodes.create({
      type: "project",
      name: "Export Project",
      parentId: null,
    });
    const note = await caller.nodes.create({
      type: "note",
      name: "Field Notes",
      parentId: project.id,
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello from Pandoc EPUB export" }],
          },
        ],
      },
    });

    const fakePandocPath = path.join(tempDirectoryPath, "fake-pandoc-epub.js");
    await writeFile(
      fakePandocPath,
      `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const inputPath = args.find((arg) => arg.endsWith("input.md"));
const outputArg = args.find((arg) => arg.startsWith("--output="));
const markdown = fs.readFileSync(inputPath, "utf8");
fs.writeFileSync(outputArg.replace("--output=", ""), JSON.stringify({ markdown, args }));
`,
    );
    await chmod(fakePandocPath, 0o755);
    process.env.ARBOR_PANDOC_PATH = fakePandocPath;

    const exportResult = await caller.nodes.exportEpub({
      id: note.id,
      includeDescendants: false,
      includeFolderNames: true,
      includeNoteNames: true,
      sortMode: "alphabetical",
    });

    expect(exportResult.fileName).toBe("Field Notes.epub");
    expect(exportResult.mimeType).toBe("application/epub+zip");

    const exportedPayload = JSON.parse(
      Buffer.from(exportResult.contentBase64, "base64").toString("utf8"),
    ) as { markdown: string; args: string[] };

    expect(exportedPayload.markdown).toContain("# Field Notes");
    expect(exportedPayload.markdown).toContain("Hello from Pandoc EPUB export");
    expect(exportedPayload.args).toContain("--standalone");
    expect(exportedPayload.args).toContain("--split-level=1");
    expect(exportedPayload.args).toContain("--metadata=title:Field Notes");
    expect(
      exportedPayload.args.some((arg) => arg.endsWith("output.epub")),
    ).toBe(true);
  });

  it("exports a node as epub with a cover image", async () => {
    const endpoint = process.env.MINIO_ENDPOINT ?? "localhost";
    const endPoint = endpoint.includes(":") ? endpoint.split(":")[0] : endpoint;
    const minioService = new MinioService({
      endPoint,
      port: 9000,
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY ?? "arbor",
      secretKey: process.env.MINIO_SECRET_KEY ?? "local_dev_only",
    });
    await minioService.ensureBucket("arbor-test");
    const mediaService = new MediaAttachmentService(minioService);

    const project = await createTestProject("Cover EPUB Project");
    const note = await createTestNote("Cover Note", project.id);

    const coverContent = Buffer.from("fake-png-bytes");
    const attachment = await mediaService.createAttachment({
      nodeId: note.id,
      projectId: project.id,
      buffer: coverContent,
      filename: "cover.png",
      mimeType: "image/png",
      bucket: "arbor-test",
    });

    const fakePandocPath = path.join(
      tempDirectoryPath,
      "fake-pandoc-epub-cover.js",
    );
    await writeFile(
      fakePandocPath,
      `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const inputPath = args.find((arg) => arg.endsWith("input.md"));
const outputArg = args.find((arg) => arg.startsWith("--output="));
const coverArg = args.find((arg) => arg.startsWith("--epub-cover-image=")) ?? "";
const markdown = fs.readFileSync(inputPath, "utf8");
const coverBytes = coverArg ? fs.readFileSync(coverArg.replace("--epub-cover-image=", "")).toString("utf8") : "";
fs.writeFileSync(outputArg.replace("--output=", ""), JSON.stringify({ markdown, args, coverBytes }));
`,
    );
    await chmod(fakePandocPath, 0o755);
    process.env.ARBOR_PANDOC_PATH = fakePandocPath;

    const caller = appRouter.createCaller(
      createContext({ req: {} as any, res: {} as any, info: {} as any }),
    );

    const exportResult = await caller.nodes.exportEpub({
      id: note.id,
      includeDescendants: false,
      includeFolderNames: true,
      includeNoteNames: true,
      sortMode: "alphabetical",
      coverAttachmentId: attachment.id,
    });

    expect(exportResult.fileName).toBe("Cover Note.epub");

    const exportedPayload = JSON.parse(
      Buffer.from(exportResult.contentBase64, "base64").toString("utf8"),
    ) as { markdown: string; args: string[]; coverBytes: string };

    expect(
      exportedPayload.args.some((arg) => arg.startsWith("--epub-cover-image=")),
    ).toBe(true);
    expect(exportedPayload.coverBytes).toBe("fake-png-bytes");

    await mediaService.deleteAttachment(attachment.id);
  });

  it("passes author, description, and language metadata flags to pandoc", async () => {
    const caller = appRouter.createCaller(
      createContext({ req: {} as any, res: {} as any, info: {} as any }),
    );
    const project = await caller.nodes.create({
      type: "project",
      name: "Meta Project",
      parentId: null,
    });
    const note = await caller.nodes.create({
      type: "note",
      name: "Meta Note",
      parentId: project.id,
    });

    const fakePandocPath = path.join(tempDirectoryPath, "fake-pandoc-meta.js");
    await writeFile(
      fakePandocPath,
      `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const outputArg = args.find((arg) => arg.startsWith("--output="));
fs.writeFileSync(outputArg.replace("--output=", ""), JSON.stringify({ args }));
`,
    );
    await chmod(fakePandocPath, 0o755);
    process.env.ARBOR_PANDOC_PATH = fakePandocPath;

    const exportResult = await caller.nodes.exportEpub({
      id: note.id,
      includeDescendants: false,
      includeFolderNames: true,
      includeNoteNames: true,
      sortMode: "alphabetical",
      epubAuthor: "Jane Doe",
      epubDescription: "A great read",
      epubLanguage: "en-US",
    });

    const exportedPayload = JSON.parse(
      Buffer.from(exportResult.contentBase64, "base64").toString("utf8"),
    ) as { args: string[] };

    expect(exportedPayload.args).toContain("--metadata=author:Jane Doe");
    expect(exportedPayload.args).toContain(
      "--metadata=description:A great read",
    );
    expect(exportedPayload.args).toContain("--metadata=lang:en-US");
  });
});
