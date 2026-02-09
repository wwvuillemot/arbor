/**
 * Phase 1.7: Projects Page Export UI Tests
 *
 * Tests for export button visibility, menu toggle, and export handlers.
 */
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/projects",
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Track addToast calls
const mockAddToast = vi.fn();
vi.mock("@/contexts/toast-context", () => ({
  useToast: () => ({
    addToast: mockAddToast,
    removeToast: vi.fn(),
    toasts: [],
  }),
}));

// Mock current project hook
vi.mock("@/hooks/use-current-project", () => ({
  useCurrentProject: () => ({
    currentProjectId: "proj-1",
    setCurrentProject: vi.fn(),
    isLoading: false,
    isUpdating: false,
  }),
}));

// Mock auto-save hook
vi.mock("@/hooks/use-auto-save", () => ({
  useAutoSave: () => ({ status: "idle" as const, reset: vi.fn() }),
}));

// Mock TipTap editor components
vi.mock("@/components/editor", () => ({
  TiptapEditor: ({ onEditorReady }: any) => {
    return <div data-testid="tiptap-editor" />;
  },
  ImageUpload: () => null,
}));

// Mock FileTree component - calls onSelectNode on mount to simulate selecting a node
vi.mock("@/components/file-tree", () => ({
  FileTree: React.forwardRef(
    ({ onSelectNode }: { onSelectNode: (id: string) => void }, _ref: any) => {
      React.useEffect(() => {
        onSelectNode("node-1");
      }, [onSelectNode]);
      return <div data-testid="file-tree" />;
    },
  ),
  CreateNodeDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-node-dialog" /> : null,
  RenameDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="rename-dialog" /> : null,
  NodeContextMenu: ({ open }: { open: boolean }) =>
    open ? <div data-testid="context-menu" /> : null,
}));

// Track export fetch calls
const mockFetchExportMarkdown = vi
  .fn()
  .mockResolvedValue({ content: "# Test\n\nContent" });
const mockFetchExportHtml = vi.fn().mockResolvedValue({
  content: "<!DOCTYPE html><html><body><h1>Test</h1></body></html>",
});

// Mock tRPC
vi.mock("@/lib/trpc", () => {
  const makeMutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isLoading: false,
    error: null,
  });

  const selectedNodeData = {
    id: "node-1",
    name: "Test Note",
    type: "note",
    parentId: "proj-1",
    content: null,
    metadata: null,
    position: 0,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  const mockTrpc = {
    nodes: {
      getAllProjects: {
        useQuery: vi.fn(() => ({
          data: [
            {
              id: "proj-1",
              name: "Test Project",
              type: "project",
              parentId: null,
              position: 0,
            },
          ],
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        })),
      },
      getById: {
        useQuery: vi.fn(() => ({
          data: selectedNodeData,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        })),
      },
      create: { useMutation: vi.fn(() => makeMutation()) },
      update: { useMutation: vi.fn(() => makeMutation()) },
      delete: { useMutation: vi.fn(() => makeMutation()) },
      move: { useMutation: vi.fn(() => makeMutation()) },
    },
    media: {
      upload: { useMutation: vi.fn(() => makeMutation()) },
      getDownloadUrl: { useMutation: vi.fn(() => makeMutation()) },
    },
    useUtils: vi.fn(() => ({
      nodes: {
        getAllProjects: { invalidate: vi.fn(), refetch: vi.fn() },
        getById: { invalidate: vi.fn() },
        exportMarkdown: { fetch: mockFetchExportMarkdown },
        exportHtml: { fetch: mockFetchExportHtml },
      },
    })),
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };

  return { trpc: mockTrpc, getTRPCClient: vi.fn() };
});

// Import the page component AFTER mocks
import ProjectsPage from "@/app/[locale]/(app)/projects/page";

