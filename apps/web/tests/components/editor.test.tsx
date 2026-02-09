import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

// Mock TipTap - since jsdom doesn't support contenteditable/ProseMirror well
const mockEditor = {
  getJSON: vi.fn().mockReturnValue({ type: "doc", content: [] }),
  commands: {
    setContent: vi.fn(),
  },
  isEditable: true,
  setEditable: vi.fn(),
  isActive: vi.fn().mockReturnValue(false),
  can: vi.fn().mockReturnValue({
    undo: vi.fn().mockReturnValue(false),
    redo: vi.fn().mockReturnValue(false),
  }),
  chain: vi.fn().mockReturnValue({
    focus: vi.fn().mockReturnValue({
      toggleBold: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleItalic: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleStrike: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleCode: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleHeading: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleBulletList: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleOrderedList: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleBlockquote: vi.fn().mockReturnValue({ run: vi.fn() }),
      setHorizontalRule: vi.fn().mockReturnValue({ run: vi.fn() }),
      setImage: vi.fn().mockReturnValue({ run: vi.fn() }),
      undo: vi.fn().mockReturnValue({ run: vi.fn() }),
      redo: vi.fn().mockReturnValue({ run: vi.fn() }),
      clearNodes: vi.fn().mockReturnValue({
        unsetAllMarks: vi.fn().mockReturnValue({ run: vi.fn() }),
      }),
    }),
  }),
  on: vi.fn(),
  off: vi.fn(),
  destroy: vi.fn(),
};

let capturedOnUpdate: ((args: { editor: typeof mockEditor }) => void) | null =
  null;

vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn(
    (config: { onUpdate?: (args: { editor: typeof mockEditor }) => void }) => {
      if (config?.onUpdate) {
        capturedOnUpdate = config.onUpdate;
      }
      return mockEditor;
    },
  ),
  EditorContent: ({ editor }: { editor: typeof mockEditor | null }) => (
    <div data-testid="editor-content">
      {editor ? "Editor loaded" : "No editor"}
    </div>
  ),
}));

vi.mock("@tiptap/starter-kit", () => ({
  default: {},
}));

vi.mock("@tiptap/extension-placeholder", () => ({
  default: {
    configure: vi.fn().mockReturnValue({}),
  },
}));

vi.mock("@tiptap/extension-image", () => ({
  default: {
    configure: vi.fn().mockReturnValue({}),
  },
}));

import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import {
  ImageUpload,
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE,
} from "@/components/editor/image-upload";
import { useAutoSave, type AutoSaveStatus } from "@/hooks/use-auto-save";

