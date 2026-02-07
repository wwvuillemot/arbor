import { type LucideIcon } from "lucide-react";

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  keywords?: string[];
  group?: string;
  shortcut?: string[];
  action: () => void | Promise<void>;
}

export interface CommandGroup {
  id: string;
  label: string;
  priority?: number;
}

class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private groups: Map<string, CommandGroup> = new Map();
  private listeners: Set<() => void> = new Set();

  /**
   * Register a new command
   */
  register(command: Command): () => void {
    this.commands.set(command.id, command);
    this.notifyListeners();

    // Return unregister function
    return () => {
      this.commands.delete(command.id);
      this.notifyListeners();
    };
  }

  /**
   * Register multiple commands at once
   */
  registerMany(commands: Command[]): () => void {
    const unregisterFns = commands.map((cmd) => this.register(cmd));
    return () => unregisterFns.forEach((fn) => fn());
  }

  /**
   * Register a command group
   */
  registerGroup(group: CommandGroup): void {
    this.groups.set(group.id, group);
    this.notifyListeners();
  }

  /**
   * Get all registered commands
   */
  getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by group
   */
  getCommandsByGroup(groupId: string): Command[] {
    return this.getCommands().filter((cmd) => cmd.group === groupId);
  }

  /**
   * Get all groups sorted by priority
   */
  getGroups(): CommandGroup[] {
    return Array.from(this.groups.values()).sort(
      (a, b) => (b.priority || 0) - (a.priority || 0),
    );
  }

  /**
   * Search commands by query
   */
  search(query: string): Command[] {
    const lowerQuery = query.toLowerCase();
    return this.getCommands().filter((cmd) => {
      const labelMatch = cmd.label.toLowerCase().includes(lowerQuery);
      const descMatch = cmd.description?.toLowerCase().includes(lowerQuery);
      const keywordMatch = cmd.keywords?.some((kw) =>
        kw.toLowerCase().includes(lowerQuery),
      );
      return labelMatch || descMatch || keywordMatch;
    });
  }

  /**
   * Subscribe to registry changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Clear all commands (useful for testing)
   */
  clear(): void {
    this.commands.clear();
    this.groups.clear();
    this.notifyListeners();
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry();

// Register default groups
commandRegistry.registerGroup({
  id: "navigation",
  label: "Navigation",
  priority: 100,
});
commandRegistry.registerGroup({
  id: "actions",
  label: "Actions",
  priority: 90,
});
commandRegistry.registerGroup({
  id: "settings",
  label: "Settings",
  priority: 80,
});
commandRegistry.registerGroup({ id: "help", label: "Help", priority: 70 });