function TestWrapper({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("ProjectsPage Export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render export button when a node is selected", async () => {
    render(<ProjectsPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByTestId("content-export-button")).toBeInTheDocument();
    });
  });

  it("should show export menu when export button is clicked", async () => {
    render(<ProjectsPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByTestId("content-export-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("content-export-button"));

    expect(screen.getByTestId("export-menu")).toBeInTheDocument();
    expect(screen.getByTestId("export-markdown")).toBeInTheDocument();
    expect(screen.getByTestId("export-project-markdown")).toBeInTheDocument();
    expect(screen.getByTestId("export-pdf")).toBeInTheDocument();
    expect(screen.getByTestId("export-project-pdf")).toBeInTheDocument();
  });

  it("should hide export menu when export button is clicked again", async () => {
    render(<ProjectsPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByTestId("content-export-button")).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId("content-export-button");
    fireEvent.click(exportButton);
    expect(screen.getByTestId("export-menu")).toBeInTheDocument();

    fireEvent.click(exportButton);
    expect(screen.queryByTestId("export-menu")).not.toBeInTheDocument();
  });

  it("should call exportMarkdown fetch when markdown export is clicked", async () => {
    // Mock URL.createObjectURL and DOM APIs
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:test-url");
    const mockRevokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        if (tag === "a") {
          const anchor = originalCreateElement("a");
          anchor.click = mockClick;
          return anchor;
        }
        return originalCreateElement(tag);
      });

    render(<ProjectsPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByTestId("content-export-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("content-export-button"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("export-markdown"));
    });

    await waitFor(() => {
      expect(mockFetchExportMarkdown).toHaveBeenCalledWith({
        id: "node-1",
        includeDescendants: false,
      });
    });

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();
    expect(mockAddToast).toHaveBeenCalledWith("exportSuccess", "success");

    // Cleanup - restore only the spy we created, not all mocks
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    createElementSpy.mockRestore();
  });

  it("should call exportMarkdown with includeDescendants for project export", async () => {
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:test-url");
    const mockRevokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        if (tag === "a") {
          const anchor = originalCreateElement("a");
          anchor.click = mockClick;
          return anchor;
        }
        return originalCreateElement(tag);
      });

    render(<ProjectsPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByTestId("content-export-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("content-export-button"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("export-project-markdown"));
    });

    await waitFor(() => {
      expect(mockFetchExportMarkdown).toHaveBeenCalledWith({
        id: "node-1",
        includeDescendants: true,
      });
    });

    // Cleanup - restore only the spy we created, not all mocks
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    createElementSpy.mockRestore();
  });

  it("should call exportHtml and open print window for PDF export", async () => {
    const mockPrint = vi.fn();
    const mockClose = vi.fn();
    const mockWrite = vi.fn();
    const mockWindowObj = {
      document: { write: mockWrite, close: mockClose },
      focus: vi.fn(),
      print: mockPrint,
    };
    const originalOpen = window.open;
    const mockOpenFn = vi.fn().mockReturnValue(mockWindowObj);
    Object.defineProperty(window, "open", {
      value: mockOpenFn,
      writable: true,
      configurable: true,
    });

    render(<ProjectsPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByTestId("content-export-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("content-export-button"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("export-pdf"));
    });

    await waitFor(() => {
      expect(mockFetchExportHtml).toHaveBeenCalledWith({
        id: "node-1",
        includeDescendants: false,
      });
      expect(mockOpenFn).toHaveBeenCalledWith("", "_blank");
      expect(mockWrite).toHaveBeenCalled();
      expect(mockPrint).toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith("exportSuccess", "success");
    });

    // Restore
    Object.defineProperty(window, "open", {
      value: originalOpen,
      writable: true,
      configurable: true,
    });
  });

  it("should show error toast when export fails", async () => {
    mockFetchExportMarkdown.mockRejectedValueOnce(new Error("Export failed"));

    render(<ProjectsPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByTestId("content-export-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("content-export-button"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("export-markdown"));
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("exportError", "error");
    });
  });
});
