import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AgentModesPage from "@/app/[locale]/(app)/settings/agent-modes/page";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock AgentModeManager component
vi.mock("@/components/agent-mode-manager", () => ({
  AgentModeManager: () => (
    <div data-testid="agent-mode-manager">Agent Mode Manager</div>
  ),
}));

describe("AgentModesPage", () => {
  it("should render page title and description", () => {
    render(<AgentModesPage />);

    expect(screen.getByText("nav.agentModes")).toBeInTheDocument();
    expect(screen.getByText("agentModes.description")).toBeInTheDocument();
  });

  it("should render AgentModeManager component", () => {
    render(<AgentModesPage />);

    expect(screen.getByTestId("agent-mode-manager")).toBeInTheDocument();
  });
});
