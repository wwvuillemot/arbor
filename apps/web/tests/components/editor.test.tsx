import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Editor } from "@tiptap/react";
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
const mockSelectionRestoreRun = vi.fn();
const mockSetTextSelection = vi.fn().mockReturnValue({
  run: mockSelectionRestoreRun,
});
const mockFocusedChain = {
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
};
const mockChain = {
  focus: vi.fn().mockReturnValue(mockFocusedChain),
  setTextSelection: mockSetTextSelection,
};

const mockEditor = {
  getJSON: vi.fn().mockReturnValue({ type: "doc", content: [] }),
  commands: {
    setContent: vi.fn(),
  },
  state: {
    selection: { from: 1, to: 1 },
    doc: { content: { size: 1 } },
  },
  isEditable: true,
  setEditable: vi.fn(),
  isActive: vi.fn().mockReturnValue(false),
  can: vi.fn().mockReturnValue({
    undo: vi.fn().mockReturnValue(false),
    redo: vi.fn().mockReturnValue(false),
  }),
  chain: vi.fn().mockReturnValue(mockChain),
  on: vi.fn(),
  off: vi.fn(),
  destroy: vi.fn(),
};

let capturedOnUpdate: ((args: { editor: typeof mockEditor }) => void) | null =
  null;
let capturedUseEditorConfig: {
  content?: unknown;
  onUpdate?: (args: { editor: typeof mockEditor }) => void;
  extensions?: unknown[];
} | null = null;

vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn(
    (config: {
      content?: unknown;
      onUpdate?: (args: { editor: typeof mockEditor }) => void;
    }) => {
      capturedUseEditorConfig = config;
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
  default: {
    configure: vi.fn().mockReturnValue({}),
  },
}));

vi.mock("@tiptap/extension-placeholder", () => ({
  default: {
    configure: vi.fn().mockReturnValue({}),
  },
}));

vi.mock("@tiptap/extension-table", () => ({
  Table: { name: "table" },
}));

vi.mock("@tiptap/extension-table-cell", () => ({
  TableCell: { name: "tableCell" },
}));

vi.mock("@tiptap/extension-table-header", () => ({
  TableHeader: { name: "tableHeader" },
}));

vi.mock("@tiptap/extension-table-row", () => ({
  TableRow: { name: "tableRow" },
}));

vi.mock("@tiptap/extension-image", () => ({
  default: {
    configure: vi.fn().mockReturnValue({}),
  },
}));

// Mock next-intl is already above; also mock next/navigation for any components needing router
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/projects",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock @tiptap/extension-link so Link.extend() works without full browser environment
vi.mock("@tiptap/extension-link", () => ({
  default: {
    extend: vi.fn(() => ({
      configure: vi.fn().mockReturnValue({}),
    })),
    configure: vi.fn().mockReturnValue({}),
  },
}));

// mergeAttributes is used by SafeLink.renderHTML — provide a real-enough shim
// Mark is used by AiAttributionMark.create() at module load time
// Node is used by ResizableImage.create() at module load time
vi.mock("@tiptap/core", () => ({
  mergeAttributes: (...args: Record<string, unknown>[]) =>
    Object.assign({}, ...args),
  Mark: {
    create: vi.fn().mockReturnValue({ name: "aiAttribution" }),
  },
  Node: {
    create: vi.fn().mockReturnValue({ name: "image" }),
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    provenance: {
      getHistory: {
        useQuery: vi.fn(() => ({
          data: [],
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        })),
      },
    },
  },
  getTRPCClient: vi.fn(),
}));

import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import {
  ImageUpload,
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE,
} from "@/components/editor/image-upload";
import { useAutoSave } from "@/hooks/use-auto-save";
import { trpc } from "@/lib/trpc";

const testEditor = mockEditor as unknown as Editor;

function createHistoryQueryResult(data: unknown) {
  return {
    data,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    trpc: { path: "provenance.getHistory" },
  } as unknown as ReturnType<typeof trpc.provenance.getHistory.useQuery>;
}

