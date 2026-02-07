import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useNavigationCommands } from "../../src/hooks/use-navigation-commands";
import { commandRegistry } from "../../src/lib/command-registry";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      "dashboard.label": "Go to Dashboard",
      "dashboard.description": "Navigate to the dashboard",
      "search.label": "Search",
      "search.description": "Search for content",
      "projects.label": "Projects",
      "projects.description": "View all projects",
      "chat.label": "Chat",
      "chat.description": "Open chat interface",
      "settings.label": "Settings",
      "settings.description": "Open settings",
    };
    return translations[key] || key;
  },
  useMessages: () => ({
    commands: {
      navigation: {
        dashboard: {
          label: "Go to Dashboard",
          description: "Navigate to the dashboard",
          keywords: ["home", "overview"],
        },
        search: {
          label: "Search",
          description: "Search for content",
          keywords: ["find", "lookup"],
        },
        projects: {
          label: "Projects",
          description: "View all projects",
          keywords: ["folders", "files", "projects"],
        },
        chat: {
          label: "Chat",
          description: "Open chat interface",
          keywords: ["ai", "assistant", "help"],
        },
        settings: {
          label: "Settings",
          description: "Open settings",
          keywords: ["preferences", "config", "options"],
        },
      },
    },
  }),
}));

describe("useNavigationCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear command registry before each test
    commandRegistry.clear();
  });

  afterEach(() => {
    // Clean up after each test
    commandRegistry.clear();
  });

  it("should register navigation commands on mount", () => {
    renderHook(() => useNavigationCommands());

    const commands = commandRegistry.getCommands();
    expect(commands.length).toBeGreaterThan(0);

    // Check that specific commands are registered
    const commandIds = commands.map((cmd) => cmd.id);
    expect(commandIds).toContain("nav-dashboard");
    expect(commandIds).toContain("nav-search");
    expect(commandIds).toContain("nav-projects");
    expect(commandIds).toContain("nav-chat");
    expect(commandIds).toContain("nav-settings");
  });

  it("should register dashboard navigation command", () => {
    renderHook(() => useNavigationCommands());

    const command = commandRegistry
      .getCommands()
      .find((cmd) => cmd.id === "nav-dashboard");
    expect(command).toBeDefined();
    expect(command?.label).toBe("Go to Dashboard");
    expect(command?.group).toBe("navigation");
  });

  it("should navigate to dashboard when dashboard command is executed", () => {
    renderHook(() => useNavigationCommands());

    const command = commandRegistry
      .getCommands()
      .find((cmd) => cmd.id === "nav-dashboard");
    command?.action();

    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("should navigate to search when search command is executed", () => {
    renderHook(() => useNavigationCommands());

    const command = commandRegistry
      .getCommands()
      .find((cmd) => cmd.id === "nav-search");
    command?.action();

    expect(mockPush).toHaveBeenCalledWith("/search");
  });

  it("should navigate to projects when projects command is executed", () => {
    renderHook(() => useNavigationCommands());

    const command = commandRegistry
      .getCommands()
      .find((cmd) => cmd.id === "nav-projects");
    command?.action();

    expect(mockPush).toHaveBeenCalledWith("/projects");
  });

  it("should navigate to chat when chat command is executed", () => {
    renderHook(() => useNavigationCommands());

    const command = commandRegistry
      .getCommands()
      .find((cmd) => cmd.id === "nav-chat");
    command?.action();

    expect(mockPush).toHaveBeenCalledWith("/chat");
  });

  it("should navigate to settings when settings command is executed", () => {
    renderHook(() => useNavigationCommands());

    const command = commandRegistry
      .getCommands()
      .find((cmd) => cmd.id === "nav-settings");
    command?.action();

    expect(mockPush).toHaveBeenCalledWith("/settings");
  });

  it("should unregister commands on unmount", () => {
    const { unmount } = renderHook(() => useNavigationCommands());

    expect(commandRegistry.getCommands().length).toBeGreaterThan(0);

    unmount();

    expect(commandRegistry.getCommands().length).toBe(0);
  });

  it("should load keywords from array-based translations without infinite loop", () => {
    // This test will fail with the current implementation because getKeywords()
    // tries to access keywords.0, keywords.1, etc., but the translations use
    // arrays: "keywords": ["home", "overview"]
    // This causes an infinite loop because t("dashboard.keywords.0") returns
    // "dashboard.keywords.0" (the key path), not the actual keyword

    // Set a timeout to prevent the test from hanging forever
    const timeout = setTimeout(() => {
      throw new Error("Test timed out - infinite loop detected in getKeywords()");
    }, 1000);

    try {
      renderHook(() => useNavigationCommands());

      const dashboardCommand = commandRegistry
        .getCommands()
        .find((cmd) => cmd.id === "nav-dashboard");

      expect(dashboardCommand).toBeDefined();
      expect(dashboardCommand?.keywords).toEqual(["home", "overview"]);

      const projectsCommand = commandRegistry
        .getCommands()
        .find((cmd) => cmd.id === "nav-projects");

      expect(projectsCommand).toBeDefined();
      expect(projectsCommand?.keywords).toEqual(["folders", "files", "projects"]);

      clearTimeout(timeout);
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  });
});
