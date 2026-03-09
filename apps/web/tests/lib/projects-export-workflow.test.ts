import { describe, expect, it, vi } from "vitest";

import {
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
      fetchMarkdown,
      downloadTextFile,
      addSuccessToast,
      addErrorToast,
      closeExportMenu,
    });

    expect(fetchMarkdown).toHaveBeenCalledWith({
      id: "node-1",
      includeDescendants: true,
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

  it("opens printable HTML, shows success, and closes the menu", async () => {
    const fetchHtml = vi.fn().mockResolvedValue({ content: "<html></html>" });
    const openHtmlPrintWindow = vi.fn().mockReturnValue(null);
    const addSuccessToast = vi.fn();
    const addErrorToast = vi.fn();
    const closeExportMenu = vi.fn();

    await runProjectPdfExport({
      nodeId: "node-2",
      includeDescendants: false,
      fetchHtml,
      openHtmlPrintWindow,
      addSuccessToast,
      addErrorToast,
      closeExportMenu,
    });

    expect(fetchHtml).toHaveBeenCalledWith({
      id: "node-2",
      includeDescendants: false,
    });
    expect(openHtmlPrintWindow).toHaveBeenCalledWith("<html></html>");
    expect(addSuccessToast).toHaveBeenCalledTimes(1);
    expect(addErrorToast).not.toHaveBeenCalled();
    expect(closeExportMenu).toHaveBeenCalledTimes(1);
  });

  it("shows a PDF export error and still closes the menu", async () => {
    const fetchHtml = vi.fn().mockRejectedValue(new Error("boom"));
    const openHtmlPrintWindow = vi.fn();
    const addSuccessToast = vi.fn();
    const addErrorToast = vi.fn();
    const closeExportMenu = vi.fn();

    await runProjectPdfExport({
      nodeId: "node-2",
      includeDescendants: true,
      fetchHtml,
      openHtmlPrintWindow,
      addSuccessToast,
      addErrorToast,
      closeExportMenu,
    });

    expect(openHtmlPrintWindow).not.toHaveBeenCalled();
    expect(addSuccessToast).not.toHaveBeenCalled();
    expect(addErrorToast).toHaveBeenCalledTimes(1);
    expect(closeExportMenu).toHaveBeenCalledTimes(1);
  });
});
