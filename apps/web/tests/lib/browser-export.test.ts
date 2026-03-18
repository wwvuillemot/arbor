import { describe, expect, it, vi } from "vitest";

import {
  downloadBinaryFile,
  downloadTextFile,
  openHtmlPrintWindow,
} from "@/lib/browser-export";

describe("browser export utilities", () => {
  it("downloads text content through a temporary anchor", () => {
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:download-url");
    const mockRevokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName: string) => {
        if (tagName === "a") {
          const anchor = originalCreateElement("a");
          anchor.click = mockClick;
          return anchor;
        }

        return originalCreateElement(tagName);
      });

    downloadTextFile("# Arbor", "export.md", "text/markdown");

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:download-url");

    createElementSpy.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("downloads binary content through a temporary anchor", () => {
    const mockCreateObjectURL = vi
      .fn()
      .mockReturnValue("blob:binary-download-url");
    const mockRevokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName: string) => {
        if (tagName === "a") {
          const anchor = originalCreateElement("a");
          anchor.click = mockClick;
          return anchor;
        }

        return originalCreateElement(tagName);
      });

    downloadBinaryFile(
      Uint8Array.from([80, 75, 3, 4]),
      "export.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith(
      "blob:binary-download-url",
    );

    createElementSpy.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("opens a print window for HTML content and prints after load", () => {
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:print-url");
    const mockRevokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    const eventHandlers = new Map<string, EventListenerOrEventListenerObject>();
    const mockPrintWindow = {
      addEventListener: vi.fn(
        (eventName: string, listener: EventListenerOrEventListenerObject) => {
          eventHandlers.set(eventName, listener);
        },
      ),
      removeEventListener: vi.fn(),
      focus: vi.fn(),
      print: vi.fn(),
    } as unknown as Window;
    const originalOpen = window.open;
    const mockOpen = vi.fn().mockReturnValue(mockPrintWindow);
    Object.defineProperty(window, "open", {
      value: mockOpen,
      writable: true,
      configurable: true,
    });

    const openedWindow = openHtmlPrintWindow("<html><body>Arbor</body></html>");

    expect(openedWindow).toBe(mockPrintWindow);
    expect(mockOpen).toHaveBeenCalledWith("blob:print-url", "_blank");

    const loadListener = eventHandlers.get("load");
    if (typeof loadListener === "function") {
      loadListener(new Event("load"));
    } else {
      loadListener?.handleEvent(new Event("load"));
    }

    expect(mockPrintWindow.focus).toHaveBeenCalled();
    expect(mockPrintWindow.print).toHaveBeenCalled();

    const afterPrintListener = eventHandlers.get("afterprint");
    if (typeof afterPrintListener === "function") {
      afterPrintListener(new Event("afterprint"));
    } else {
      afterPrintListener?.handleEvent(new Event("afterprint"));
    }

    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:print-url");

    Object.defineProperty(window, "open", {
      value: originalOpen,
      writable: true,
      configurable: true,
    });
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("revokes the object URL immediately when the print window cannot open", () => {
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:print-url");
    const mockRevokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    const originalOpen = window.open;
    const mockOpen = vi.fn().mockReturnValue(null);
    Object.defineProperty(window, "open", {
      value: mockOpen,
      writable: true,
      configurable: true,
    });

    expect(openHtmlPrintWindow("<html></html>")).toBeNull();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:print-url");

    Object.defineProperty(window, "open", {
      value: originalOpen,
      writable: true,
      configurable: true,
    });
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });
});
