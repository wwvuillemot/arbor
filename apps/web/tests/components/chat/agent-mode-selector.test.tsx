/**
 * Tests for AgentModeSelector component
 */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentModeSelector } from "@/components/chat/agent-mode-selector";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      "mode.assistant": "Assistant",
      "mode.planner": "Planner",
      "mode.editor": "Editor",
      "mode.researcher": "Researcher",
    };
    return translations[key] || key;
  },
}));

describe("AgentModeSelector", () => {
  it("should render with selected mode", () => {
    const onChange = vi.fn();
    render(<AgentModeSelector value="assistant" onChange={onChange} />);

    const button = screen.getByTestId("agent-mode-selector");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Assistant");
  });

  it("should open dropdown when clicked", () => {
    const onChange = vi.fn();
    render(<AgentModeSelector value="assistant" onChange={onChange} />);

    const button = screen.getByTestId("agent-mode-selector");
    fireEvent.click(button);

    const dropdown = screen.getByTestId("agent-mode-dropdown");
    expect(dropdown).toBeInTheDocument();
  });

  it("should show all agent modes in dropdown", () => {
    const onChange = vi.fn();
    render(<AgentModeSelector value="assistant" onChange={onChange} />);

    const button = screen.getByTestId("agent-mode-selector");
    fireEvent.click(button);

    expect(screen.getByTestId("agent-mode-option-assistant")).toBeInTheDocument();
    expect(screen.getByTestId("agent-mode-option-planner")).toBeInTheDocument();
    expect(screen.getByTestId("agent-mode-option-editor")).toBeInTheDocument();
    expect(screen.getByTestId("agent-mode-option-researcher")).toBeInTheDocument();
  });

  it("should call onChange when mode is selected", () => {
    const onChange = vi.fn();
    render(<AgentModeSelector value="assistant" onChange={onChange} />);

    const button = screen.getByTestId("agent-mode-selector");
    fireEvent.click(button);

    const plannerOption = screen.getByTestId("agent-mode-option-planner");
    fireEvent.click(plannerOption);

    expect(onChange).toHaveBeenCalledWith("planner");
  });

  it("should close dropdown after selection", () => {
    const onChange = vi.fn();
    render(<AgentModeSelector value="assistant" onChange={onChange} />);

    const button = screen.getByTestId("agent-mode-selector");
    fireEvent.click(button);

    const plannerOption = screen.getByTestId("agent-mode-option-planner");
    fireEvent.click(plannerOption);

    expect(screen.queryByTestId("agent-mode-dropdown")).not.toBeInTheDocument();
  });

  it("should close dropdown when clicking outside", () => {
    const onChange = vi.fn();
    render(<AgentModeSelector value="assistant" onChange={onChange} />);

    const button = screen.getByTestId("agent-mode-selector");
    fireEvent.click(button);

    expect(screen.getByTestId("agent-mode-dropdown")).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);

    expect(screen.queryByTestId("agent-mode-dropdown")).not.toBeInTheDocument();
  });
});

