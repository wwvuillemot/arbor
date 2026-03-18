import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { extname } from "node:path";

const execFileAsync = promisify(execFile);
export const PDF_TEMPLATE_IDS = ["standard", "book"] as const;
export type PdfTemplateId = (typeof PDF_TEMPLATE_IDS)[number];
export const DEFAULT_PDF_TEMPLATE_ID: PdfTemplateId = "standard";

type PdfTemplateDefinition = {
  id: PdfTemplateId;
  label: string;
  description: string;
  pandocArguments: string[];
};

const PDF_TEMPLATE_DEFINITIONS: readonly PdfTemplateDefinition[] = [
  {
    id: "standard",
    label: "Standard",
    description: "Clean PDF with balanced margins for everyday sharing.",
    pandocArguments: [
      "--standalone",
      "--variable=geometry:margin=1in",
      "--variable=fontsize:11pt",
    ],
  },
  {
    id: "book",
    label: "Book",
    description:
      "Long-form layout with a table of contents reflecting the document hierarchy.",
    pandocArguments: [
      "--standalone",
      "--toc",
      "--variable=geometry:margin=1.15in",
    ],
  },
] as const;

type RunPandoc = (command: string, args: string[]) => Promise<void>;

/**
 * Optional Dublin Core metadata fields that Pandoc embeds in the EPUB manifest.
 * Each non-empty field is forwarded as a --metadata=key:value argument to Pandoc.
 */
export type EpubMetadata = {
  author?: string;
  description?: string;
  language?: string;
};

// CSS injected into every EPUB export.
// With --split-level=2, each note (H2) gets its own XHTML spine item so
// the EPUB reader always starts a new "page" at the XHTML file boundary.
// No CSS page-break rules are needed for notes; the file boundary IS the
// page break.  This CSS is kept for any reader-specific cosmetic tweaks.
const EPUB_CSS = `
section.level2 h2 {
  margin-top: 0;
}
`;

type BinaryExportOptions = {
  markdown: string;
  outputFileName: string;
  pandocArguments: string[];
  coverImageBuffer?: Buffer;
  coverImageExtension?: string;
  cssContent?: string;
};

/**
 * The resolved image buffer and its MIME type, returned by a ResolveImageUrl
 * callback.  The mimeType is used to derive the correct file extension so
 * XeLaTeX can identify the image format (e.g. "image/jpeg" → ".jpg").
 */
export type ResolvedImage = { buffer: Buffer; mimeType: string };

/**
 * Optional callback that resolves an image URL to its raw bytes without making
 * an outbound HTTP request.  When provided it is used in place of `fetch` for
 * every `\includegraphics{URL}` found in PDF markdown.
 *
 * Return `null` to signal that the URL cannot be resolved; the original
 * `\includegraphics` directive is left unchanged in that case.
 */
export type ResolveImageUrl = (url: string) => Promise<ResolvedImage | null>;

export type PandocExportServiceOptions = {
  pandocPath?: string;
  referenceDocPath?: string;
  runPandoc?: RunPandoc;
  temporaryDirectoryRoot?: string;
  resolveImageUrl?: ResolveImageUrl;
};

/**
 * Map a MIME type string (or content-type header value) to the corresponding
 * file extension including the leading dot.  Falls back to `.bin` for unknown
 * types so callers always get a usable (if not ideal) extension.
 */
function mimeTypeToExtension(mimeType: string): string {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return ".jpg";
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("gif")) return ".gif";
  if (mimeType.includes("svg")) return ".svg";
  if (mimeType.includes("webp")) return ".webp";
  return ".bin";
}

/**
 * Download all HTTP/HTTPS images referenced by raw LaTeX `\includegraphics{URL}`
 * blocks in the markdown string to the given directory.  Returns a new markdown
 * string with each URL replaced by the corresponding local file path.
 *
 * XeLaTeX cannot fetch remote URLs, so any `\includegraphics` that references
 * an HTTP URL must be pre-fetched and placed alongside the input.md file.
 *
 * When `resolveImageUrl` is supplied it is called first; only URLs it cannot
 * resolve (returns `null`) fall back to a plain `fetch`.
 */
