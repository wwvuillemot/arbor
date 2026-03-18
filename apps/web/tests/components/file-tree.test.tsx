import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { FileTree } from "@/components/file-tree/file-tree";
import {
  FileTreeNode,
  type TreeNode,
} from "@/components/file-tree/file-tree-node";
import { CreateNodeDialog } from "@/components/file-tree/create-node-dialog";
import { RenameDialog } from "@/components/file-tree/rename-dialog";
import { NodeContextMenu } from "@/components/file-tree/context-menu";

type FileTreeTrpcState = {
  favorites: TreeNode[];
  nodesById: Map<string, TreeNode>;
  childrenByParent: Map<string, TreeNode[]>;
};

const {
  mockFavoritesUseQuery,
  mockNodeByIdUseQuery,
  mockChildrenUseQuery,
  mockDescendantsUseQuery,
  fileTreeTrpcState,
} = vi.hoisted(() => ({
  mockFavoritesUseQuery: vi.fn(),
  mockNodeByIdUseQuery: vi.fn(),
  mockChildrenUseQuery: vi.fn(),
  mockDescendantsUseQuery: vi.fn(),
  fileTreeTrpcState: {
    favorites: [],
    nodesById: new Map(),
    childrenByParent: new Map(),
  } as FileTreeTrpcState,
}));

// Mock next-intl (already mocked in setup.ts, but be explicit)
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    nodes: {
      getFavorites: { useQuery: mockFavoritesUseQuery },
      getById: { useQuery: mockNodeByIdUseQuery },
      getChildren: { useQuery: mockChildrenUseQuery },
      getDescendants: { useQuery: mockDescendantsUseQuery },
    },
  },
}));

