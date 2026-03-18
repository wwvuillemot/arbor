import type { FileTreeSortMode } from "@/components/file-tree";
import { base64ToUint8Array } from "@/lib/base64";

type ExportNodeInput = {
  id: string;
  includeDescendants: boolean;
  includeFolderNames: boolean;
  includeNoteNames: boolean;
  sortMode: FileTreeSortMode;
};

export type PdfTemplateId = "standard" | "book";

type PdfExportInput = ExportNodeInput & {
  templateId: PdfTemplateId;
};

type ExportWorkflowStatusHandlers = {
  addSuccessToast: () => void;
  addErrorToast: () => void;
  closeExportMenu: () => void;
};

type MarkdownExportParams = ExportWorkflowStatusHandlers & {
  nodeId: string;
  nodeName: string | null | undefined;
  includeDescendants: boolean;
  includeFolderNames: boolean;
  includeNoteNames: boolean;
  sortMode: FileTreeSortMode;
  fetchMarkdown: (input: ExportNodeInput) => Promise<{ content: string }>;
  downloadTextFile: (
    fileContent: string,
    fileName: string,
    mimeType: string,
  ) => void;
};

type PdfExportParams = ExportWorkflowStatusHandlers & {
  nodeId: string;
  includeDescendants: boolean;
  includeFolderNames: boolean;
  includeNoteNames: boolean;
  sortMode: FileTreeSortMode;
  templateId: PdfTemplateId;
  fetchPdf: (input: PdfExportInput) => Promise<{
    contentBase64: string;
    fileName: string;
    mimeType: string;
  }>;
  downloadBinaryFile: (
    fileBytes: Uint8Array,
    fileName: string,
    mimeType: string,
  ) => void;
};

type DocxExportParams = ExportWorkflowStatusHandlers & {
  nodeId: string;
  includeDescendants: boolean;
  includeFolderNames: boolean;
  includeNoteNames: boolean;
  sortMode: FileTreeSortMode;
  fetchDocx: (input: ExportNodeInput) => Promise<{
    contentBase64: string;
    fileName: string;
    mimeType: string;
  }>;
  downloadBinaryFile: (
    fileBytes: Uint8Array,
    fileName: string,
    mimeType: string,
  ) => void;
};

type ZipExportInput = {
  id: string;
  sortMode: FileTreeSortMode;
};

type ZipExportParams = ExportWorkflowStatusHandlers & {
  nodeId: string;
  sortMode: FileTreeSortMode;
  fetchZip: (input: ZipExportInput) => Promise<{
    contentBase64: string;
    fileName: string;
    mimeType: string;
  }>;
  downloadBinaryFile: (
    fileBytes: Uint8Array,
    fileName: string,
    mimeType: string,
  ) => void;
};

type EpubExportInput = ExportNodeInput & {
  coverAttachmentId?: string;
  epubAuthor?: string;
  epubDescription?: string;
  epubLanguage?: string;
};

type EpubExportParams = ExportWorkflowStatusHandlers & {
  nodeId: string;
  includeDescendants: boolean;
  includeFolderNames: boolean;
  includeNoteNames: boolean;
  sortMode: FileTreeSortMode;
  coverAttachmentId?: string;
  epubAuthor?: string;
  epubDescription?: string;
  epubLanguage?: string;
  fetchEpub: (input: EpubExportInput) => Promise<{
    contentBase64: string;
    fileName: string;
    mimeType: string;
  }>;
  downloadBinaryFile: (
    fileBytes: Uint8Array,
    fileName: string,
    mimeType: string,
  ) => void;
};

async function runProjectExportWorkflow(
  performExport: () => Promise<void>,
  statusHandlers: ExportWorkflowStatusHandlers,
): Promise<void> {
  try {
    await performExport();
    statusHandlers.addSuccessToast();
  } catch {
    statusHandlers.addErrorToast();
  } finally {
    statusHandlers.closeExportMenu();
  }
}

export async function runProjectMarkdownExport({
  nodeId,
  nodeName,
  includeDescendants,
  includeFolderNames,
  includeNoteNames,
  sortMode,
  fetchMarkdown,
  downloadTextFile,
  ...statusHandlers
}: MarkdownExportParams): Promise<void> {
  await runProjectExportWorkflow(async () => {
    const markdownExport = await fetchMarkdown({
      id: nodeId,
      includeDescendants,
      includeFolderNames,
      includeNoteNames,
      sortMode,
    });
    downloadTextFile(
      markdownExport.content,
      `${nodeName || "export"}.md`,
      "text/markdown",
    );
  }, statusHandlers);
}

export async function runProjectPdfExport({
  nodeId,
  includeDescendants,
  includeFolderNames,
  includeNoteNames,
  sortMode,
  templateId,
  fetchPdf,
  downloadBinaryFile,
  ...statusHandlers
}: PdfExportParams): Promise<void> {
  await runProjectExportWorkflow(async () => {
    const pdfExport = await fetchPdf({
      id: nodeId,
      includeDescendants,
      includeFolderNames,
      includeNoteNames,
      sortMode,
      templateId,
    });

    downloadBinaryFile(
      base64ToUint8Array(pdfExport.contentBase64),
      pdfExport.fileName,
      pdfExport.mimeType,
    );
  }, statusHandlers);
}

export async function runProjectDocxExport({
  nodeId,
  includeDescendants,
  includeFolderNames,
  includeNoteNames,
  sortMode,
  fetchDocx,
  downloadBinaryFile,
  ...statusHandlers
}: DocxExportParams): Promise<void> {
  await runProjectExportWorkflow(async () => {
    const docxExport = await fetchDocx({
      id: nodeId,
      includeDescendants,
      includeFolderNames,
      includeNoteNames,
      sortMode,
    });

    downloadBinaryFile(
      base64ToUint8Array(docxExport.contentBase64),
      docxExport.fileName,
      docxExport.mimeType,
    );
  }, statusHandlers);
}

export async function runProjectZipExport({
  nodeId,
  sortMode,
  fetchZip,
  downloadBinaryFile,
  ...statusHandlers
}: ZipExportParams): Promise<void> {
  await runProjectExportWorkflow(async () => {
    const zipExport = await fetchZip({ id: nodeId, sortMode });

    downloadBinaryFile(
      base64ToUint8Array(zipExport.contentBase64),
      zipExport.fileName,
      zipExport.mimeType,
    );
  }, statusHandlers);
}

export async function runProjectEpubExport({
  nodeId,
  includeDescendants,
  includeFolderNames,
  includeNoteNames,
  sortMode,
  coverAttachmentId,
  epubAuthor,
  epubDescription,
  epubLanguage,
  fetchEpub,
  downloadBinaryFile,
  ...statusHandlers
}: EpubExportParams): Promise<void> {
  await runProjectExportWorkflow(async () => {
    const epubExport = await fetchEpub({
      id: nodeId,
      includeDescendants,
      includeFolderNames,
      includeNoteNames,
      sortMode,
      coverAttachmentId,
      epubAuthor: epubAuthor || undefined,
      epubDescription: epubDescription || undefined,
      epubLanguage: epubLanguage || undefined,
    });

    downloadBinaryFile(
      base64ToUint8Array(epubExport.contentBase64),
      epubExport.fileName,
      epubExport.mimeType,
    );
  }, statusHandlers);
}
