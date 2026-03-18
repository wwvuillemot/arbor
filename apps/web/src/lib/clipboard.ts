export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) {
    return false;
  }

  try {
    if (typeof navigator !== "undefined") {
      const clipboard = navigator.clipboard;
      if (typeof clipboard?.writeText === "function") {
        await clipboard.writeText(text);
        return true;
      }
    }
  } catch {
    // Fall back to the legacy copy approach below.
  }

  if (
    typeof document === "undefined" ||
    typeof document.execCommand !== "function"
  ) {
    return false;
  }

  const hiddenTextArea = document.createElement("textarea");
  hiddenTextArea.value = text;
  hiddenTextArea.setAttribute("readonly", "true");
  hiddenTextArea.style.position = "fixed";
  hiddenTextArea.style.opacity = "0";
  hiddenTextArea.style.pointerEvents = "none";

  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const selection = document.getSelection();
  const originalRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  document.body.appendChild(hiddenTextArea);
  hiddenTextArea.focus();
  hiddenTextArea.select();
  hiddenTextArea.setSelectionRange(0, hiddenTextArea.value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    hiddenTextArea.remove();

    if (selection && originalRange) {
      selection.removeAllRanges();
      selection.addRange(originalRange);
    }

    activeElement?.focus();
  }
}