function makeNode(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: "node-1",
    name: "Test Node",
    type: "folder",
    parentId: null,
    position: 0,
    content: null,
    metadata: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("FileTree", () => {
  const favoriteNode = makeNode({
    id: "favorite-1",
    name: "Favorite Node",
    type: "note",
    parentId: "project-1",
    metadata: { isFavorite: true },
  });
  const recentCandidateNodes = [
    makeNode({
      id: "note-1",
      name: "Alpha Note",
      type: "note",
      parentId: "project-1",
    }),
    makeNode({
      id: "note-2",
      name: "Bravo Note",
      type: "note",
      parentId: "project-1",
    }),
    makeNode({
      id: "note-3",
      name: "Charlie Note",
      type: "note",
      parentId: "project-1",
    }),
    makeNode({
      id: "note-4",
      name: "Delta Note",
      type: "note",
      parentId: "project-1",
    }),
    makeNode({
      id: "note-5",
      name: "Echo Note",
      type: "note",
      parentId: "project-1",
    }),
    makeNode({
      id: "note-6",
      name: "Foxtrot Note",
      type: "note",
      parentId: "project-1",
    }),
  ];

  const onSelectNode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    fileTreeTrpcState.favorites = [favoriteNode];
    fileTreeTrpcState.childrenByParent = new Map([
      ["project-1", recentCandidateNodes],
    ]);
    fileTreeTrpcState.nodesById = new Map(
      [favoriteNode, ...recentCandidateNodes].map((node) => [node.id, node]),
    );

    mockFavoritesUseQuery.mockImplementation(() => ({
      data: fileTreeTrpcState.favorites,
      isLoading: false,
      error: null,
    }));
    mockNodeByIdUseQuery.mockImplementation(({ id }: { id?: string }) => ({
      data: id ? (fileTreeTrpcState.nodesById.get(id) ?? null) : null,
      isLoading: false,
      error: null,
    }));
    mockChildrenUseQuery.mockImplementation(
      ({ parentId }: { parentId: string }) => ({
        data: fileTreeTrpcState.childrenByParent.get(parentId) ?? [],
        isLoading: false,
        error: null,
      }),
    );
    mockDescendantsUseQuery.mockImplementation(() => ({
      data: [],
      isLoading: false,
      error: null,
    }));
  });

  function renderFileTree(
    props: Partial<React.ComponentProps<typeof FileTree>> = {},
  ) {
    return render(
      <FileTree
        projectId="project-1"
        selectedNodeId={null}
        onSelectNode={onSelectNode}
        onContextMenu={vi.fn()}
        onCreateFolder={vi.fn()}
        onCreateNote={vi.fn()}
        onToggleFavorite={vi.fn()}
        {...props}
      />,
    );
  }

  it("renders Recents above Favorites and only keeps the last five clicked nodes", () => {
    renderFileTree();

    const recentsButton = screen.getByRole("button", {
      name: "recents.section",
    });
    const favoritesButton = screen.getByRole("button", {
      name: "favorites.section",
    });
    expect(
      recentsButton.compareDocumentPosition(favoritesButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getAllByText("Alpha Note")[0]);
    fireEvent.click(screen.getByText("Bravo Note"));
    fireEvent.click(screen.getByText("Charlie Note"));
    fireEvent.click(screen.getByText("Delta Note"));
    fireEvent.click(screen.getByText("Echo Note"));
    fireEvent.click(screen.getByText("Foxtrot Note"));

    const recentsPanel = screen.getByTestId("file-tree-recents-panel");
    expect(
      within(recentsPanel).queryByText("Alpha Note"),
    ).not.toBeInTheDocument();

    const recentTreeItems = within(recentsPanel).getAllByRole("treeitem");
    expect(recentTreeItems).toHaveLength(5);
    expect(recentTreeItems.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Foxtrot Note"),
      expect.stringContaining("Echo Note"),
      expect.stringContaining("Delta Note"),
      expect.stringContaining("Charlie Note"),
      expect.stringContaining("Bravo Note"),
    ]);
  });

  it("moves an already-clicked node to the top of Recents without duplicating it", () => {
    renderFileTree();

    fireEvent.click(screen.getAllByText("Alpha Note")[0]);
    fireEvent.click(screen.getByText("Bravo Note"));
    fireEvent.click(screen.getByText("Charlie Note"));
    fireEvent.click(screen.getAllByText("Alpha Note")[0]);

    const recentTreeItems = within(
      screen.getByTestId("file-tree-recents-panel"),
    ).getAllByRole("treeitem");
    expect(recentTreeItems).toHaveLength(3);
    expect(recentTreeItems.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Alpha Note"),
      expect.stringContaining("Charlie Note"),
      expect.stringContaining("Bravo Note"),
    ]);
  });

  it("keeps the pinned-section separator visible when Favorites is collapsed", () => {
    renderFileTree();

    fireEvent.click(screen.getByRole("button", { name: "favorites.section" }));

    expect(
      screen.getByTestId("file-tree-pinned-separator"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("file-tree-favorites-panel"),
    ).not.toBeInTheDocument();
  });

  it("does not add folders to Recents", () => {
    const folderNode = makeNode({
      id: "folder-1",
      name: "Reference Folder",
      type: "folder",
      parentId: "project-1",
    });

    fileTreeTrpcState.childrenByParent = new Map([
      ["project-1", [folderNode, ...recentCandidateNodes]],
    ]);
    fileTreeTrpcState.nodesById = new Map(
      [favoriteNode, folderNode, ...recentCandidateNodes].map((node) => [
        node.id,
        node,
      ]),
    );

    renderFileTree();

    fireEvent.click(screen.getByText("Reference Folder"));

    const recentsPanel = screen.getByTestId("file-tree-recents-panel");
    expect(
      within(recentsPanel).queryByText("Reference Folder"),
    ).not.toBeInTheDocument();
    expect(within(recentsPanel).getByText("recents.empty")).toBeInTheDocument();
  });

  it("switches between alphabetical and manual sort order", () => {
    const manualSortNodes = [
      makeNode({
        id: "manual-1",
        name: "Zulu Note",
        type: "note",
        parentId: "project-1",
        position: 2,
      }),
      makeNode({
        id: "manual-2",
        name: "Alpha Note",
        type: "note",
        parentId: "project-1",
        position: 1,
      }),
      makeNode({
        id: "manual-3",
        name: "Beta Note",
        type: "note",
        parentId: "project-1",
        position: 0,
      }),
    ];

    fileTreeTrpcState.favorites = [];
    fileTreeTrpcState.childrenByParent = new Map([
      ["project-1", manualSortNodes],
    ]);
    fileTreeTrpcState.nodesById = new Map(
      manualSortNodes.map((node) => [node.id, node]),
    );

    renderFileTree({ onToggleFavorite: undefined });

    expect(
      screen.getAllByRole("treeitem").map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining("Alpha Note"),
      expect.stringContaining("Beta Note"),
      expect.stringContaining("Zulu Note"),
    ]);

    fireEvent.click(screen.getByTestId("file-tree-sort-manual"));

    expect(
      screen.getAllByRole("treeitem").map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining("Beta Note"),
      expect.stringContaining("Alpha Note"),
      expect.stringContaining("Zulu Note"),
    ]);
  });

  it("restores expanded folders from localStorage after remount", () => {
    const folderNode = makeNode({
      id: "folder-1",
      name: "Outline",
      type: "folder",
      parentId: "project-1",
    });
    const nestedNote = makeNode({
      id: "nested-note-1",
      name: "Nested Note",
      type: "note",
      parentId: "folder-1",
    });

    fileTreeTrpcState.favorites = [];
    fileTreeTrpcState.childrenByParent = new Map([
      ["project-1", [folderNode]],
      ["folder-1", [nestedNote]],
    ]);
    fileTreeTrpcState.nodesById = new Map(
      [folderNode, nestedNote].map((node) => [node.id, node]),
    );

    const firstRender = renderFileTree({ onToggleFavorite: undefined });

    fireEvent.click(screen.getByTestId("tree-node-toggle-folder-1"));

    expect(screen.getByText("Nested Note")).toBeInTheDocument();
    expect(
      JSON.parse(
        window.localStorage.getItem("arbor:fileTreeExpandedNodes:project-1") ??
          "[]",
      ),
    ).toEqual(expect.arrayContaining(["project-1", "folder-1"]));

    firstRender.unmount();
    renderFileTree({ onToggleFavorite: undefined });

    expect(screen.getByText("Nested Note")).toBeInTheDocument();
  });
});