describe("EditorToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when editor is null", () => {
    const { container } = render(<EditorToolbar editor={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("should render toolbar with role", () => {
    render(<EditorToolbar editor={testEditor} />);
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
  });

  it("should render all formatting buttons", () => {
    render(<EditorToolbar editor={testEditor} />);
    const toolbar = screen.getByRole("toolbar");
    const buttons = toolbar.querySelectorAll("button");
    // undo, redo, h1, h2, h3, bold, italic, strike, code, link, bullet, ordered, quote, hr, clear, aiAttribution = 16
    expect(buttons.length).toBe(16);
  });

  it("should call bold toggle when bold button clicked", () => {
    render(<EditorToolbar editor={testEditor} />);
    const boldButton = screen.getByTitle("bold");
    fireEvent.click(boldButton);
    expect(mockEditor.chain).toHaveBeenCalled();
  });

  it("should call italic toggle when italic button clicked", () => {
    render(<EditorToolbar editor={testEditor} />);
    const italicButton = screen.getByTitle("italic");
    fireEvent.click(italicButton);
    expect(mockEditor.chain).toHaveBeenCalled();
  });

  it("should disable undo when cannot undo", () => {
    render(<EditorToolbar editor={testEditor} />);
    const undoButton = screen.getByTitle("undo");
    expect(undoButton).toBeDisabled();
  });

  it("should disable redo when cannot redo", () => {
    render(<EditorToolbar editor={testEditor} />);
    const redoButton = screen.getByTitle("redo");
    expect(redoButton).toBeDisabled();
  });

  it("should call heading toggle when H1 clicked", () => {
    render(<EditorToolbar editor={testEditor} />);
    const h1Button = screen.getByTitle("heading1");
    fireEvent.click(h1Button);
    expect(mockEditor.chain).toHaveBeenCalled();
  });

  it("should call bullet list toggle when clicked", () => {
    render(<EditorToolbar editor={testEditor} />);
    const bulletButton = screen.getByTitle("bulletList");
    fireEvent.click(bulletButton);
    expect(mockEditor.chain).toHaveBeenCalled();
  });

  it("should call clear formatting when clear button clicked", () => {
    render(<EditorToolbar editor={testEditor} />);
    const clearButton = screen.getByTitle("clearFormatting");
    fireEvent.click(clearButton);
    expect(mockEditor.chain).toHaveBeenCalled();
  });

  it("should show insert link button when cursor is not in a link", () => {
    mockEditor.isActive.mockReturnValue(false);
    render(<EditorToolbar editor={testEditor} onInsertLink={vi.fn()} />);
    expect(screen.getByTitle("insertLink")).toBeInTheDocument();
    expect(screen.queryByTitle("removeLink")).not.toBeInTheDocument();
  });

  it("should show both insert-link and remove-link buttons when cursor is inside a link", () => {
    mockEditor.isActive.mockImplementation((type: string) => type === "link");
    render(<EditorToolbar editor={testEditor} onInsertLink={vi.fn()} />);
    expect(screen.getByTitle("insertLink")).toBeInTheDocument();
    expect(screen.getByTitle("removeLink")).toBeInTheDocument();
  });

  it("should call onInsertLink when insert link button is clicked", () => {
    mockEditor.isActive.mockReturnValue(false);
    const onInsertLink = vi.fn();
    render(<EditorToolbar editor={testEditor} onInsertLink={onInsertLink} />);
    fireEvent.click(screen.getByTitle("insertLink"));
    expect(onInsertLink).toHaveBeenCalledOnce();
  });

  it("should call unsetLink when remove link button is clicked", () => {
    mockEditor.isActive.mockImplementation((type: string) => type === "link");
    const unsetLinkRun = vi.fn();
    mockEditor.chain.mockReturnValue({
      focus: vi.fn().mockReturnValue({
        unsetLink: vi.fn().mockReturnValue({ run: unsetLinkRun }),
      }),
    });
    render(<EditorToolbar editor={testEditor} onInsertLink={vi.fn()} />);
    fireEvent.click(screen.getByTitle("removeLink"));
    expect(unsetLinkRun).toHaveBeenCalled();
  });

  it("should prevent default on toolbar button mousedown to preserve editor focus", () => {
    render(<EditorToolbar editor={testEditor} />);
    const boldButton = screen.getByTitle("bold");
    let prevented = false;
    document.addEventListener("mousedown", (e) => {
      prevented = e.defaultPrevented;
    });
    fireEvent.mouseDown(boldButton);
    expect(prevented).toBe(true);
  });

  it("should not render image button when onInsertImage is not provided", () => {
    render(<EditorToolbar editor={testEditor} />);
    expect(screen.queryByTitle("insertImage")).not.toBeInTheDocument();
  });

  it("should render image button when onInsertImage is provided", () => {
    const onInsertImage = vi.fn();
    render(<EditorToolbar editor={testEditor} onInsertImage={onInsertImage} />);
    expect(screen.getByTitle("insertImage")).toBeInTheDocument();
  });

  it("should call onInsertImage when image button clicked", () => {
    const onInsertImage = vi.fn();
    render(<EditorToolbar editor={testEditor} onInsertImage={onInsertImage} />);
    fireEvent.click(screen.getByTitle("insertImage"));
    expect(onInsertImage).toHaveBeenCalledOnce();
  });

  it("should render attribution toggle button", () => {
    render(<EditorToolbar editor={testEditor} />);
    expect(screen.getByTitle("aiAttribution")).toBeInTheDocument();
  });

  it("should call onToggleAttribution when attribution button is clicked", () => {
    const onToggle = vi.fn();
    render(
      <EditorToolbar
        editor={testEditor}
        onToggleAttribution={onToggle}
        showAiAttribution={false}
      />,
    );
    fireEvent.click(screen.getByTitle("aiAttribution"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("should show attribution button as active when showAiAttribution is true", () => {
    render(
      <EditorToolbar
        editor={testEditor}
        onToggleAttribution={vi.fn()}
        showAiAttribution={true}
      />,
    );
    expect(screen.getByTitle("aiAttribution")).toHaveClass("bg-accent");
  });
});

describe("TiptapEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnUpdate = null;
    capturedUseEditorConfig = null;
    mockEditor.chain.mockReturnValue(mockChain);
    mockEditor.getJSON.mockReturnValue({ type: "doc", content: [] });
    mockEditor.state.selection = { from: 1, to: 1 };
    mockEditor.state.doc.content.size = 1;
    vi.mocked(trpc.provenance.getHistory.useQuery).mockReturnValue(
      createHistoryQueryResult([]),
    );
  });

  it("should render the editor container", () => {
    render(<TiptapEditor content={null} />);
    expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
  });

  it("should register table extensions in the editor configuration", () => {
    render(<TiptapEditor content={null} />);

    expect(capturedUseEditorConfig?.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "table" }),
        expect.objectContaining({ name: "tableRow" }),
        expect.objectContaining({ name: "tableHeader" }),
        expect.objectContaining({ name: "tableCell" }),
      ]),
    );
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

  it("should use the latest onChange after switching into edit mode", () => {
    const handleChange = vi.fn();
    const { rerender } = render(
      <TiptapEditor content={null} editable={false} />,
    );

    const initialOnUpdate = capturedOnUpdate;

    rerender(
      <TiptapEditor content={null} editable={true} onChange={handleChange} />,
    );

    expect(initialOnUpdate).not.toBeNull();

    const changedContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Edited after toggle" }],
        },
      ],
    };

    mockEditor.getJSON.mockReturnValueOnce(changedContent);
    initialOnUpdate?.({ editor: mockEditor });

    expect(handleChange).toHaveBeenCalledWith(changedContent);
  });

  it("should not reapply parent-echoed local content while editable", () => {
    const handleChange = vi.fn();
    const initialContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Original note" }],
        },
      ],
    };
    const locallyEditedContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Original note with edit" }],
        },
      ],
    };

    const { rerender } = render(
      <TiptapEditor
        content={initialContent}
        editable={true}
        onChange={handleChange}
      />,
    );

    mockEditor.commands.setContent.mockClear();
    mockEditor.getJSON.mockReturnValue(locallyEditedContent);

    capturedOnUpdate?.({ editor: mockEditor });

    rerender(
      <TiptapEditor
        content={locallyEditedContent}
        editable={true}
        onChange={handleChange}
      />,
    );

    expect(mockEditor.commands.setContent).not.toHaveBeenCalled();
    expect(handleChange).toHaveBeenCalledWith(locallyEditedContent);
  });

  it("should preserve the current selection during same-node external content syncs", () => {
    const initialContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello brave world" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "AI helper note" }],
        },
      ],
    };
    const externallySyncedContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello brave world" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "AI helper note refreshed" }],
        },
      ],
    };

    mockEditor.state.selection = { from: 12, to: 12 };
    mockEditor.state.doc.content.size = 40;
    mockEditor.getJSON.mockReturnValue(initialContent);

    const { rerender } = render(
      <TiptapEditor
        content={initialContent}
        nodeId="11111111-1111-1111-1111-111111111111"
        editable={true}
      />,
    );

    mockEditor.commands.setContent.mockClear();
    mockSetTextSelection.mockClear();
    mockSelectionRestoreRun.mockClear();

    rerender(
      <TiptapEditor
        content={externallySyncedContent}
        nodeId="11111111-1111-1111-1111-111111111111"
        editable={true}
      />,
    );

    expect(mockEditor.commands.setContent).toHaveBeenCalledWith(
      externallySyncedContent,
      { emitUpdate: false },
    );
    expect(mockSetTextSelection).toHaveBeenCalledWith({ from: 12, to: 12 });
    expect(mockSelectionRestoreRun).toHaveBeenCalled();
  });

  it("should fetch provenance history when nodeId is provided", () => {
    render(
      <TiptapEditor
        content={null}
        nodeId="11111111-1111-1111-1111-111111111111"
      />,
    );

    expect(trpc.provenance.getHistory.useQuery).toHaveBeenCalledWith(
      {
        nodeId: "11111111-1111-1111-1111-111111111111",
        limit: 50,
      },
      expect.objectContaining({
        enabled: true,
        refetchOnWindowFocus: false,
        staleTime: 60_000,
      }),
    );
  });

  it("should disable provenance history when nodeId is not provided", () => {
    render(<TiptapEditor content={null} />);

    expect(trpc.provenance.getHistory.useQuery).toHaveBeenCalledWith(
      {
        nodeId: "00000000-0000-0000-0000-000000000000",
        limit: 50,
      },
      expect.objectContaining({ enabled: false }),
    );
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

  it("should not reset equivalent table content when TipTap adds default cell attrs", () => {
    const markdownTableDocument = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Name" }],
                    },
                  ],
                },
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Role" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Aria" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Scout" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const editorTableDocumentWithDefaultAttrs = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Name" }],
                    },
                  ],
                },
                {
                  type: "tableHeader",
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Role" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Aria" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Scout" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    mockEditor.getJSON.mockReturnValue(editorTableDocumentWithDefaultAttrs);

    render(<TiptapEditor content={markdownTableDocument} />);

    expect(mockEditor.commands.setContent).not.toHaveBeenCalled();
  });

  it("should pass AI-attributed content to TipTap when llm history matches the current block", () => {
    vi.mocked(trpc.provenance.getHistory.useQuery).mockReturnValue(
      createHistoryQueryResult([
        {
          id: "history-1",
          nodeId: "11111111-1111-1111-1111-111111111111",
          version: 2,
          actorType: "llm",
          actorId: "llm:gpt-4o",
          action: "update",
          contentBefore: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Human draft" }],
              },
            ],
          },
          contentAfter: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "AI polished text" }],
              },
            ],
          },
          diff: null,
          metadata: { model: "gpt-4o" },
          createdAt: "2024-06-15T11:00:00Z",
        },
      ]),
    );

    render(
      <TiptapEditor
        nodeId="11111111-1111-1111-1111-111111111111"
        content={{
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "AI polished text" }],
            },
          ],
        }}
      />,
    );

    expect(capturedUseEditorConfig?.content).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "AI polished text",
              marks: [
                {
                  type: "aiAttribution",
                  attrs: {
                    modelName: "gpt-4o",
                    timestamp: "2024-06-15T11:00:00Z",
                    tooltipText: "gpt-4o • 2024-06-15T11:00:00.000Z",
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("should expose the editor instance through editorRef", () => {
    const editorRef = React.createRef<Editor>();

    render(<TiptapEditor content={null} editorRef={editorRef} />);

    expect(editorRef.current).toBe(testEditor);
  });

  it("should not call onChange when onChange is not provided", () => {
    render(<TiptapEditor content={null} />);

    // Simulate editor update - should not throw
    if (capturedOnUpdate) {
      expect(() => capturedOnUpdate!({ editor: mockEditor })).not.toThrow();
    }
  });

  it("should strip AI attribution marks before calling onChange", () => {
    const handleChange = vi.fn();
    render(
      <TiptapEditor
        content={null}
        nodeId="11111111-1111-1111-1111-111111111111"
        onChange={handleChange}
      />,
    );

    if (capturedOnUpdate) {
      mockEditor.getJSON.mockReturnValueOnce({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "AI polished text",
                marks: [
                  {
                    type: "aiAttribution",
                    attrs: {
                      modelName: "gpt-4o",
                      timestamp: "2024-06-15T11:00:00Z",
                      tooltipText: "gpt-4o • 2024-06-15T11:00:00.000Z",
                    },
                  },
                  { type: "bold" },
                ],
              },
            ],
          },
        ],
      });

      capturedOnUpdate({ editor: mockEditor });
    }

    expect(handleChange).toHaveBeenCalledWith({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "AI polished text",
              marks: [{ type: "bold" }],
            },
          ],
        },
      ],
    });
  });

  it("should open in new tab and not call onLinkClick when a link is clicked in edit mode", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const onLinkClick = vi.fn();
    render(<TiptapEditor content={null} onLinkClick={onLinkClick} />);

    const editorContent = screen.getByTestId("editor-content");
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "?node=test-uuid-1234");
    anchor.textContent = "A node link";
    editorContent.appendChild(anchor);

    const nativeEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    anchor.dispatchEvent(nativeEvent);

    expect(nativeEvent.defaultPrevented).toBe(true);
    expect(openSpy).toHaveBeenCalledWith(
      "?node=test-uuid-1234",
      "_blank",
      "noopener,noreferrer",
    );
    expect(onLinkClick).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("should not intercept when onLinkClick is not provided", () => {
    render(<TiptapEditor content={null} />);
    const editorContent = screen.getByTestId("editor-content");
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "https://external.example.com");
    editorContent.appendChild(anchor);

    const nativeEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    anchor.dispatchEvent(nativeEvent);
    expect(nativeEvent.defaultPrevented).toBe(false);
  });

  it("should call onLinkClick with href when a read-only link is clicked", () => {
    const onLinkClick = vi.fn();
    render(
      <TiptapEditor
        content={null}
        editable={false}
        onLinkClick={onLinkClick}
      />,
    );

    const editorContent = screen.getByTestId("editor-content");
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "?node=test-uuid-1234");
    anchor.textContent = "A node link";
    editorContent.appendChild(anchor);

    fireEvent.click(anchor);

    expect(onLinkClick).toHaveBeenCalledTimes(1);
    expect(onLinkClick).toHaveBeenCalledWith("?node=test-uuid-1234");
  });

  it("should prevent default browser navigation for read-only links", () => {
    render(
      <TiptapEditor content={null} editable={false} onLinkClick={vi.fn()} />,
    );
    const editorContent = screen.getByTestId("editor-content");
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "https://external.example.com");
    editorContent.appendChild(anchor);

    const nativeEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    anchor.dispatchEvent(nativeEvent);

    expect(nativeEvent.defaultPrevented).toBe(true);
  });

  it("should stop propagation before inner anchor handlers can run in read-only mode", () => {
    render(
      <TiptapEditor content={null} editable={false} onLinkClick={vi.fn()} />,
    );
    const editorContent = screen.getByTestId("editor-content");
    const anchor = document.createElement("a");
    const innerClickHandler = vi.fn();

    anchor.setAttribute("href", "https://external.example.com");
    anchor.addEventListener("click", innerClickHandler);
    editorContent.appendChild(anchor);

    const nativeEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    anchor.dispatchEvent(nativeEvent);

    expect(nativeEvent.defaultPrevented).toBe(true);
    expect(innerClickHandler).not.toHaveBeenCalled();
  });

  it("should keep exactly one active read-only link listener after rerender", () => {
    const firstOnLinkClick = vi.fn();
    const secondOnLinkClick = vi.fn();
    const { rerender } = render(
      <TiptapEditor
        content={null}
        editable={false}
        onLinkClick={firstOnLinkClick}
      />,
    );

    const firstEditorContent = screen.getByTestId("editor-content");
    const firstAnchor = document.createElement("a");
    firstAnchor.setAttribute("href", "?node=first");
    firstEditorContent.appendChild(firstAnchor);

    fireEvent.click(firstAnchor);

    rerender(
      <TiptapEditor
        content={null}
        editable={false}
        onLinkClick={secondOnLinkClick}
      />,
    );

    const secondEditorContent = screen.getByTestId("editor-content");
    const secondAnchor = document.createElement("a");
    secondAnchor.setAttribute("href", "?node=second");
    secondEditorContent.appendChild(secondAnchor);

    fireEvent.click(secondAnchor);

    expect(firstOnLinkClick).toHaveBeenCalledTimes(1);
    expect(firstOnLinkClick).toHaveBeenCalledWith("?node=first");
    expect(secondOnLinkClick).toHaveBeenCalledTimes(1);
    expect(secondOnLinkClick).toHaveBeenCalledWith("?node=second");
  });

  it("should navigate in-place in read-only, open new tab in edit mode", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const onLinkClick = vi.fn();
    const { rerender } = render(
      <TiptapEditor
        content={null}
        editable={false}
        onLinkClick={onLinkClick}
      />,
    );

    const readOnlyEditorContent = screen.getByTestId("editor-content");
    const readOnlyAnchor = document.createElement("a");
    readOnlyAnchor.setAttribute("href", "?node=read-only");
    readOnlyEditorContent.appendChild(readOnlyAnchor);

    fireEvent.click(readOnlyAnchor);

    rerender(
      <TiptapEditor content={null} editable={true} onLinkClick={onLinkClick} />,
    );

    const editableEditorContent = screen.getByTestId("editor-content");
    const editableAnchor = document.createElement("a");
    editableAnchor.setAttribute("href", "?node=editable");
    editableEditorContent.appendChild(editableAnchor);

    const editableClickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    editableAnchor.dispatchEvent(editableClickEvent);

    expect(onLinkClick).toHaveBeenCalledTimes(1);
    expect(onLinkClick).toHaveBeenCalledWith("?node=read-only");
    expect(openSpy).toHaveBeenCalledWith(
      "?node=editable",
      "_blank",
      "noopener,noreferrer",
    );
    expect(editableClickEvent.defaultPrevented).toBe(true);
    openSpy.mockRestore();
  });

  it("should call onLinkClick when the read-only click target is link text", () => {
    const onLinkClick = vi.fn();
    render(
      <TiptapEditor
        content={null}
        editable={false}
        onLinkClick={onLinkClick}
      />,
    );

    const editorContent = screen.getByTestId("editor-content");
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "?node=text-target");
    anchor.appendChild(document.createTextNode("Text target link"));
    editorContent.appendChild(anchor);

    const textNode = anchor.firstChild;
    expect(textNode).not.toBeNull();

    const nativeEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    textNode!.dispatchEvent(nativeEvent);

    expect(nativeEvent.defaultPrevented).toBe(true);
    expect(onLinkClick).toHaveBeenCalledTimes(1);
    expect(onLinkClick).toHaveBeenCalledWith("?node=text-target");
  });

  it("should not call onLinkClick for plain clicks outside anchors", () => {
    const onLinkClick = vi.fn();
    render(<TiptapEditor content={null} onLinkClick={onLinkClick} />);
    const editorContent = screen.getByTestId("editor-content");
    fireEvent.click(editorContent);
    expect(onLinkClick).not.toHaveBeenCalled();
  });

  it("should not have ai-attribution-visible class by default", () => {
    render(<TiptapEditor content={null} />);
    expect(screen.getByTestId("tiptap-editor")).not.toHaveClass(
      "ai-attribution-visible",
    );
  });

  it("should add ai-attribution-visible class when attribution toggle is activated", () => {
    render(<TiptapEditor content={null} />);
    fireEvent.click(screen.getByTitle("aiAttribution"));
    expect(screen.getByTestId("tiptap-editor")).toHaveClass(
      "ai-attribution-visible",
    );
  });

  it("should toggle ai-attribution-visible class off when clicked again", () => {
    render(<TiptapEditor content={null} />);
    const attributionBtn = screen.getByTitle("aiAttribution");
    fireEvent.click(attributionBtn);
    fireEvent.click(attributionBtn);
    expect(screen.getByTestId("tiptap-editor")).not.toHaveClass(
      "ai-attribution-visible",
    );
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
    savedContent,
  }: {
    nodeId: string | null;
    content: Record<string, unknown> | null;
    onSave: (nodeId: string, content: Record<string, unknown>) => Promise<void>;
    debounceMs?: number;
    savedContent?: Record<string, unknown> | null;
  }) {
    const { status, markSaved, flush } = useAutoSave({
      nodeId,
      content,
      onSave,
      debounceMs,
    });

    return (
      <>
        <div data-testid="status">{status}</div>
        <button
          type="button"
          data-testid="mark-saved"
          onClick={() => markSaved(savedContent ?? content)}
        >
          Mark saved
        </button>
        <button
          type="button"
          data-testid="flush-save"
          onClick={() => {
            void flush();
          }}
        >
          Flush save
        </button>
      </>
    );
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

  it("should flush a pending save immediately", async () => {
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

    await act(async () => {
      fireEvent.click(screen.getByTestId("flush-save"));
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith("node-1", content);

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
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

  it("should not save restored content after markSaved is called", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const restoredContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Restored note" }],
        },
      ],
    };

    const { rerender } = render(
      <TestComponent
        nodeId="node-1"
        content={null}
        onSave={onSave}
        debounceMs={100}
        savedContent={restoredContent}
      />,
    );

    rerender(
      <TestComponent
        nodeId="node-1"
        content={restoredContent}
        onSave={onSave}
        debounceMs={100}
        savedContent={restoredContent}
      />,
    );

    fireEvent.click(screen.getByTestId("mark-saved"));

    rerender(
      <TestComponent
        nodeId="node-1"
        content={restoredContent}
        onSave={onSave}
        debounceMs={100}
        savedContent={restoredContent}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(onSave).not.toHaveBeenCalled();
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
      expect(defaultProps.onUploadComplete).toHaveBeenCalledWith(
        "attachment-1",
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
