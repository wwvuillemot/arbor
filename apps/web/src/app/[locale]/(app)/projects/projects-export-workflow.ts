type ExportNodeInput = {
  id: string;
  includeDescendants: boolean;
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
  fetchHtml: (input: ExportNodeInput) => Promise<{ content: string }>;
  openHtmlPrintWindow: (htmlContent: string) => Window | null;
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
  fetchMarkdown,
  downloadTextFile,
  ...statusHandlers
}: MarkdownExportParams): Promise<void> {
  await runProjectExportWorkflow(async () => {
    const markdownExport = await fetchMarkdown({
      id: nodeId,
      includeDescendants,
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
  fetchHtml,
  openHtmlPrintWindow,
  ...statusHandlers
}: PdfExportParams): Promise<void> {
  await runProjectExportWorkflow(async () => {
    const htmlExport = await fetchHtml({
      id: nodeId,
      includeDescendants,
    });
    openHtmlPrintWindow(htmlExport.content);
  }, statusHandlers);
}
