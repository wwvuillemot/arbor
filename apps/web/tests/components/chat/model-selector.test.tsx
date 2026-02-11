import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ModelSelector } from "@/components/chat/model-selector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  trpc: {
    llm: {
      listAvailableModels: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) => {
    const translations: Record<string, any> = {
      chat: {
        loadingModels: "Loading models...",
        defaultModel: "Default",
        useProviderDefault: "Use provider default",
      },
    };

    if (namespace) {
      return translations[namespace]?.[key] || key;
    }
    return key;
  },
}));

const mockModels = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
  },
  {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    provider: "local",
    contextWindow: 65536,
    supportsTools: false,
    supportsVision: false,
    supportsStreaming: true,
    supportsReasoning: true,
  },
];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  );
}

describe("ModelSelector", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render loading state", () => {
    vi.mocked(trpc.llm.listAvailableModels.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);

    renderWithProviders(<ModelSelector value={null} onChange={mockOnChange} />);
    expect(screen.getByText("Loading models...")).toBeInTheDocument();
  });

  it("should render with default model selected", () => {
    vi.mocked(trpc.llm.listAvailableModels.useQuery).mockReturnValue({
      data: mockModels,
      isLoading: false,
    } as any);

    renderWithProviders(<ModelSelector value={null} onChange={mockOnChange} />);
    expect(screen.getByTestId("model-selector-button")).toHaveTextContent("Default");
  });

  it("should render with specific model selected", () => {
    vi.mocked(trpc.llm.listAvailableModels.useQuery).mockReturnValue({
      data: mockModels,
      isLoading: false,
    } as any);

    renderWithProviders(<ModelSelector value="gpt-4o" onChange={mockOnChange} />);
    expect(screen.getByTestId("model-selector-button")).toHaveTextContent("GPT-4o");
  });

  it("should open dropdown when button is clicked", () => {
    vi.mocked(trpc.llm.listAvailableModels.useQuery).mockReturnValue({
      data: mockModels,
      isLoading: false,
    } as any);

    renderWithProviders(<ModelSelector value={null} onChange={mockOnChange} />);

    const button = screen.getByTestId("model-selector-button");
    fireEvent.click(button);

    expect(screen.getByTestId("model-selector-dropdown")).toBeInTheDocument();
  });

  it("should display grouped models by provider", () => {
    vi.mocked(trpc.llm.listAvailableModels.useQuery).mockReturnValue({
      data: mockModels,
      isLoading: false,
    } as any);

    renderWithProviders(<ModelSelector value={null} onChange={mockOnChange} />);

    const button = screen.getByTestId("model-selector-button");
    fireEvent.click(button);

    // Check provider groups
    expect(screen.getByText("openai")).toBeInTheDocument();
    expect(screen.getByText("anthropic")).toBeInTheDocument();
    expect(screen.getByText("local")).toBeInTheDocument();

    // Check models
    expect(screen.getByText("GPT-4o")).toBeInTheDocument();
    expect(screen.getByText("Claude 3.5 Sonnet")).toBeInTheDocument();
    expect(screen.getByText("DeepSeek R1")).toBeInTheDocument();
  });

  it("should call onChange when model is selected", async () => {
    vi.mocked(trpc.llm.listAvailableModels.useQuery).mockReturnValue({
      data: mockModels,
      isLoading: false,
    } as any);

    renderWithProviders(<ModelSelector value={null} onChange={mockOnChange} />);

    const button = screen.getByTestId("model-selector-button");
    fireEvent.click(button);

    const modelOption = screen.getByTestId("model-option-gpt-4o");
    fireEvent.click(modelOption);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith("gpt-4o");
    });
  });

  it("should call onChange with null when default is selected", async () => {
    vi.mocked(trpc.llm.listAvailableModels.useQuery).mockReturnValue({
      data: mockModels,
      isLoading: false,
    } as any);

    renderWithProviders(<ModelSelector value="gpt-4o" onChange={mockOnChange} />);

    const button = screen.getByTestId("model-selector-button");
    fireEvent.click(button);

    const defaultOption = screen.getByTestId("model-option-default");
    fireEvent.click(defaultOption);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(null);
    });
  });

  it("should display model capabilities", () => {
    vi.mocked(trpc.llm.listAvailableModels.useQuery).mockReturnValue({
      data: mockModels,
      isLoading: false,
    } as any);

    renderWithProviders(<ModelSelector value={null} onChange={mockOnChange} />);

    const button = screen.getByTestId("model-selector-button");
    fireEvent.click(button);

    // DeepSeek R1 should show reasoning capability
    const deepseekOption = screen.getByTestId("model-option-deepseek-r1");
    expect(deepseekOption).toHaveTextContent("🧠 Reasoning");
  });

  it("should close dropdown when clicking outside", async () => {
    vi.mocked(trpc.llm.listAvailableModels.useQuery).mockReturnValue({
      data: mockModels,
      isLoading: false,
    } as any);

    renderWithProviders(<ModelSelector value={null} onChange={mockOnChange} />);

    const button = screen.getByTestId("model-selector-button");
    fireEvent.click(button);

    expect(screen.getByTestId("model-selector-dropdown")).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByTestId("model-selector-dropdown")).not.toBeInTheDocument();
    });
  });
});
