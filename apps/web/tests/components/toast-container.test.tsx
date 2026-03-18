import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { ToastContainer } from "@/components/toast-container";
import { ToastProvider, useToast } from "@/contexts/toast-context";

const longToastMessage = [
  "Anthropic API error (400): invalid_request_error",
  "messages.2.content.0: unexpected tool_use_id found in tool_result blocks",
  "request_id=req_011CZ23Rxq1rHyAyW",
].join("\n");

function ToastTestHarness() {
  const { addToast } = useToast();

  return (
    <button onClick={() => addToast(longToastMessage, "error", 0)}>
      show toast
    </button>
  );
}

describe("ToastContainer", () => {
  const originalClipboard = navigator.clipboard;
  const originalExecCommand = document.execCommand;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  function renderToastContainer() {
    render(
      <ToastProvider>
        <ToastTestHarness />
        <ToastContainer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "show toast" }));
  }

  it("renders the toast message and exposes a copy action", async () => {
    renderToastContainer();

    const toastMessage = await screen.findByTestId("toast-message");
    const normalizedToastMessage = longToastMessage.replaceAll("\n", " ");

    expect(toastMessage).toHaveTextContent(normalizedToastMessage);
    expect(
      screen.getByRole("button", { name: /copy toast message/i }),
    ).toBeInTheDocument();
  });

  it("uses a bounded right-aligned stack layout for long messages", async () => {
    renderToastContainer();

    const toastContainer = await screen.findByTestId("toast-container");
    const toastStack = screen.getByTestId("toast-stack");
    const toastItem = screen.getByTestId("toast-item");

    expect(toastContainer).toHaveClass(
      "fixed",
      "inset-x-4",
      "bottom-4",
      "flex",
      "justify-end",
    );
    expect(toastStack).toHaveClass("w-full", "max-w-sm", "flex-col", "gap-2");
    expect(toastItem).toHaveClass("w-full");
    expect(toastItem).not.toHaveClass("absolute");
  });

  it("copies toast text with the Clipboard API when available", async () => {
    vi.useFakeTimers();

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    renderToastContainer();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /copy toast message/i }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(longToastMessage);
    expect(
      screen.getByRole("button", { name: /copied toast message/i }),
    ).toBeInTheDocument();

    act(() => {
      vi.runOnlyPendingTimers();
    });
  });

  it("falls back to execCommand when the Clipboard API is unavailable", async () => {
    vi.useFakeTimers();

    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
    });

    renderToastContainer();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /copy toast message/i }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(
      screen.getByRole("button", { name: /copied toast message/i }),
    ).toBeInTheDocument();

    act(() => {
      vi.runOnlyPendingTimers();
    });
  });
});
