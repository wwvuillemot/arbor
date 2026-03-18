import { describe, expect, it, vi } from "vitest";

import {
  runProjectDocxExport,
  runProjectEpubExport,
  runProjectMarkdownExport,
  runProjectPdfExport,
} from "@/app/[locale]/(app)/projects/projects-export-workflow";

describe("project export workflow helpers", () => {
  it("downloads markdown, shows success, and closes the menu", async () => {
    const fetchMarkdown = vi.fn().mockResolvedValue({ content: "# Arbor" });
    const downloadTextFile = vi.fn();
    const addSuccessToast = vi.fn();
    const addErrorToast = vi.fn();
    const closeExportMenu = vi.fn();

    await runProjectMarkdownExport({
      nodeId: "node-1",
      nodeName: "Field Notes",
      includeDescendants: true,
      includeFolderNames: true,
      includeNoteNames: false,
      sortMode: "manual",
      fetchMarkdown,
      downloadTextFile,
      addSuccessToast,
      addErrorToast,
      closeExportMenu,
    });

    expect(fetchMarkdown).toHaveBeenCalledWith({
      id: "node-1",
      includeDescendants: true,
      includeFolderNames: true,
      includeNoteNames: false,
      sortMode: "manual",
    });
    expect(downloadTextFile).toHaveBeenCalledWith(
      "# Arbor",
      "Field Notes.md",
      "text/markdown",
    );
    expect(addSuccessToast).toHaveBeenCalledTimes(1);
    expect(addErrorToast).not.toHaveBeenCalled();
    expect(closeExportMenu).toHaveBeenCalledTimes(1);
  });

  it("shows a markdown export error and still closes the menu", async () => {
    const fetchMarkdown = vi.fn().mockRejectedValue(new Error("boom"));
    const downloadTextFile = vi.fn();
    const addSuccessToast = vi.fn();
    const addErrorToast = vi.fn();
    const closeExportMenu = vi.fn();

    await runProjectMarkdownExport({
      nodeId: "node-1",
      nodeName: undefined,
      includeDescendants: false,
      includeFolderNames: true,
      includeNoteNames: true,
      sortMode: "alphabetical",
      fetchMarkdown,
      downloadTextFile,
      addSuccessToast,
      addErrorToast,
      closeExportMenu,
    });

    expect(downloadTextFile).not.toHaveBeenCalled();
    expect(addSuccessToast).not.toHaveBeenCalled();
    expect(addErrorToast).toHaveBeenCalledTimes(1);
    expect(closeExportMenu).toHaveBeenCalledTimes(1);
  });

  it("downloads pdf bytes, shows success, and closes the menu", async () => {
    const fetchPdf = vi.fn().mockResolvedValue({
      contentBase64: "JVBERg==",
      fileName: "Field Notes.pdf",
      mimeType: "application/pdf",
    });
    const downloadBinaryFile = vi.fn();
    const addSuccessToast = vi.fn();
    const addErrorToast = vi.fn();
    const closeExportMenu = vi.fn();

    await runProjectPdfExport({
      nodeId: "node-2",
      includeDescendants: false,
      includeFolderNames: false,
      includeNoteNames: true,
      sortMode: "manual",
      templateId: "book",
      fetchPdf,
      downloadBinaryFile,
      addSuccessToast,
      addErrorToast,
      closeExportMenu,
    });

    expect(fetchPdf).toHaveBeenCalledWith({
      id: "node-2",
      includeDescendants: false,
      includeFolderNames: false,
      includeNoteNames: true,
      sortMode: "manual",
      templateId: "book",
    });
    expect(downloadBinaryFile).toHaveBeenCalledWith(
      Uint8Array.from([37, 80, 68, 70]),
      "Field Notes.pdf",
      "application/pdf",
    );
    expect(addSuccessToast).toHaveBeenCalledTimes(1);
    expect(addErrorToast).not.toHaveBeenCalled();
    expect(closeExportMenu).toHaveBeenCalledTimes(1);
  });

  it("downloads docx bytes, shows success, and closes the menu", async () => {
    const fetchDocx = vi.fn().mockResolvedValue({
      contentBase64: "UEsDBA==",
      fileName: "Field Notes.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const downloadBinaryFile = vi.fn();
    const addSuccessToast = vi.fn();
    const addErrorToast = vi.fn();
    const closeExportMenu = vi.fn();

    await runProjectDocxExport({
      nodeId: "node-3",
      includeDescendants: true,
      includeFolderNames: true,
      includeNoteNames: false,
      sortMode: "manual",
      fetchDocx,
      downloadBinaryFile,
      addSuccessToast,
      addErrorToast,
      closeExportMenu,
    });

    expect(fetchDocx).toHaveBeenCalledWith({
      id: "node-3",
      includeDescendants: true,
      includeFolderNames: true,
      includeNoteNames: false,
      sortMode: "manual",
    });
    expect(downloadBinaryFile).toHaveBeenCalledWith(
      Uint8Array.from([80, 75, 3, 4]),
      "Field Notes.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(addSuccessToast).toHaveBeenCalledTimes(1);
    expect(addErrorToast).not.toHaveBeenCalled();
    expect(closeExportMenu).toHaveBeenCalledTimes(1);
  });

  it("shows a PDF export error and still closes the menu", async () => {
    const fetchPdf = vi.fn().mockRejectedValue(new Error("boom"));
    const downloadBinaryFile = vi.fn();
    const addSuccessToast = vi.fn();
    const addErrorToast = vi.fn();
    const closeExportMenu = vi.fn();

    await runProjectPdfExport({
      nodeId: "node-2",
      includeDescendants: true,
      includeFolderNames: true,
      includeNoteNames: true,
      sortMode: "alphabetical",
      templateId: "standard",
      fetchPdf,
      downloadBinaryFile,
      addSuccessToast,
      addErrorToast,
      closeExportMenu,
    });

    expect(downloadBinaryFile).not.toHaveBeenCalled();
    expect(addSuccessToast).not.toHaveBeenCalled();
    expect(addErrorToast).toHaveBeenCalledTimes(1);
    expect(closeExportMenu).toHaveBeenCalledTimes(1);
  });

  it("shows a DOCX export error and still closes the menu", async () => {
    const fetchDocx = vi.fn().mockRejectedValue(new Error("boom"));
    const downloadBinaryFile = vi.fn();
    const addSuccessToast = vi.fn();
    const addErrorToast = vi.fn();
    const closeExportMenu = vi.fn();

    await runProjectDocxExport({
      nodeId: "node-3",
      includeDescendants: false,
      includeFolderNames: true,
      includeNoteNames: true,
      sortMode: "alphabetical",
      fetchDocx,
      downloadBinaryFile,
      addSuccessToast,
      addErrorToast,
      closeExportMenu,
    });

    expect(downloadBinaryFile).not.toHaveBeenCalled();
    expect(addSuccessToast).not.toHaveBeenCalled();
    expect(addErrorToast).toHaveBeenCalledTimes(1);
    expect(closeExportMenu).toHaveBeenCalledTimes(1);
  });

  it("downloads epub bytes with cover, shows success, and closes the menu", async () => {
    // base64 for a minimal EPUB header (PK magic bytes)
    const fetchEpub = vi.fn().mockResolvedValue({
      contentBase64: "UEsDBA==",
      fileName: "Field Notes.epub",
      mimeType: "application/epub+zip",
    });
    const downloadBinaryFile = vi.fn();
    const addSuccessToast = vi.fn();
    const addErrorToast = vi.fn();
    const closeExportMenu = vi.fn();

    await runProjectEpubExport({
      nodeId: "node-4",
      includeDescendants: true,
      includeFolderNames: false,
      includeNoteNames: true,
      sortMode: "alphabetical",
      coverAttachmentId: "cover-uuid-1111",
      fetchEpub,
      downloadBinaryFile,
      addSuccessToast,
      addErrorToast,
      closeExportMenu,
    });

    expect(fetchEpub).toHaveBeenCalledWith({
      id: "node-4",
      includeDescendants: true,
      includeFolderNames: false,
      includeNoteNames: true,
      sortMode: "alphabetical",
      coverAttachmentId: "cover-uuid-1111",
    });
    expect(downloadBinaryFile).toHaveBeenCalledWith(
      Uint8Array.from([80, 75, 3, 4]),
      "Field Notes.epub",
      "application/epub+zip",
    );
    expect(addSuccessToast).toHaveBeenCalledTimes(1);
    expect(addErrorToast).not.toHaveBeenCalled();
    expect(closeExportMenu).toHaveBeenCalledTimes(1);
  });

  it("downloads epub bytes without cover when no coverAttachmentId is given", async () => {
    const fetchEpub = vi.fn().mockResolvedValue({
      contentBase64: "UEsDBA==",
      fileName: "Plain Notes.epub",
      mimeType: "application/epub+zip",
    });
    const downloadBinaryFile = vi.fn();
    const addSuccessToast = vi.fn();
    const addErrorToast = vi.fn();
    const closeExportMenu = vi.fn();

    await runProjectEpubExport({
      nodeId: "node-5",
      includeDescendants: false,
      includeFolderNames: true,
      includeNoteNames: false,
      sortMode: "manual",
      fetchEpub,
      downloadBinaryFile,
      addSuccessToast,
      addErrorToast,
      closeExportMenu,
    });

    expect(fetchEpub).toHaveBeenCalledWith({
      id: "node-5",
      includeDescendants: false,
      includeFolderNames: true,
      includeNoteNames: false,
      sortMode: "manual",
      coverAttachmentId: undefined,
    });
    expect(addSuccessToast).toHaveBeenCalledTimes(1);
    expect(addErrorToast).not.toHaveBeenCalled();
  });

  it("shows an EPUB export error and still closes the menu", async () => {
    const fetchEpub = vi.fn().mockRejectedValue(new Error("epub-boom"));
    const downloadBinaryFile = vi.fn();
    const addSuccessToast = vi.fn();
    const addErrorToast = vi.fn();
    const closeExportMenu = vi.fn();

    await runProjectEpubExport({
      nodeId: "node-6",
      includeDescendants: true,
      includeFolderNames: true,
      includeNoteNames: true,
      sortMode: "alphabetical",
      fetchEpub,
      downloadBinaryFile,
      addSuccessToast,
      addErrorToast,
      closeExportMenu,
    });

    expect(downloadBinaryFile).not.toHaveBeenCalled();
    expect(addSuccessToast).not.toHaveBeenCalled();
    expect(addErrorToast).toHaveBeenCalledTimes(1);
    expect(closeExportMenu).toHaveBeenCalledTimes(1);
  });
});
