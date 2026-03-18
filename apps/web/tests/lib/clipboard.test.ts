import { describe, expect, it, vi, afterEach } from "vitest";

import { copyTextToClipboard } from "@/lib/clipboard";

describe("copyTextToClipboard", () => {
  const originalClipboard = navigator.clipboard;
  const originalExecCommand = document.execCommand;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    });
    Object.defineProperty(document, "execCommand", {
      value: originalExecCommand,
      configurable: true,
    });
  });

  it("returns false when the text is empty", async () => {
    await expect(copyTextToClipboard("")).resolves.toBe(false);
  });

  it("uses the Clipboard API when it is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await expect(copyTextToClipboard("Arbor toast message")).resolves.toBe(
      true,
    );
    expect(writeText).toHaveBeenCalledWith("Arbor toast message");
  });

  it("falls back to execCommand when the Clipboard API is unavailable", async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
    });

    await expect(copyTextToClipboard("Legacy copy path")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("returns false when no copy mechanism is available", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(document, "execCommand", {
      value: undefined,
      configurable: true,
    });

    await expect(copyTextToClipboard("No clipboard available")).resolves.toBe(
      false,
    );
  });
});