async function downloadIncludegraphicsImages(
  markdown: string,
  workingDirectoryPath: string,
  resolveImageUrl?: ResolveImageUrl,
): Promise<string> {
  // Match \includegraphics[optional]{URL} — capture the full URL.
  const pattern = /\\includegraphics(\[[^\]]*\])?\{(https?:\/\/[^}]+)\}/g;

  // Collect all unique URLs first so we only download each once.
  const urlToLocalPath = new Map<string, string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    const url = match[2];
    if (!urlToLocalPath.has(url)) {
      urlToLocalPath.set(url, "");
    }
  }

  // Fetch each unique URL and write to a local file.
  let imageIndex = 0;
  for (const [url] of urlToLocalPath) {
    let imageBuffer: Buffer | null = null;
    // Prefer extension from URL pathname; may be empty for opaque media URLs.
    let ext = extname(new URL(url).pathname);

    // Prefer the injected resolver (e.g. direct MinIO access) over HTTP.
    if (resolveImageUrl) {
      try {
        const resolved = await resolveImageUrl(url);
        if (resolved) {
          imageBuffer = resolved.buffer;
          // Always derive extension from the authoritative MIME type when
          // the URL itself has no extension (e.g. /media/<uuid>).
          if (!ext) {
            ext = mimeTypeToExtension(resolved.mimeType);
          }
        }
      } catch {
        imageBuffer = null;
      }
    }

    // Fall back to a plain HTTP fetch when the resolver is absent or returns null.
    if (!imageBuffer) {
      let response: Response;
      try {
        response = await fetch(url);
      } catch {
        // Skip images that cannot be fetched at all.
        continue;
      }
      if (!response.ok) {
        // Skip images that cannot be fetched; LaTeX will error on the missing
        // file, which is a clearer failure mode than a silent empty image.
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!ext) {
        ext = mimeTypeToExtension(contentType);
      }
      imageBuffer = Buffer.from(await response.arrayBuffer());
    }

    if (!imageBuffer) continue;

    const localFileName = `pdf-img-${imageIndex}${ext || ".bin"}`;
    imageIndex += 1;
    const localFilePath = path.join(workingDirectoryPath, localFileName);
    await writeFile(localFilePath, imageBuffer);
    urlToLocalPath.set(url, localFilePath);
  }

  // Replace all URL occurrences in the markdown with the local paths.
  return markdown.replace(
    /\\includegraphics(\[[^\]]*\])?\{(https?:\/\/[^}]+)\}/g,
    (_match, opts: string | undefined, url: string) => {
      const localPath = urlToLocalPath.get(url);
      if (!localPath) return _match; // leave as-is if resolution failed
      return `\\includegraphics${opts ?? ""}{${localPath}}`;
    },
  );
}

async function runPandocCommand(
  command: string,
  args: string[],
): Promise<void> {
  try {
    await execFileAsync(command, args);
  } catch (err: unknown) {
    const execError = err as {
      message?: string;
      stderr?: string;
      stdout?: string;
    };
    const details = [execError.stderr?.trim(), execError.stdout?.trim()]
      .filter(Boolean)
      .join("\n");
    throw new Error(
      `Pandoc failed: ${execError.message ?? String(err)}${details ? `\n\nDetails:\n${details}` : ""}`,
    );
  }
}

export class PandocExportService {
  private readonly configuredPandocPath?: string;
  private readonly configuredReferenceDocPath?: string;
  private readonly runPandoc: RunPandoc;
  private readonly temporaryDirectoryRoot: string;
  private readonly resolveImageUrl?: ResolveImageUrl;

  constructor(options: PandocExportServiceOptions = {}) {
    this.configuredPandocPath = options.pandocPath;
    this.configuredReferenceDocPath = options.referenceDocPath;
    this.runPandoc = options.runPandoc ?? runPandocCommand;
    this.temporaryDirectoryRoot = options.temporaryDirectoryRoot ?? tmpdir();
    this.resolveImageUrl = options.resolveImageUrl;
  }

  getPdfTemplates(): {
    id: PdfTemplateId;
    label: string;
    description: string;
    isDefault: boolean;
  }[] {
    return PDF_TEMPLATE_DEFINITIONS.map((templateDefinition) => ({
      id: templateDefinition.id,
      label: templateDefinition.label,
      description: templateDefinition.description,
      isDefault: templateDefinition.id === DEFAULT_PDF_TEMPLATE_ID,
    }));
  }

  async exportMarkdownAsPdf(
    markdown: string,
    templateId: PdfTemplateId = DEFAULT_PDF_TEMPLATE_ID,
  ): Promise<Buffer> {
    const templateDefinition = this.getPdfTemplateDefinition(templateId);

    return await this.exportMarkdownToBinary({
      markdown,
      outputFileName: "output.pdf",
      pandocArguments: [
        "--pdf-engine=xelatex",
        // Force pandoc's default LaTeX template to load \usepackage{graphicx}
        // so that raw {=latex} blocks using \includegraphics work correctly.
        "--variable=graphics",
        ...templateDefinition.pandocArguments,
      ],
    });
  }

