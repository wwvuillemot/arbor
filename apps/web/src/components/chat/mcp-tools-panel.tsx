"use client";

import * as React from "react";
import { Search, ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface McpToolsPanelProps {
  className?: string;
}

/**
 * McpToolsPanel - Browse and search available MCP tools.
 * Shows tool names, descriptions, and their parameter schemas.
 */
export function McpToolsPanel({ className }: McpToolsPanelProps) {
  const [search, setSearch] = React.useState("");
  const [expandedTools, setExpandedTools] = React.useState<Set<string>>(
    new Set(),
  );

  const toolsQuery = trpc.mcp.listTools.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const filteredTools = React.useMemo(() => {
    const tools = toolsQuery.data ?? [];
    if (!search.trim()) return tools;
    const q = search.toLowerCase();
    return tools.filter(
      (t) =>
        t.function.name.toLowerCase().includes(q) ||
        (t.function.description ?? "").toLowerCase().includes(q),
    );
  }, [toolsQuery.data, search]);

  function toggleTool(name: string) {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools…"
          className="w-full pl-7 pr-3 py-1.5 text-xs rounded border bg-background outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Tool list */}
      {toolsQuery.isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Loading tools…
        </p>
      ) : filteredTools.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No tools found.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {filteredTools.map((tool) => {
            const fn = tool.function;
            const isExpanded = expandedTools.has(fn.name);
            const params = fn.parameters?.properties
              ? Object.entries(
                  fn.parameters.properties as Record<
                    string,
                    { type?: string; description?: string }
                  >,
                )
              : [];
            const required =
              (fn.parameters?.required as string[] | undefined) ?? [];

            return (
              <div key={fn.name} className="rounded border bg-card">
                <button
                  onClick={() => toggleTool(fn.name)}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-accent transition-colors rounded"
                >
                  <span className="flex-shrink-0 mt-0.5">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </span>
                  <Wrench className="flex-shrink-0 w-3.5 h-3.5 mt-0.5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-mono font-medium">
                      {fn.name}
                    </span>
                    {fn.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {fn.description}
                      </p>
                    )}
                  </div>
                </button>

                {isExpanded && params.length > 0 && (
                  <div className="px-3 pb-2 border-t">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mt-2 mb-1.5">
                      Parameters
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {params.map(([name, schema]) => (
                        <div key={name} className="flex items-start gap-2">
                          <code className="text-[11px] font-mono text-foreground flex-shrink-0">
                            {name}
                            {required.includes(name) && (
                              <span className="text-destructive">*</span>
                            )}
                          </code>
                          <span className="text-[11px] text-muted-foreground">
                            {schema.type && (
                              <span className="text-blue-500 mr-1">
                                {schema.type}
                              </span>
                            )}
                            {schema.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