describe("EditorToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when editor is null", () => {
    const { container } = render(<EditorToolbar editor={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("should render toolbar with role", () => {
    render(<EditorToolbar editor={mockEditor as any} />);
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
  });

  it("should render all formatting buttons", () => {
    render(<EditorToolbar editor={mockEditor as any} />);
    const toolbar = screen.getByRole("toolbar");
    const buttons = toolbar.querySelectorAll("button");
    // undo, redo, h1, h2, h3, bold, italic, strike, code, bullet, ordered, quote, hr, clear = 14
    expect(buttons.length).toBe(14);
  });

  it("should call bold toggle when bold button clicked", () => {
    render(<EditorToolbar editor={mockEditor as any} />);
    const boldButton = screen.getByTitle("bold");
    fireEvent.click(boldButton);
    expect(mockEditor.chain).toHaveBeenCalled();
  });

  it("should call italic toggle when italic button clicked", () => {
    render(<EditorToolbar editor={mockEditor as any} />);
    const italicButton = screen.getByTitle("italic");
    fireEvent.click(italicButton);
    expect(mockEditor.chain).toHaveBeenCalled();
  });

  it("should disable undo when cannot undo", () => {
    render(<EditorToolbar editor={mockEditor as any} />);
    const undoButton = screen.getByTitle("undo");
    expect(undoButton).toBeDisabled();
  });

  it("should disable redo when cannot redo", () => {
    render(<EditorToolbar editor={mockEditor as any} />);
    const redoButton = screen.getByTitle("redo");
    expect(redoButton).toBeDisabled();
  });

  it("should call heading toggle when H1 clicked", () => {
    render(<EditorToolbar editor={mockEditor as any} />);
    const h1Button = screen.getByTitle("heading1");
    fireEvent.click(h1Button);
    expect(mockEditor.chain).toHaveBeenCalled();
  });

  it("should call bullet list toggle when clicked", () => {
    render(<EditorToolbar editor={mockEditor as any} />);
    const bulletButton = screen.getByTitle("bulletList");
    fireEvent.click(bulletButton);
    expect(mockEditor.chain).toHaveBeenCalled();
  });

  it("should call clear formatting when clear button clicked", () => {
    render(<EditorToolbar editor={mockEditor as any} />);
    const clearButton = screen.getByTitle("clearFormatting");
    fireEvent.click(clearButton);
    expect(mockEditor.chain).toHaveBeenCalled();
  });

  it("should not render image button when onInsertImage is not provided", () => {
    render(<EditorToolbar editor={mockEditor as any} />);
    expect(screen.queryByTitle("insertImage")).not.toBeInTheDocument();
  });

  it("should render image button when onInsertImage is provided", () => {
    const onInsertImage = vi.fn();
    render(
      <EditorToolbar
        editor={mockEditor as any}
        onInsertImage={onInsertImage}
      />,
    );
    expect(screen.getByTitle("insertImage")).toBeInTheDocument();
  });

  it("should call onInsertImage when image button clicked", () => {
    const onInsertImage = vi.fn();
    render(
      <EditorToolbar
        editor={mockEditor as any}
        onInsertImage={onInsertImage}
      />,
    );
    fireEvent.click(screen.getByTitle("insertImage"));
    expect(onInsertImage).toHaveBeenCalledOnce();
  });
});

describe("TiptapEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnUpdate = null;
  });

  it("should render the editor container", () => {
    render(<TiptapEditor content={null} />);
    expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
  });

  it("should render the toolbar", () => {
    render(<TiptapEditor content={null} />);
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
  });

  it("should render EditorContent", () => {
    render(<TiptapEditor content={null} />);
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    expect(screen.getByText("Editor loaded")).toBeInTheDocument();
  });

  it("should call onChange when editor content updates", () => {
    const handleChange = vi.fn();
    render(<TiptapEditor content={null} onChange={handleChange} />);

    // Simulate editor update
    if (capturedOnUpdate) {
      const newContent = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        ],
      };
      mockEditor.getJSON.mockReturnValueOnce(newContent);
      capturedOnUpdate({ editor: mockEditor });
      expect(handleChange).toHaveBeenCalledWith(newContent);
    }
  });

  it("should render with content", () => {
    const content = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Test" }] },
      ],
    };
    render(<TiptapEditor content={content} />);
    expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
  });

  it("should not call onChange when onChange is not provided", () => {
    render(<TiptapEditor content={null} />);

    // Simulate editor update - should not throw
    if (capturedOnUpdate) {
      expect(() => capturedOnUpdate!({ editor: mockEditor })).not.toThrow();
    }
  });
});

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function TestComponent({
    nodeId,
    content,
    onSave,
    debounceMs,
  }: {
    nodeId: string | null;
    content: Record<string, unknown> | null;
    onSave: (nodeId: string, content: Record<string, unknown>) => Promise<void>;
    debounceMs?: number;
  }) {
    const { status } = useAutoSave({ nodeId, content, onSave, debounceMs });
    return <div data-testid="status">{status}</div>;
  }

  it("should start with idle status", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<TestComponent nodeId="1" content={null} onSave={onSave} />);
    expect(screen.getByTestId("status").textContent).toBe("idle");
  });

  it("should not save when nodeId is null", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TestComponent nodeId={null} content={{ type: "doc" }} onSave={onSave} />,
    );
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("should not save when content is null", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<TestComponent nodeId="1" content={null} onSave={onSave} />);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("should debounce save calls", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const content = { type: "doc", content: [{ type: "paragraph" }] };
    render(
      <TestComponent
        nodeId="node-1"
        content={content}
        onSave={onSave}
        debounceMs={500}
      />,
    );

    // Wait for debounce
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(onSave).toHaveBeenCalledWith("node-1", content);
  });

  it("should show saving status during save", async () => {
    let resolveSave: () => void;
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const onSave = vi.fn().mockReturnValue(savePromise);
    const content = { type: "doc", content: [] };

    render(
      <TestComponent
        nodeId="node-1"
        content={content}
        onSave={onSave}
        debounceMs={100}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByTestId("status").textContent).toBe("saving");

    await act(async () => {
      resolveSave!();
    });

    expect(screen.getByTestId("status").textContent).toBe("saved");
  });

  it("should show error status on save failure", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Save failed"));
    const content = { type: "doc", content: [{ type: "text" }] };

    render(
      <TestComponent
        nodeId="node-1"
        content={content}
        onSave={onSave}
        debounceMs={100}
      />,
    );

    // Advance debounce timer
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Flush microtask queue so rejected promise settles
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("status").textContent).toBe("error");
  });

  it("should reset status when nodeId changes", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const content = { type: "doc", content: [] };

    const { rerender } = render(
      <TestComponent
        nodeId="node-1"
        content={content}
        onSave={onSave}
        debounceMs={100}
      />,
    );

    // Advance debounce timer
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Flush microtask queue so resolved promise settles
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("status").textContent).toBe("saved");

    // Change node
    rerender(
      <TestComponent
        nodeId="node-2"
        content={content}
        onSave={onSave}
        debounceMs={100}
      />,
    );

    expect(screen.getByTestId("status").textContent).toBe("idle");
  });
});