describe("FileTreeNode", () => {
  const defaultProps = {
    node: makeNode(),
    depth: 0,
    isExpanded: false,
    isSelected: false,
    onToggle: vi.fn(),
    onSelect: vi.fn(),
    onContextMenu: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render node name", () => {
    render(<FileTreeNode {...defaultProps} />);
    expect(screen.getByText("Test Node")).toBeInTheDocument();
  });

  it("should render with treeitem role", () => {
    render(<FileTreeNode {...defaultProps} />);
    expect(screen.getByRole("treeitem")).toBeInTheDocument();
  });

  it("should show expanded state via aria-expanded", () => {
    render(<FileTreeNode {...defaultProps} isExpanded={true} />);
    expect(screen.getByRole("treeitem")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("should show collapsed state via aria-expanded", () => {
    render(<FileTreeNode {...defaultProps} isExpanded={false} />);
    expect(screen.getByRole("treeitem")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("should show selected state via aria-selected", () => {
    render(<FileTreeNode {...defaultProps} isSelected={true} />);
    expect(screen.getByRole("treeitem")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("should not have aria-expanded for non-expandable types", () => {
    const noteNode = makeNode({ type: "note" });
    render(<FileTreeNode {...defaultProps} node={noteNode} />);
    expect(screen.getByRole("treeitem")).not.toHaveAttribute("aria-expanded");
  });

  it("should call only onSelect when a folder row is clicked", () => {
    render(<FileTreeNode {...defaultProps} />);
    fireEvent.click(screen.getByRole("treeitem"));
    expect(defaultProps.onToggle).not.toHaveBeenCalled();
    expect(defaultProps.onSelect).toHaveBeenCalledWith("node-1");
  });

  it("should call only onToggle when a folder chevron is clicked", () => {
    render(<FileTreeNode {...defaultProps} />);

    fireEvent.click(screen.getByTestId("tree-node-toggle-node-1"));

    expect(defaultProps.onToggle).toHaveBeenCalledWith("node-1");
    expect(defaultProps.onSelect).not.toHaveBeenCalled();
  });

  it("should call only onSelect when note is clicked (not onToggle)", () => {
    const noteNode = makeNode({ type: "note", id: "note-1" });
    const onToggle = vi.fn();
    const onSelect = vi.fn();
    render(
      <FileTreeNode
        {...defaultProps}
        node={noteNode}
        onToggle={onToggle}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("treeitem"));
    expect(onToggle).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("note-1");
  });

  it("should call onContextMenu on right-click", () => {
    render(<FileTreeNode {...defaultProps} />);
    fireEvent.contextMenu(screen.getByRole("treeitem"));
    expect(defaultProps.onContextMenu).toHaveBeenCalled();
  });

  it("should handle Enter key", () => {
    render(<FileTreeNode {...defaultProps} />);
    fireEvent.keyDown(screen.getByRole("treeitem"), { key: "Enter" });
    expect(defaultProps.onToggle).not.toHaveBeenCalled();
    expect(defaultProps.onSelect).toHaveBeenCalledWith("node-1");
  });

  it("should handle ArrowRight to expand collapsed folder", () => {
    render(<FileTreeNode {...defaultProps} isExpanded={false} />);
    fireEvent.keyDown(screen.getByRole("treeitem"), { key: "ArrowRight" });
    expect(defaultProps.onToggle).toHaveBeenCalledWith("node-1");
  });

  it("should handle ArrowLeft to collapse expanded folder", () => {
    render(<FileTreeNode {...defaultProps} isExpanded={true} />);
    fireEvent.keyDown(screen.getByRole("treeitem"), { key: "ArrowLeft" });
    expect(defaultProps.onToggle).toHaveBeenCalledWith("node-1");
  });

  it("should render children when expanded with renderChildren", () => {
    const renderChildren = vi.fn(() => (
      <div data-testid="children">Child content</div>
    ));
    render(
      <FileTreeNode
        {...defaultProps}
        isExpanded={true}
        renderChildren={renderChildren}
      />,
    );
    expect(screen.getByTestId("children")).toBeInTheDocument();
    expect(renderChildren).toHaveBeenCalledWith("node-1", 1);
  });

  it("should not render children when collapsed", () => {
    const renderChildren = vi.fn(() => (
      <div data-testid="children">Child content</div>
    ));
    render(
      <FileTreeNode
        {...defaultProps}
        isExpanded={false}
        renderChildren={renderChildren}
      />,
    );
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
  });

  it("should indent based on depth", () => {
    render(<FileTreeNode {...defaultProps} depth={3} />);
    const treeitem = screen.getByRole("treeitem");
    expect(treeitem.style.paddingLeft).toBe("56px"); // 3 * 16 + 8
  });

  // Inline editing tests
  it("should enter edit mode on double-click when onRename is provided", () => {
    const onRename = vi.fn();
    render(<FileTreeNode {...defaultProps} onRename={onRename} />);
    fireEvent.doubleClick(screen.getByText("Test Node"));
    expect(screen.getByTestId("tree-node-edit-node-1")).toBeInTheDocument();
  });

  it("should not enter edit mode on double-click when the node is locked", () => {
    const onRename = vi.fn();
    const lockedNode = makeNode({ metadata: { isLocked: true } });

    render(
      <FileTreeNode {...defaultProps} node={lockedNode} onRename={onRename} />,
    );

    fireEvent.doubleClick(screen.getByText("Test Node"));

    expect(
      screen.queryByTestId("tree-node-edit-node-1"),
    ).not.toBeInTheDocument();
  });

  it("should render a lock indicator for locked nodes", () => {
    const lockedNode = makeNode({ metadata: { isLocked: true } });

    render(<FileTreeNode {...defaultProps} node={lockedNode} />);

    expect(screen.getByTestId("tree-node-lock-node-1")).toBeInTheDocument();
  });

  it("should not render a lock indicator for unlocked nodes", () => {
    render(<FileTreeNode {...defaultProps} />);

    expect(
      screen.queryByTestId("tree-node-lock-node-1"),
    ).not.toBeInTheDocument();
  });

  it("should not enter edit mode on double-click when onRename is not provided", () => {
    render(<FileTreeNode {...defaultProps} />);
    fireEvent.doubleClick(screen.getByText("Test Node"));
    expect(
      screen.queryByTestId("tree-node-edit-node-1"),
    ).not.toBeInTheDocument();
  });

  it("should populate edit input with current node name", () => {
    const onRename = vi.fn();
    render(<FileTreeNode {...defaultProps} onRename={onRename} />);
    fireEvent.doubleClick(screen.getByText("Test Node"));
    const input = screen.getByTestId(
      "tree-node-edit-node-1",
    ) as HTMLInputElement;
    expect(input.value).toBe("Test Node");
  });

  it("should call onRename and exit edit mode on Enter", () => {
    const onRename = vi.fn();
    render(<FileTreeNode {...defaultProps} onRename={onRename} />);
    fireEvent.doubleClick(screen.getByText("Test Node"));
    const input = screen.getByTestId("tree-node-edit-node-1");
    fireEvent.change(input, { target: { value: "Renamed Node" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("node-1", "Renamed Node");
    expect(
      screen.queryByTestId("tree-node-edit-node-1"),
    ).not.toBeInTheDocument();
  });

  it("should cancel editing on Escape without calling onRename", () => {
    const onRename = vi.fn();
    render(<FileTreeNode {...defaultProps} onRename={onRename} />);
    fireEvent.doubleClick(screen.getByText("Test Node"));
    const input = screen.getByTestId("tree-node-edit-node-1");
    fireEvent.change(input, { target: { value: "Something Else" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onRename).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("tree-node-edit-node-1"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Test Node")).toBeInTheDocument();
  });

  it("should save on blur", () => {
    const onRename = vi.fn();
    render(<FileTreeNode {...defaultProps} onRename={onRename} />);
    fireEvent.doubleClick(screen.getByText("Test Node"));
    const input = screen.getByTestId("tree-node-edit-node-1");
    fireEvent.change(input, { target: { value: "Blur Rename" } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith("node-1", "Blur Rename");
  });

  it("should not call onRename if name is unchanged", () => {
    const onRename = vi.fn();
    render(<FileTreeNode {...defaultProps} onRename={onRename} />);
    fireEvent.doubleClick(screen.getByText("Test Node"));
    const input = screen.getByTestId("tree-node-edit-node-1");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).not.toHaveBeenCalled();
  });

  it("should not call onRename if name is empty", () => {
    const onRename = vi.fn();
    render(<FileTreeNode {...defaultProps} onRename={onRename} />);
    fireEvent.doubleClick(screen.getByText("Test Node"));
    const input = screen.getByTestId("tree-node-edit-node-1");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).not.toHaveBeenCalled();
  });

  it("should not call onRename if the node becomes locked before save", () => {
    const onRename = vi.fn();
    const { rerender } = render(
      <FileTreeNode {...defaultProps} onRename={onRename} />,
    );

    fireEvent.doubleClick(screen.getByText("Test Node"));
    const input = screen.getByTestId("tree-node-edit-node-1");
    fireEvent.change(input, { target: { value: "Blocked Rename" } });

    rerender(
      <FileTreeNode
        {...defaultProps}
        onRename={onRename}
        node={makeNode({ metadata: { isLocked: true } })}
      />,
    );

    fireEvent.blur(screen.getByTestId("tree-node-edit-node-1"));

    expect(onRename).not.toHaveBeenCalled();
  });

  it("should not toggle or select when clicking during edit mode", () => {
    const onRename = vi.fn();
    const onToggle = vi.fn();
    const onSelect = vi.fn();
    render(
      <FileTreeNode
        {...defaultProps}
        onRename={onRename}
        onToggle={onToggle}
        onSelect={onSelect}
      />,
    );
    fireEvent.doubleClick(screen.getByText("Test Node"));
    // Clear mocks from the initial interactions
    onToggle.mockClear();
    onSelect.mockClear();
    // Click the treeitem while in edit mode
    fireEvent.click(screen.getByRole("treeitem"));
    expect(onToggle).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("CreateNodeDialog", () => {
  const defaultProps = {
    open: true,
    nodeType: "folder" as const,
    parentId: "parent-1",
    isCreating: false,
    onClose: vi.fn(),
    onCreate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when closed", () => {
    render(<CreateNodeDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should render dialog when open", () => {
    render(<CreateNodeDialog {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("should render folder creation translations", () => {
    render(<CreateNodeDialog {...defaultProps} nodeType="folder" />);
    // useTranslations mock returns the key, so we check for the key
    expect(screen.getByText("fileTree.createFolder.title")).toBeInTheDocument();
  });

  it("should render note creation translations", () => {
    render(<CreateNodeDialog {...defaultProps} nodeType="note" />);
    expect(screen.getByText("fileTree.createNote.title")).toBeInTheDocument();
  });

  it("should call onCreate with name, type, and parentId on submit", () => {
    render(<CreateNodeDialog {...defaultProps} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "New Folder" } });
    fireEvent.submit(input.closest("form")!);
    expect(defaultProps.onCreate).toHaveBeenCalledWith(
      "New Folder",
      "folder",
      "parent-1",
    );
  });

  it("should not call onCreate with empty name", () => {
    render(<CreateNodeDialog {...defaultProps} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);
    expect(defaultProps.onCreate).not.toHaveBeenCalled();
  });

  it("should call onClose when backdrop is clicked", () => {
    render(<CreateNodeDialog {...defaultProps} />);
    // backdrop has aria-hidden="true"
    const backdrop = document.querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop!);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should disable submit button when isCreating", () => {
    render(<CreateNodeDialog {...defaultProps} isCreating={true} />);
    const submitButton = screen.getByRole("button", { name: /creating/i });
    expect(submitButton).toBeDisabled();
  });

  it("should disable submit button when name is empty", () => {
    render(<CreateNodeDialog {...defaultProps} />);
    // The create button should be disabled by default (empty name)
    const buttons = screen.getAllByRole("button");
    const submitButton = buttons.find(
      (b) => b.getAttribute("type") === "submit",
    );
    expect(submitButton).toBeDisabled();
  });
});

describe("RenameDialog", () => {
  const defaultProps = {
    open: true,
    currentName: "Old Name",
    nodeId: "node-1",
    isSaving: false,
    onClose: vi.fn(),
    onRename: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when closed", () => {
    render(<RenameDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should render dialog when open", () => {
    render(<RenameDialog {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("should populate input with current name", () => {
    render(<RenameDialog {...defaultProps} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Old Name");
  });

  it("should call onRename with nodeId and new name on submit", () => {
    render(<RenameDialog {...defaultProps} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.submit(input.closest("form")!);
    expect(defaultProps.onRename).toHaveBeenCalledWith("node-1", "New Name");
  });

  it("should not call onRename when name is unchanged", () => {
    render(<RenameDialog {...defaultProps} />);
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(defaultProps.onRename).not.toHaveBeenCalled();
  });

  it("should not call onRename with empty name", () => {
    render(<RenameDialog {...defaultProps} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.submit(input.closest("form")!);
    expect(defaultProps.onRename).not.toHaveBeenCalled();
  });

  it("should call onClose when backdrop is clicked", () => {
    render(<RenameDialog {...defaultProps} />);
    const backdrop = document.querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop!);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should disable submit button when saving", () => {
    render(<RenameDialog {...defaultProps} isSaving={true} />);
    const submitButton = screen.getByRole("button", { name: /saving/i });
    expect(submitButton).toBeDisabled();
  });
});

describe("NodeContextMenu", () => {
  const folderNode = makeNode({
    id: "folder-1",
    type: "folder",
    name: "My Folder",
  });
  const noteNode = makeNode({ id: "note-1", type: "note", name: "My Note" });

  const defaultProps = {
    open: true,
    position: { x: 100, y: 200 },
    node: folderNode,
    onClose: vi.fn(),
    onAction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when closed", () => {
    render(<NodeContextMenu {...defaultProps} open={false} />);
    expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
  });

  it("should not render when node is null", () => {
    render(<NodeContextMenu {...defaultProps} node={null} />);
    expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
  });

  it("should render menu when open with node", () => {
    render(<NodeContextMenu {...defaultProps} />);
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
  });

  it("should show New Folder, New Note, Rename, Delete for folders", () => {
    render(<NodeContextMenu {...defaultProps} node={folderNode} />);
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems).toHaveLength(8);
    expect(screen.getByText("tagNode")).toBeInTheDocument();
    expect(screen.getByText("newFolder")).toBeInTheDocument();
    expect(screen.getByText("newNote")).toBeInTheDocument();
    expect(screen.getByText("settings")).toBeInTheDocument();
    expect(screen.getByText("rename")).toBeInTheDocument();
    expect(screen.getByText("export")).toBeInTheDocument();
    expect(screen.getByText("lock")).toBeInTheDocument();
    expect(screen.getByText("delete")).toBeInTheDocument();
  });

  it("should show Settings, Rename, Lock, and Delete for notes", () => {
    render(<NodeContextMenu {...defaultProps} node={noteNode} />);
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems).toHaveLength(6);
    expect(screen.getByText("tagNode")).toBeInTheDocument();
    expect(screen.getByText("settings")).toBeInTheDocument();
    expect(screen.getByText("rename")).toBeInTheDocument();
    expect(screen.getByText("export")).toBeInTheDocument();
    expect(screen.getByText("lock")).toBeInTheDocument();
    expect(screen.getByText("delete")).toBeInTheDocument();
    expect(screen.queryByText("newFolder")).not.toBeInTheDocument();
    expect(screen.queryByText("newNote")).not.toBeInTheDocument();
  });

  it("should call onAction with settings action for notes", () => {
    render(<NodeContextMenu {...defaultProps} node={noteNode} />);
    fireEvent.click(screen.getByText("settings"));
    expect(defaultProps.onAction).toHaveBeenCalledWith({
      type: "settings",
      node: noteNode,
    });
  });

  it("should show unlock for locked nodes", () => {
    const lockedNoteNode = makeNode({
      id: "locked-note-1",
      type: "note",
      name: "Locked Note",
      metadata: { isLocked: true },
    });

    render(<NodeContextMenu {...defaultProps} node={lockedNoteNode} />);

    expect(screen.getByText("unlock")).toBeInTheDocument();
    expect(screen.queryByText("lock")).not.toBeInTheDocument();
  });

  it("should call onAction and onClose when menu item is clicked", () => {
    render(<NodeContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText("rename"));
    expect(defaultProps.onAction).toHaveBeenCalledWith({
      type: "rename",
      node: folderNode,
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should call onAction with newFolder action", () => {
    render(<NodeContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText("newFolder"));
    expect(defaultProps.onAction).toHaveBeenCalledWith({
      type: "newFolder",
      node: folderNode,
    });
  });

  it("should call onAction with settings action for folders", () => {
    render(<NodeContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText("settings"));
    expect(defaultProps.onAction).toHaveBeenCalledWith({
      type: "settings",
      node: folderNode,
    });
  });

  it("should call onAction with delete action", () => {
    render(<NodeContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText("delete"));
    expect(defaultProps.onAction).toHaveBeenCalledWith({
      type: "delete",
      node: folderNode,
    });
  });

  it("should call onAction with toggleLock action", () => {
    render(<NodeContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText("lock"));
    expect(defaultProps.onAction).toHaveBeenCalledWith({
      type: "toggleLock",
      node: folderNode,
    });
  });

  it("should position at specified coordinates", () => {
    render(<NodeContextMenu {...defaultProps} />);
    const menu = screen.getByTestId("context-menu");
    expect(menu.style.left).toBe("100px");
    expect(menu.style.top).toBe("200px");
  });

  it("should close on Escape key", () => {
    render(<NodeContextMenu {...defaultProps} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});

describe("FileTreeNode - Drag and Drop", () => {
  const defaultProps = {
    node: makeNode(),
    depth: 0,
    isExpanded: false,
    isSelected: false,
    onToggle: vi.fn(),
    onSelect: vi.fn(),
    onContextMenu: vi.fn(),
    onDrop: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should make non-project nodes draggable", () => {
    const noteNode = makeNode({ type: "note", id: "note-1" });
    render(<FileTreeNode {...defaultProps} node={noteNode} />);
    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toHaveAttribute("draggable", "true");
  });

  it("should not make project nodes draggable", () => {
    const projectNode = makeNode({ type: "project", id: "project-1" });
    render(<FileTreeNode {...defaultProps} node={projectNode} />);
    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toHaveAttribute("draggable", "false");
  });

  it("should not make locked nodes draggable", () => {
    const lockedNode = makeNode({
      type: "note",
      id: "locked-note-1",
      metadata: { isLocked: true },
    });

    render(<FileTreeNode {...defaultProps} node={lockedNode} />);

    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toHaveAttribute("draggable", "false");
  });

  it("should set node id in dataTransfer on dragStart", () => {
    const noteNode = makeNode({ type: "note", id: "note-1" });
    render(<FileTreeNode {...defaultProps} node={noteNode} />);
    const treeitem = screen.getByRole("treeitem");
    const setData = vi.fn();
    const dataTransfer = {
      setData,
      effectAllowed: "",
    };
    fireEvent.dragStart(treeitem, { dataTransfer });
    expect(setData).toHaveBeenCalledWith("application/arbor-node-id", "note-1");
  });

  it("should prevent dragStart for project nodes", () => {
    const projectNode = makeNode({ type: "project", id: "project-1" });
    render(<FileTreeNode {...defaultProps} node={projectNode} />);
    const treeitem = screen.getByRole("treeitem");
    const setData = vi.fn();
    fireEvent.dragStart(treeitem, {
      dataTransfer: { setData, effectAllowed: "" },
    });
    // setData should NOT be called because the handler prevents drag for projects
    expect(setData).not.toHaveBeenCalled();
  });

  it("should prevent dragStart for locked nodes", () => {
    const lockedNode = makeNode({
      type: "note",
      id: "locked-note-1",
      metadata: { isLocked: true },
    });

    render(<FileTreeNode {...defaultProps} node={lockedNode} />);

    const treeitem = screen.getByRole("treeitem");
    const setData = vi.fn();

    fireEvent.dragStart(treeitem, {
      dataTransfer: { setData, effectAllowed: "" },
    });

    expect(setData).not.toHaveBeenCalled();
  });

  it("should show drop indicator on dragOver", () => {
    render(<FileTreeNode {...defaultProps} />);
    const treeitem = screen.getByRole("treeitem");
    // Simulate dragOver in middle of element (should show 'inside' for folders)
    fireEvent.dragOver(treeitem, {
      clientY: 50,
      dataTransfer: {
        types: ["application/arbor-node-id"],
        dropEffect: "",
      },
    });
    // The "inside" indicator adds a ring-primary/40 class to the element
    expect(treeitem.className).toContain("ring-primary/40");
  });

  it("should clear drop indicator on dragLeave", () => {
    render(<FileTreeNode {...defaultProps} />);
    const treeitem = screen.getByRole("treeitem");
    // First dragOver to set indicator
    fireEvent.dragOver(treeitem, {
      clientY: 50,
      dataTransfer: {
        types: ["application/arbor-node-id"],
        dropEffect: "",
      },
    });
    // Then dragLeave with relatedTarget outside
    fireEvent.dragLeave(treeitem, {
      relatedTarget: document.body,
    });
    expect(treeitem.className).not.toContain("ring-primary/40");
  });

  it("should call onDrop with node IDs and position when dropped", () => {
    render(<FileTreeNode {...defaultProps} />);
    const treeitem = screen.getByRole("treeitem");
    fireEvent.drop(treeitem, {
      dataTransfer: {
        getData: (type: string) =>
          type === "application/arbor-node-id" ? "dragged-id" : "",
      },
      clientY: 50,
    });
    expect(defaultProps.onDrop).toHaveBeenCalledWith(
      "dragged-id",
      "node-1",
      expect.any(String),
    );
  });

  it("should not call onDrop when dropping node on itself", () => {
    render(<FileTreeNode {...defaultProps} />);
    const treeitem = screen.getByRole("treeitem");
    fireEvent.drop(treeitem, {
      dataTransfer: {
        getData: (type: string) =>
          type === "application/arbor-node-id" ? "node-1" : "",
      },
      clientY: 50,
    });
    expect(defaultProps.onDrop).not.toHaveBeenCalled();
  });

  it("should not call onDrop when no draggedNodeId in dataTransfer", () => {
    render(<FileTreeNode {...defaultProps} />);
    const treeitem = screen.getByRole("treeitem");
    fireEvent.drop(treeitem, {
      dataTransfer: {
        getData: () => "",
      },
      clientY: 50,
    });
    expect(defaultProps.onDrop).not.toHaveBeenCalled();
  });

  it("should not call onDrop when the target node is locked", () => {
    const lockedNode = makeNode({ metadata: { isLocked: true } });

    render(<FileTreeNode {...defaultProps} node={lockedNode} />);

    const treeitem = screen.getByRole("treeitem");

    fireEvent.drop(treeitem, {
      dataTransfer: {
        getData: (type: string) =>
          type === "application/arbor-node-id" ? "dragged-id" : "",
      },
      clientY: 50,
    });

    expect(defaultProps.onDrop).not.toHaveBeenCalled();
  });

  it("should set opacity to 0.5 on dragStart", () => {
    const noteNode = makeNode({ type: "note", id: "note-1" });
    render(<FileTreeNode {...defaultProps} node={noteNode} />);
    const treeitem = screen.getByRole("treeitem");
    fireEvent.dragStart(treeitem, {
      target: treeitem,
      dataTransfer: { setData: vi.fn(), effectAllowed: "" },
    });
    expect(treeitem.style.opacity).toBe("0.5");
  });

  it("should restore opacity on dragEnd", () => {
    const noteNode = makeNode({ type: "note", id: "note-1" });
    render(<FileTreeNode {...defaultProps} node={noteNode} />);
    const treeitem = screen.getByRole("treeitem");
    fireEvent.dragStart(treeitem, {
      target: treeitem,
      dataTransfer: { setData: vi.fn(), effectAllowed: "" },
    });
    fireEvent.dragEnd(treeitem, { target: treeitem });
    expect(treeitem.style.opacity).toBe("1");
  });
});

describe("FileTreeNode - LLM Attribution Badges", () => {
  const defaultProps = {
    node: makeNode(),
    depth: 0,
    isExpanded: false,
    isSelected: false,
    onToggle: vi.fn(),
    onSelect: vi.fn(),
    onContextMenu: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show sparkle badge when updatedBy is llm", () => {
    const llmNode = makeNode({
      id: "llm-node",
      updatedBy: "llm:gpt-4o",
    });
    render(<FileTreeNode {...defaultProps} node={llmNode} />);
    const badge = screen.getByTestId("tree-node-attribution-llm-node");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("✨");
  });

  it("should not show badge when updatedBy is user", () => {
    const userNode = makeNode({
      id: "user-node",
      updatedBy: "user:alice",
    });
    render(<FileTreeNode {...defaultProps} node={userNode} />);
    expect(
      screen.queryByTestId("tree-node-attribution-user-node"),
    ).not.toBeInTheDocument();
  });

  it("should not show badge when updatedBy is undefined", () => {
    const plainNode = makeNode({ id: "plain-node" });
    render(<FileTreeNode {...defaultProps} node={plainNode} />);
    expect(
      screen.queryByTestId("tree-node-attribution-plain-node"),
    ).not.toBeInTheDocument();
  });

  it("should display model name in tooltip", () => {
    const llmNode = makeNode({
      id: "tip-node",
      updatedBy: "llm:claude-3",
    });
    render(<FileTreeNode {...defaultProps} node={llmNode} />);
    const tooltip = screen.getByTestId(
      "tree-node-attribution-tooltip-tip-node",
    );
    expect(tooltip.textContent).toContain("claude-3");
  });

  it("should include timestamp in tooltip when updatedAt is present", () => {
    const llmNode = makeNode({
      id: "time-node",
      updatedBy: "llm:gpt-4o",
      updatedAt: "2024-06-15T12:00:00Z",
    });
    render(<FileTreeNode {...defaultProps} node={llmNode} />);
    const timeEl = screen.getByTestId("tree-node-attribution-time-time-node");
    expect(timeEl).toBeInTheDocument();
    // Should contain some date representation
    expect(timeEl.textContent).toBeTruthy();
  });

  it("should have proper aria-label for accessibility", () => {
    const llmNode = makeNode({
      id: "aria-node",
      updatedBy: "llm:gpt-4o",
    });
    render(<FileTreeNode {...defaultProps} node={llmNode} />);
    const badge = screen.getByTestId("tree-node-attribution-aria-node");
    expect(badge.getAttribute("aria-label")).toBe("AI-assisted by gpt-4o");
  });

  it("should show badge for system:llm prefix but not for system prefix", () => {
    const systemNode = makeNode({
      id: "sys-node",
      updatedBy: "system:auto-save",
    });
    render(<FileTreeNode {...defaultProps} node={systemNode} />);
    expect(
      screen.queryByTestId("tree-node-attribution-sys-node"),
    ).not.toBeInTheDocument();
  });
});
