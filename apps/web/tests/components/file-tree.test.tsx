import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  FileTreeNode,
  type TreeNode,
} from "@/components/file-tree/file-tree-node";
import { CreateNodeDialog } from "@/components/file-tree/create-node-dialog";
import { RenameDialog } from "@/components/file-tree/rename-dialog";
import { NodeContextMenu } from "@/components/file-tree/context-menu";

// Mock next-intl (already mocked in setup.ts, but be explicit)
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
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

  it("should call onToggle and onSelect when folder is clicked", () => {
    render(<FileTreeNode {...defaultProps} />);
    fireEvent.click(screen.getByRole("treeitem"));
    expect(defaultProps.onToggle).toHaveBeenCalledWith("node-1");
    expect(defaultProps.onSelect).toHaveBeenCalledWith("node-1");
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
    expect(defaultProps.onToggle).toHaveBeenCalledWith("node-1");
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
    expect(menuItems).toHaveLength(4);
    expect(screen.getByText("newFolder")).toBeInTheDocument();
    expect(screen.getByText("newNote")).toBeInTheDocument();
    expect(screen.getByText("rename")).toBeInTheDocument();
    expect(screen.getByText("delete")).toBeInTheDocument();
  });

  it("should show only Rename and Delete for notes", () => {
    render(<NodeContextMenu {...defaultProps} node={noteNode} />);
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems).toHaveLength(2);
    expect(screen.getByText("rename")).toBeInTheDocument();
    expect(screen.getByText("delete")).toBeInTheDocument();
    expect(screen.queryByText("newFolder")).not.toBeInTheDocument();
    expect(screen.queryByText("newNote")).not.toBeInTheDocument();
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

  it("should call onAction with delete action", () => {
    render(<NodeContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText("delete"));
    expect(defaultProps.onAction).toHaveBeenCalledWith({
      type: "delete",
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