describe("ImageUpload", () => {
  const defaultProps = {
    nodeId: "node-1",
    projectId: "project-1",
    onUploadComplete: vi.fn(),
    onUploadError: vi.fn(),
    onUpload: vi.fn().mockResolvedValue({ id: "attachment-1" }),
    onGetDownloadUrl: vi
      .fn()
      .mockResolvedValue({ url: "https://example.com/image.png" }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom File doesn't have arrayBuffer method, polyfill it
    if (!File.prototype.arrayBuffer) {
      File.prototype.arrayBuffer = function () {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.readAsArrayBuffer(this);
        });
      };
    }
  });

  it("should render the dropzone", () => {
    render(<ImageUpload {...defaultProps} />);
    expect(screen.getByTestId("image-upload-dropzone")).toBeInTheDocument();
  });

  it("should render drop-or-click text", () => {
    render(<ImageUpload {...defaultProps} />);
    expect(screen.getByText("imageUpload.dropOrClick")).toBeInTheDocument();
  });

  it("should render supported formats text", () => {
    render(<ImageUpload {...defaultProps} />);
    expect(
      screen.getByText("imageUpload.supportedFormats"),
    ).toBeInTheDocument();
  });

  it("should render uploading state", () => {
    render(<ImageUpload {...defaultProps} isUploading={true} />);
    expect(screen.getByText("imageUpload.uploading")).toBeInTheDocument();
    expect(
      screen.queryByText("imageUpload.dropOrClick"),
    ).not.toBeInTheDocument();
  });

  it("should have a hidden file input", () => {
    render(<ImageUpload {...defaultProps} />);
    const input = screen.getByTestId("image-upload-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass("hidden");
  });

  it("should accept only image types", () => {
    render(<ImageUpload {...defaultProps} />);
    const input = screen.getByTestId("image-upload-input") as HTMLInputElement;
    expect(input.accept).toBe(ACCEPTED_IMAGE_TYPES.join(","));
  });

  it("should trigger file input on click", () => {
    render(<ImageUpload {...defaultProps} />);
    const dropzone = screen.getByTestId("image-upload-dropzone");
    const input = screen.getByTestId("image-upload-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(dropzone);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("should trigger file input on Enter key", () => {
    render(<ImageUpload {...defaultProps} />);
    const dropzone = screen.getByTestId("image-upload-dropzone");
    const input = screen.getByTestId("image-upload-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.keyDown(dropzone, { key: "Enter" });
    expect(clickSpy).toHaveBeenCalled();
  });

  it("should trigger file input on Space key", () => {
    render(<ImageUpload {...defaultProps} />);
    const dropzone = screen.getByTestId("image-upload-dropzone");
    const input = screen.getByTestId("image-upload-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.keyDown(dropzone, { key: " " });
    expect(clickSpy).toHaveBeenCalled();
  });

  it("should call onUploadError for invalid file type", async () => {
    render(<ImageUpload {...defaultProps} />);
    const input = screen.getByTestId("image-upload-input");
    const invalidFile = new File(["test"], "test.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [invalidFile] } });
    await waitFor(() => {
      expect(defaultProps.onUploadError).toHaveBeenCalledWith(
        "imageUpload.invalidType",
      );
    });
  });

  it("should call onUploadError for file too large", async () => {
    render(<ImageUpload {...defaultProps} />);
    const input = screen.getByTestId("image-upload-input");
    // Create a file that exceeds MAX_FILE_SIZE
    const largeContent = new ArrayBuffer(MAX_FILE_SIZE + 1);
    const largeFile = new File([largeContent], "large.png", {
      type: "image/png",
    });
    fireEvent.change(input, { target: { files: [largeFile] } });
    await waitFor(() => {
      expect(defaultProps.onUploadError).toHaveBeenCalledWith(
        "imageUpload.fileTooLarge",
      );
    });
  });

  it("should upload valid file and call onUploadComplete", async () => {
    render(<ImageUpload {...defaultProps} />);
    const input = screen.getByTestId("image-upload-input");
    const validFile = new File(["imagedata"], "photo.png", {
      type: "image/png",
    });
    fireEvent.change(input, { target: { files: [validFile] } });
    await waitFor(() => {
      expect(defaultProps.onUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: "node-1",
          projectId: "project-1",
          filename: "photo.png",
          mimeType: "image/png",
        }),
      );
    });
    await waitFor(() => {
      expect(defaultProps.onGetDownloadUrl).toHaveBeenCalledWith({
        id: "attachment-1",
      });
    });
    await waitFor(() => {
      expect(defaultProps.onUploadComplete).toHaveBeenCalledWith(
        "attachment-1",
        "https://example.com/image.png",
      );
    });
  });

  it("should call onUploadError when upload fails", async () => {
    const errorProps = {
      ...defaultProps,
      onUpload: vi.fn().mockRejectedValue(new Error("Upload network error")),
    };
    render(<ImageUpload {...errorProps} />);
    const input = screen.getByTestId("image-upload-input");
    const validFile = new File(["imagedata"], "photo.png", {
      type: "image/png",
    });
    fireEvent.change(input, { target: { files: [validFile] } });
    await waitFor(() => {
      expect(errorProps.onUploadError).toHaveBeenCalledWith(
        "Upload network error",
      );
    });
  });

  it("should handle drag over by adding visual feedback", () => {
    render(<ImageUpload {...defaultProps} />);
    const dropzone = screen.getByTestId("image-upload-dropzone");
    fireEvent.dragOver(dropzone);
    expect(dropzone.className).toContain("border-accent");
  });

  it("should handle drag leave by removing visual feedback", () => {
    render(<ImageUpload {...defaultProps} />);
    const dropzone = screen.getByTestId("image-upload-dropzone");
    fireEvent.dragOver(dropzone);
    fireEvent.dragLeave(dropzone);
    expect(dropzone.className).not.toContain("border-accent bg-accent/10");
  });

  it("should process dropped image files", async () => {
    render(<ImageUpload {...defaultProps} />);
    const dropzone = screen.getByTestId("image-upload-dropzone");
    const validFile = new File(["imagedata"], "dropped.png", {
      type: "image/png",
    });
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [validFile] },
    });
    await waitFor(() => {
      expect(defaultProps.onUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: "dropped.png",
          mimeType: "image/png",
        }),
      );
    });
  });

  it("should export ACCEPTED_IMAGE_TYPES and MAX_FILE_SIZE", () => {
    expect(ACCEPTED_IMAGE_TYPES).toContain("image/png");
    expect(ACCEPTED_IMAGE_TYPES).toContain("image/jpeg");
    expect(ACCEPTED_IMAGE_TYPES).toContain("image/gif");
    expect(ACCEPTED_IMAGE_TYPES).toContain("image/webp");
    expect(ACCEPTED_IMAGE_TYPES).toContain("image/svg+xml");
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
  });
});
