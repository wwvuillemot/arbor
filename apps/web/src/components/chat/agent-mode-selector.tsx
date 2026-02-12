"use client";

import * as React from "react";
import { ChevronDown, Bot, Lightbulb, Pencil, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const AGENT_MODES = ["assistant", "planner", "editor", "researcher"] as const;
type AgentMode = (typeof AGENT_MODES)[number];

const MODE_ICONS: Record<
  AgentMode,
  React.ComponentType<{ className?: string }>
> = {
  assistant: Bot,
  planner: Lightbulb,
  editor: Pencil,
  researcher: Search,
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
  const dropdownRef = React.useRef<HTMLDivElement>(null);

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
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleSelect(mode)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2",
                    value === mode && "bg-accent",
                  )}
                  data-testid={`agent-mode-option-${mode}`}
                >
                  <ModeIcon className="w-4 h-4" />
                  <span>{t(`mode.${mode}`)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
