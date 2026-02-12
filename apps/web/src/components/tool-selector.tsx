"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Available tools in the system with descriptions
 */
export const AVAILABLE_TOOLS = [
  {
    name: "create_node",
    displayName: "Create Node",
    description: "Create new nodes (projects, folders, files, paragraphs)",
    category: "Node Operations",
  },
  {
    name: "update_node",
    displayName: "Update Node",
    description: "Modify existing node content and properties",
    category: "Node Operations",
  },
  {
    name: "delete_node",
    displayName: "Delete Node",
    description: "Remove nodes from the system",
    category: "Node Operations",
  },
  {
    name: "move_node",
    displayName: "Move Node",
    description: "Reorganize nodes by changing parent/position",
    category: "Node Operations",
  },
  {
    name: "list_nodes",
    displayName: "List Nodes",
    description: "Browse and list nodes in the hierarchy",
    category: "Node Operations",
  },
  {
    name: "search_nodes",
    displayName: "Search Nodes",
    description: "Search nodes by text content",
    category: "Search",
  },
  {
    name: "search_semantic",
    displayName: "Semantic Search",
    description: "Find nodes by meaning using AI embeddings",
    category: "Search",
  },
  {
    name: "add_tag",
    displayName: "Add Tag",
    description: "Add tags to nodes for organization",
    category: "Tags",
  },
  {
    name: "remove_tag",
    displayName: "Remove Tag",
    description: "Remove tags from nodes",
    category: "Tags",
  },
  {
    name: "list_tags",
    displayName: "List Tags",
    description: "View all available tags",
    category: "Tags",
  },
  {
    name: "export_node",
    displayName: "Export Node",
    description: "Export a single node to various formats",
    category: "Export",
  },
  {
    name: "export_project",
    displayName: "Export Project",
    description: "Export entire project to various formats",
    category: "Export",
  },
] as const;

export interface ToolSelectorProps {
  value: string[];
  onChange: (tools: string[]) => void;
  className?: string;
}

export function ToolSelector({
  value,
  onChange,
  className,
}: ToolSelectorProps) {
  const toggleTool = (toolName: string) => {
    if (value.includes(toolName)) {
      onChange(value.filter((t) => t !== toolName));
    } else {
      onChange([...value, toolName]);
    }
  };

  const toggleAll = () => {
    if (value.length === AVAILABLE_TOOLS.length) {
      onChange([]);
    } else {
      onChange(AVAILABLE_TOOLS.map((t) => t.name));
    }
  };

  // Group tools by category
  const categories = Array.from(
    new Set(AVAILABLE_TOOLS.map((t) => t.category)),
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Select All / Deselect All */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <span className="text-sm font-medium">
          {value.length} / {AVAILABLE_TOOLS.length} tools selected
        </span>
        <button
          type="button"
          onClick={toggleAll}
          className="text-sm text-primary hover:underline"
        >
          {value.length === AVAILABLE_TOOLS.length
            ? "Deselect All"
            : "Select All"}
        </button>
      </div>

      {/* Tools grouped by category */}
      {categories.map((category) => (
        <div key={category}>
          <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
            {category}
          </h4>
          <div className="space-y-1">
            {AVAILABLE_TOOLS.filter((t) => t.category === category).map(
              (tool) => {
                const isSelected = value.includes(tool.name);
                return (
                  <label
                    key={tool.name}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors",
                      isSelected
                        ? "bg-primary/5 border-primary/50"
                        : "bg-background border-border hover:bg-muted",
                    )}
                  >
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTool(tool.name)}
                        className="sr-only"
                      />
                      <div
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center",
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-input bg-background",
                        )}
                      >
                        {isSelected && (
                          <Check className="w-3 h-3 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {tool.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tool.description}
                      </div>
                    </div>
                  </label>
                );
              },
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