  async exportMarkdownAsEpub(
    markdown: string,
    title?: string,
    coverImageBuffer?: Buffer,
    coverImageExtension?: string,
    epubMetadata?: EpubMetadata,
  ): Promise<Buffer> {
    const pandocArguments = [
      "--standalone",
      // Split at H1 (folder) AND H2 (note) headings so every note gets its
      // own XHTML spine item.  The EPUB reader opens each spine item as a new
      // "chapter page", meaning the H2 title and the chapter icon that
      // immediately follows it are always the first elements in that file —
      // they are guaranteed to appear together at the top of the page.
      // CSS page-break tricks (break-before:page on section.level2) are no
      // longer needed because the file boundary IS the page break.
      // (--epub-chapter-level was renamed to --split-level in Pandoc 3.x)
      "--split-level=2",
    ];

    if (title) {
      pandocArguments.push(`--metadata=title:${title}`);
    }

    if (epubMetadata?.author) {
      pandocArguments.push(`--metadata=author:${epubMetadata.author}`);
    }

    if (epubMetadata?.description) {
      pandocArguments.push(
        `--metadata=description:${epubMetadata.description}`,
      );
    }

    if (epubMetadata?.language) {
      pandocArguments.push(`--metadata=lang:${epubMetadata.language}`);
    }

    return await this.exportMarkdownToBinary({
      markdown,
      outputFileName: "output.epub",
      pandocArguments,
      coverImageBuffer,
      coverImageExtension,
      cssContent: EPUB_CSS,
    });
  }

  async exportMarkdownAsDocx(markdown: string): Promise<Buffer> {
    const referenceDocPath =
      this.configuredReferenceDocPath ?? process.env.ARBOR_DOCX_REFERENCE_PATH;
    const pandocArguments: string[] = [];

    if (referenceDocPath) {
      pandocArguments.push(`--reference-doc=${referenceDocPath}`);
    }

    return await this.exportMarkdownToBinary({
      markdown,
      outputFileName: "output.docx",
      pandocArguments,
    });
  }

  private getPandocPath(): string {
    return (
      this.configuredPandocPath ?? process.env.ARBOR_PANDOC_PATH ?? "pandoc"
    );
  }

  private getPdfTemplateDefinition(
    templateId: PdfTemplateId,
  ): PdfTemplateDefinition {
    const templateDefinition = PDF_TEMPLATE_DEFINITIONS.find(
      (candidateTemplate) => candidateTemplate.id === templateId,
    );

    if (!templateDefinition) {
      throw new Error(`Unknown PDF template: ${templateId}`);
    }

    return templateDefinition;
  }

  private async exportMarkdownToBinary({
    markdown,
    outputFileName,
    pandocArguments,
    coverImageBuffer,
    coverImageExtension,
    cssContent,
  }: BinaryExportOptions): Promise<Buffer> {
    const pandocPath = this.getPandocPath();
    const workingDirectoryPath = await mkdtemp(
      path.join(this.temporaryDirectoryRoot, "arbor-pandoc-"),
    );
    const markdownInputPath = path.join(workingDirectoryPath, "input.md");
    const outputPath = path.join(workingDirectoryPath, outputFileName);
    const resolvedPandocArguments = [...pandocArguments];

    let pandocFailed = false;
    try {
      // Download any remote images referenced in raw LaTeX \includegraphics{}
      // blocks and replace their URLs with local file paths so XeLaTeX can
      // resolve them (XeLaTeX cannot fetch HTTP URLs on its own).
      const resolvedMarkdown = await downloadIncludegraphicsImages(
        markdown,
        workingDirectoryPath,
        this.resolveImageUrl,
      );
      await writeFile(markdownInputPath, resolvedMarkdown, "utf8");

      if (cssContent) {
        const cssPath = path.join(workingDirectoryPath, "epub.css");
        await writeFile(cssPath, cssContent, "utf8");
        resolvedPandocArguments.push(`--css=${cssPath}`);
      }

      if (coverImageBuffer && coverImageExtension) {
        const coverImagePath = path.join(
          workingDirectoryPath,
          `cover.${coverImageExtension}`,
        );
        await writeFile(coverImagePath, coverImageBuffer);
        resolvedPandocArguments.push(`--epub-cover-image=${coverImagePath}`);
      }

      await this.runPandoc(pandocPath, [
        markdownInputPath,
        `--output=${outputPath}`,
        ...resolvedPandocArguments,
      ]);

      return await readFile(outputPath);
    } catch (err) {
      pandocFailed = true;
      // On failure keep the temp dir so callers can inspect input.md.
      console.error(
        `[PandocExportService] Failed. Input markdown preserved at: ${markdownInputPath}`,
      );
      throw err;
    } finally {
      if (!pandocFailed) {
        await rm(workingDirectoryPath, { recursive: true, force: true });
      }
    }
  }
}
