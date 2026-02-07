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
});
