"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  commandRegistry,
  type Command as CommandType,
} from "@/lib/command-registry";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [search, setSearch] = React.useState("");
  const [commands, setCommands] = React.useState<CommandType[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const pendingKeyRef = React.useRef<string | null>(null);
  const pendingKeyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const inputRef = React.useRef<HTMLInputElement>(null);
  const t = useTranslations("commandPalette");

  // Subscribe to command registry changes
  React.useEffect(() => {
    const updateCommands = () => setCommands(commandRegistry.getCommands());
    updateCommands();
    return commandRegistry.subscribe(updateCommands);
  }, []);

  // Focus input and reset state when opening
  React.useEffect(() => {
    if (open) {
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    } else {
      setSearch("");
    }
  }, [open]);

  // Filter commands based on search
  const filteredCommands = React.useMemo(() => {
    if (!search) return commands;
    return commandRegistry.search(search);
  }, [search, commands]);

  // Group commands
  const groupedCommands = React.useMemo(() => {
    const groups = commandRegistry.getGroups();
    return groups
      .map((group) => ({
        ...group,
        commands: filteredCommands.filter((cmd) => cmd.group === group.id),
      }))
      .filter((g) => g.commands.length > 0);
  }, [filteredCommands]);

  // Flat list for keyboard navigation
  const flatCommands = React.useMemo(
    () => groupedCommands.flatMap((g) => g.commands),
    [groupedCommands],
  );

  // Reset selection when filtered list changes
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const executeCommand = React.useCallback(
    async (command: CommandType) => {
      onOpenChange(false);
      await command.action();
    },
    [onOpenChange],
  );

  // Keyboard handling
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // CMD-K / CTRL-K toggle
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }

      if (!open) {
        // Two-key shortcuts when palette is closed
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }

        if (pendingKeyRef.current) {
          const shortcut = [pendingKeyRef.current, e.key.toLowerCase()];
          const command = commands.find(
            (cmd) =>
              cmd.shortcut?.length === 2 &&
              cmd.shortcut[0] === shortcut[0] &&
              cmd.shortcut[1] === shortcut[1],
          );
          if (command) {
            e.preventDefault();
            command.action();
          }
          if (pendingKeyTimer.current) clearTimeout(pendingKeyTimer.current);
          pendingKeyRef.current = null;
        } else if (e.key.toLowerCase() === "g") {
          e.preventDefault();
          pendingKeyRef.current = "g";
          if (pendingKeyTimer.current) clearTimeout(pendingKeyTimer.current);
          pendingKeyTimer.current = setTimeout(() => {
            pendingKeyRef.current = null;
          }, 1000);
        }
        return;
      }

      // Palette is open
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatCommands.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = flatCommands[selectedIndex];
        if (cmd) executeCommand(cmd);
        return;
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [
    open,
    onOpenChange,
    commands,
    flatCommands,
    selectedIndex,
    executeCommand,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/70"
      onMouseDown={() => onOpenChange(false)}
    >
      <div
        className="absolute left-1/2 top-[20%] w-full max-w-2xl -translate-x-1/2 px-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden rounded-lg border bg-popover shadow-xl">
          {/* Search input */}
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("placeholder")}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Results list */}
          <div className="max-h-[400px] overflow-y-auto p-2">
            {flatCommands.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t("noResults")}
              </div>
            )}

            {groupedCommands.map((group) => (
              <div key={group.id}>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {group.label}
                </div>
                {group.commands.map((command) => {
                  const Icon = command.icon;
                  const flatIdx = flatCommands.indexOf(command);
                  const isSelected = flatIdx === selectedIndex;
                  return (
                    <button
                      key={command.id}
                      type="button"
                      onClick={() => executeCommand(command)}
                      onMouseEnter={() => setSelectedIndex(flatIdx)}
                      className={cn(
                        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors text-left",
                        isSelected
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {Icon && <Icon className="mr-2 h-4 w-4 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div>{command.label}</div>
                        {command.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {command.description}
                          </div>
                        )}
                      </div>
                      {command.shortcut && (
                        <div className="ml-auto flex gap-1 pl-4">
                          {command.shortcut.map((key, i) => (
                            <kbd
                              key={i}
                              className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
