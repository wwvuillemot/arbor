"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { FolderPlus, FilePlus, Pencil, Trash2 } from "lucide-react";
import type { TreeNode } from "./file-tree-node";

export interface ContextMenuAction {
  type: "newFolder" | "newNote" | "rename" | "delete";
  node: TreeNode;
}

export interface NodeContextMenuProps {
  open: boolean;
  position: { x: number; y: number };
  node: TreeNode | null;
  onClose: () => void;
  onAction: (action: ContextMenuAction) => void;
}

const expandableTypes = new Set(["folder", "project"]);

export function NodeContextMenu({
  open,
  position,
  node,
  onClose,
  onAction,
}: NodeContextMenuProps) {
  const t = useTranslations("fileTree");
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open || !node) return null;

  const isContainer = expandableTypes.has(node.type);

  const menuItems = [
    ...(isContainer
      ? [
          {
            type: "newFolder" as const,
            label: t("newFolder"),
            icon: FolderPlus,
          },
          {
            type: "newNote" as const,
            label: t("newNote"),
            icon: FilePlus,
          },
        ]
      : []),
    {
      type: "rename" as const,
      label: t("rename"),
      icon: Pencil,
    },
    {
      type: "delete" as const,
      label: t("delete"),
      icon: Trash2,
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-lg"
      style={{ left: position.x, top: position.y }}
      data-testid="context-menu"
    >
      {menuItems.map((item, index) => (
        <React.Fragment key={item.type}>
          {item.type === "rename" && isContainer && (
            <div className="my-1 border-t" />
          )}
          {item.type === "delete" && <div className="my-1 border-t" />}
          <button
            role="menuitem"
            className={`flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm transition-colors
              ${item.danger ? "text-destructive hover:bg-destructive/10" : "hover:bg-accent hover:text-accent-foreground"}`}
            onClick={() => {
              onAction({ type: item.type, node });
              onClose();
            }}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
