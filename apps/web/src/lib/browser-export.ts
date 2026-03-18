const HTML_MIME_TYPE = "text/html";

function downloadBlob(fileBlob: Blob, fileName: string): void {
  const fileUrl = URL.createObjectURL(fileBlob);
  const downloadAnchor = document.createElement("a");

  downloadAnchor.href = fileUrl;
  downloadAnchor.download = fileName;
  downloadAnchor.click();

  URL.revokeObjectURL(fileUrl);
}

export function downloadTextFile(
  fileContent: string,
  fileName: string,
  mimeType: string,
): void {
  downloadBlob(new Blob([fileContent], { type: mimeType }), fileName);
}

export function downloadBinaryFile(
  fileBytes: Uint8Array,
  fileName: string,
  mimeType: string,
): void {
  const blobBytes = new Uint8Array(fileBytes);
  downloadBlob(new Blob([blobBytes], { type: mimeType }), fileName);
}

export function openHtmlPrintWindow(htmlContent: string): Window | null {
  const htmlBlob = new Blob([htmlContent], { type: HTML_MIME_TYPE });
  const htmlUrl = URL.createObjectURL(htmlBlob);
  const printWindow = window.open(htmlUrl, "_blank");

  if (!printWindow) {
    URL.revokeObjectURL(htmlUrl);
    return null;
  }

  let hasRevokedHtmlUrl = false;
  const revokeHtmlUrl = () => {
    if (hasRevokedHtmlUrl) {
      return;
    }

    hasRevokedHtmlUrl = true;
    printWindow.removeEventListener("afterprint", revokeHtmlUrl);
    printWindow.removeEventListener("beforeunload", revokeHtmlUrl);
    URL.revokeObjectURL(htmlUrl);
  };

  const handlePrintWindowLoad = () => {
    printWindow.removeEventListener("load", handlePrintWindowLoad);
    printWindow.focus();
    printWindow.print();
  };

  printWindow.addEventListener("load", handlePrintWindowLoad);
  printWindow.addEventListener("afterprint", revokeHtmlUrl);
  printWindow.addEventListener("beforeunload", revokeHtmlUrl);

  return printWindow;
}
