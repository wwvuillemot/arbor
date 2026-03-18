import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppLayout } from "@/components/layout/app-layout";

const mockPush = vi.fn();
const mockRunSetup = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: ({ onSearchOpen }: { onSearchOpen?: () => void }) => (
    <button onClick={onSearchOpen}>open search</button>
  ),
}));

vi.mock("@/components/command-palette/command-palette", () => ({
  CommandPalette: () => <div data-testid="command-palette" />,
}));

vi.mock("@/components/about-dialog", () => ({
  AboutDialog: () => <div data-testid="about-dialog" />,
}));

vi.mock("@/components/setup-screen", () => ({
  SetupScreen: () => <div data-testid="setup-screen" />,
}));

vi.mock("@/components/search", () => ({
  SearchModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="search-modal">search modal</div> : null,
}));

vi.mock("@/hooks/use-command-palette", () => ({
  useCommandPalette: () => ({ open: false, setOpen: vi.fn() }),
}));

vi.mock("@/hooks/use-about-dialog", () => ({
  useAboutDialog: () => ({ open: false, setOpen: vi.fn() }),
}));

vi.mock("@/hooks/use-navigation-commands", () => ({
  useNavigationCommands: vi.fn(),
}));

vi.mock("@/hooks/use-about-command", () => ({
  useAboutCommand: vi.fn(),
}));

vi.mock("@/hooks/use-command-groups", () => ({
  useCommandGroups: vi.fn(),
}));

vi.mock("@/hooks/use-setup", () => ({
  useSetup: () => ({
    isSetupRequired: false,
    mode: null,
    runSetup: mockRunSetup,
  }),
}));

vi.mock("@/hooks/use-theme", () => ({
  useTheme: vi.fn(),
}));

describe("AppLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not intercept Cmd/Ctrl+F", () => {
    render(
      <AppLayout>
        <div>content</div>
      </AppLayout>,
    );

    const commandFindEvent = new KeyboardEvent("keydown", {
      key: "f",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(commandFindEvent);

    const controlFindEvent = new KeyboardEvent("keydown", {
      key: "f",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(controlFindEvent);

    expect(commandFindEvent.defaultPrevented).toBe(false);
    expect(controlFindEvent.defaultPrevented).toBe(false);
    expect(screen.queryByTestId("search-modal")).not.toBeInTheDocument();
  });

  it("still opens search from layout controls", () => {
    render(
      <AppLayout>
        <div>content</div>
      </AppLayout>,
    );

    fireEvent.click(screen.getByRole("button", { name: "open search" }));

    expect(screen.getByTestId("search-modal")).toBeInTheDocument();
  });
});
