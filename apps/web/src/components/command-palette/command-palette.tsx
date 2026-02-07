"use client";

import * as React from "react";
import { Command } from "cmdk";
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
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const t = useTranslations("commandPalette");

  // Subscribe to command registry changes
  React.useEffect(() => {
    const updateCommands = () => {
      setCommands(commandRegistry.getCommands());
    };

    updateCommands();
    return commandRegistry.subscribe(updateCommands);
  }, []);

  // Auto-focus input when dialog opens
  React.useEffect(() => {
    if (open) {
      // Use requestAnimationFrame to ensure the dialog is fully rendered
      requestAnimationFrame(() => {
        const input = document.querySelector(
          "[cmdk-input]",
        ) as HTMLInputElement;
        if (input) {
          input.focus();
        }
      });
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
    return groups.map((group) => ({
      ...group,
      commands: filteredCommands.filter((cmd) => cmd.group === group.id),
    }));
  }, [filteredCommands]);

  // Handle command execution
  const handleSelect = React.useCallback(
    async (command: CommandType) => {
      onOpenChange(false);
      setSearch("");
      await command.action();
    },
    [onOpenChange],
  );

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // CMD-K or CTRL-K to toggle
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }
      // ESC to close
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onOpenChange(false);
        return;
      }

      // Don't handle shortcuts when typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Handle two-key shortcuts (e.g., "g d" for dashboard)
      if (pendingKey) {
        // We have a pending key, check if this completes a shortcut
        const shortcut = [pendingKey, e.key.toLowerCase()];
        const command = commands.find(
          (cmd) =>
            cmd.shortcut &&
            cmd.shortcut.length === 2 &&
            cmd.shortcut[0] === shortcut[0] &&
            cmd.shortcut[1] === shortcut[1],
        );

        if (command) {
          e.preventDefault();
          command.action();
        }

        // Clear pending key
        setPendingKey(null);
      } else if (e.key.toLowerCase() === "g") {
        // Start of a two-key shortcut
        e.preventDefault();
        setPendingKey("g");

        // Clear pending key after 1 second if no second key is pressed
        setTimeout(() => setPendingKey(null), 1000);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange, pendingKey, commands]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 px-4">
        <Command
          className="overflow-hidden rounded-lg border bg-popover shadow-lg"
          shouldFilter={false}
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder={t("placeholder")}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {t("noResults")}
            </Command.Empty>

            {groupedCommands.map((group) => {
              if (group.commands.length === 0) return null;

              return (
                <Command.Group
                  key={group.id}
                  heading={group.label}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {group.commands.map((command) => {
                    const Icon = command.icon;
                    return (
                      <Command.Item
                        key={command.id}
                        value={command.id}
                        onSelect={() => handleSelect(command)}
                        className={cn(
                          "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                          "aria-selected:bg-accent aria-selected:text-accent-foreground",
                          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                        )}
                      >
                        {Icon && <Icon className="mr-2 h-4 w-4" />}
                        <div className="flex-1">
                          <div>{command.label}</div>
                          {command.description && (
                            <div className="text-xs text-muted-foreground">
                              {command.description}
                            </div>
                          )}
                        </div>
                        {command.shortcut && (
                          <div className="ml-auto flex gap-1">
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
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              );
            })}
          </Command.List>
        </Command>
      </div>
      <div
        className="fixed inset-0 -z-10"
        onClick={() => onOpenChange(false)}
        aria-label="Close command palette"
      />
    </div>
  );
}
