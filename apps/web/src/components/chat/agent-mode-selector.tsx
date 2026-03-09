"use client";

import * as React from "react";
import {
  ChevronDown,
  Bot,
  Lightbulb,
  Pencil,
  Search,
  Palette,
  Info,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

const AGENT_MODES = [
  "assistant",
  "planner",
  "editor",
  "researcher",
  "art_director",
] as const;
type AgentMode = (typeof AGENT_MODES)[number];

const MODE_ICONS: Record<
  AgentMode,
  React.ComponentType<{ className?: string }>
> = {
  assistant: Bot,
  planner: Lightbulb,
  editor: Pencil,
  researcher: Search,
  art_director: Palette,
};

export interface AgentModeSelectorProps {
  value: string;
  onChange: (mode: string) => void;
  className?: string;
}

export function AgentModeSelector({
  value,
  onChange,
  className,
}: AgentModeSelectorProps) {
  const t = useTranslations("chat");
  const [isOpen, setIsOpen] = React.useState(false);
  const [tooltipMode, setTooltipMode] = React.useState<string | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const agentModesQuery = trpc.chat.listAgentModes.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const agentModeMap = React.useMemo(() => {
    const map = new Map<
      string,
      { allowedTools: string[]; description: string }
    >();
    for (const m of agentModesQuery.data ?? []) {
      map.set(m.name, {
        allowedTools: m.allowedTools ?? [],
        description: m.description ?? "",
      });
    }
    return map;
  }, [agentModesQuery.data]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (mode: string) => {
    onChange(mode);
    setIsOpen(false);
  };

  const Icon = MODE_ICONS[value as AgentMode] || Bot;

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs border rounded px-2 py-1.5 bg-background hover:bg-accent transition-colors flex items-center gap-1.5 min-w-[120px]"
        data-testid="agent-mode-selector"
      >
        <Icon className="w-3 h-3" />
        <span className="flex-1 text-left">{t(`mode.${value}`)}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-1 z-50 min-w-[200px] rounded-md border bg-popover shadow-md"
          data-testid="agent-mode-dropdown"
        >
          <div className="p-1">
            {AGENT_MODES.map((mode) => {
              const ModeIcon = MODE_ICONS[mode];
              const modeInfo = agentModeMap.get(mode);
              const isTooltipOpen = tooltipMode === mode;
              return (
                <div key={mode} className="relative">
                  <button
                    type="button"
                    onClick={() => handleSelect(mode)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2 pr-8",
                      value === mode && "bg-accent",
                    )}
                    data-testid={`agent-mode-option-${mode}`}
                  >
                    <ModeIcon className="w-4 h-4 flex-shrink-0" />
                    <span>{t(`mode.${mode}`)}</span>
                  </button>
                  {modeInfo && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      onMouseEnter={() => setTooltipMode(mode)}
                      onMouseLeave={() => setTooltipMode(null)}
                      onClick={(e) => e.stopPropagation()}
                      title="Show tools"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isTooltipOpen && modeInfo && (
                    <div className="absolute bottom-full right-0 mb-1 z-[60] w-56 rounded-md border bg-popover shadow-lg p-3 space-y-2">
                      <p className="text-xs text-muted-foreground leading-snug">
                        {modeInfo.description}
                      </p>
                      {modeInfo.allowedTools.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1">
                            Tools ({modeInfo.allowedTools.length})
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {modeInfo.allowedTools.map((tool) => (
                              <span
                                key={tool}
                                className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border"
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
