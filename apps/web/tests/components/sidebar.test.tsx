import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Sidebar } from "@/components/layout/sidebar";
import * as useAppPreferencesModule from "@/hooks/use-app-preferences";

vi.mock("@/hooks/use-app-preferences");

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@/components/project-selector", () => ({
  ProjectSelector: ({ isCollapsed }: { isCollapsed: boolean }) => (
    <div data-testid="project-selector">{String(isCollapsed)}</div>
  ),
}));

describe("Sidebar", () => {
  const mockSetPreference = vi.fn().mockResolvedValue(undefined);
  const mockGetPreference = vi.fn();
  let isPreferencesLoading = false;
  let persistedCollapsedPreference: boolean | undefined = false;

  beforeEach(() => {
    vi.clearAllMocks();
    isPreferencesLoading = false;
    persistedCollapsedPreference = false;

    mockGetPreference.mockImplementation(
      (_key: string, defaultValue?: unknown) =>
        persistedCollapsedPreference ?? defaultValue,
    );

    vi.spyOn(useAppPreferencesModule, "useAppPreferences").mockImplementation(
      () => ({
        preferences:
          persistedCollapsedPreference === undefined
            ? {}
            : { "layout:sidebarCollapsed": persistedCollapsedPreference },
        isLoading: isPreferencesLoading,
        getPreference: mockGetPreference,
        setPreference: mockSetPreference,
        setPreferences: vi.fn(),
        deletePreference: vi.fn(),
        isUpdating: false,
      }),
    );
  });

  it("restores the persisted collapsed state after preferences finish loading", async () => {
    isPreferencesLoading = true;
    persistedCollapsedPreference = undefined;

    const { rerender } = render(<Sidebar />);

    expect(
      screen.getByRole("button", { name: "collapseLabel" }),
    ).toBeInTheDocument();
    expect(screen.getByText("dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("project-selector")).toHaveTextContent("false");

    isPreferencesLoading = false;
    persistedCollapsedPreference = true;
    rerender(<Sidebar />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "expandLabel" }),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText("dashboard")).not.toBeInTheDocument();
    expect(screen.getByTestId("project-selector")).toHaveTextContent("true");
  });

  it("persists the updated collapsed state when the toggle is clicked", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("button", { name: "collapseLabel" }));

    expect(mockSetPreference).toHaveBeenCalledWith(
      "layout:sidebarCollapsed",
      true,
    );
    expect(
      screen.getByRole("button", { name: "expandLabel" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("project-selector")).toHaveTextContent("true");
  });

  it("falls back to defaultCollapsed when no persisted preference exists", () => {
    persistedCollapsedPreference = undefined;

    render(<Sidebar defaultCollapsed={true} />);

    expect(
      screen.getByRole("button", { name: "expandLabel" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument();
  });

  it("opens search from the search button without advertising Cmd+F", () => {
    const handleSearchOpen = vi.fn();

    render(<Sidebar onSearchOpen={handleSearchOpen} />);

    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    expect(handleSearchOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("⌘F")).not.toBeInTheDocument();
  });
});
