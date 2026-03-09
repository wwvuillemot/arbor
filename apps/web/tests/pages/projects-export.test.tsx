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
import type { FileTreeHandle } from "@/components/file-tree";
import { getMediaAttachmentUrl } from "@/lib/media-url";

interface MockTiptapEditorProps {
  [key: string]: unknown;
}

interface MockFileTreeProps {
  onSelectNode: (id: string) => void;
}

const {
  currentProjectState,
  mockSearchParamGet,
  mockPush,
  mockAddToast,
  mockSetCurrentProject,
  mockCreateProjectMutate,
  mockTiptapEditor,
  mockFetchExportMarkdown,
  mockFetchExportHtml,
  mockImportDirectoryMutateAsync,
  mockUpdateNodeMutateAsync,
  mockMediaUploadMutateAsync,
  mockGetByIdFetch,
  mockGetDescendantsFetch,
  mockInvalidateGetAllProjects,
  mockInvalidateGetById,
  mockInvalidateGetChildren,
  mockInvalidateGetDescendants,
  folderChildrenData,
  projectImagesData,
  selectedNodeData,
} = vi.hoisted(() => ({
  currentProjectState: { value: "proj-1" as string | null },
  mockSearchParamGet: vi.fn((_key: string): string | null => null),
  mockPush: vi.fn(),
  mockAddToast: vi.fn(),
  mockSetCurrentProject: vi.fn(),
  mockCreateProjectMutate: vi.fn(),
  mockTiptapEditor: vi.fn(),
  mockFetchExportMarkdown: vi
    .fn()
    .mockResolvedValue({ content: "# Test\n\nContent" }),
  mockFetchExportHtml: vi.fn().mockResolvedValue({
    content: "<!DOCTYPE html><html><body><h1>Test</h1></body></html>",
  }),
  mockImportDirectoryMutateAsync: vi.fn().mockResolvedValue({}),
  mockUpdateNodeMutateAsync: vi.fn().mockResolvedValue({}),
  mockMediaUploadMutateAsync: vi.fn().mockResolvedValue({ id: "media-1" }),
  mockGetByIdFetch: vi.fn().mockResolvedValue(null),
  mockGetDescendantsFetch: vi.fn().mockResolvedValue([]),
  mockInvalidateGetAllProjects: vi.fn(),
  mockInvalidateGetById: vi.fn(),
  mockInvalidateGetChildren: vi.fn(),
  mockInvalidateGetDescendants: vi.fn(),
  folderChildrenData: [] as Array<Record<string, unknown>>,
  projectImagesData: [] as Array<{
    id: string;
    filename: string;
    mimeType: string;
  }>,
  selectedNodeData: {
    id: "node-1",
    name: "Test Note",
    type: "note",
    parentId: "proj-1",
    content: null,
    metadata: null,
    position: 0,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/projects",
  useSearchParams: () => ({
    get: mockSearchParamGet,
  }),
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
    currentProjectId: currentProjectState.value,
    setCurrentProject: mockSetCurrentProject,
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
  TiptapEditor: (props: MockTiptapEditorProps) => {
    mockTiptapEditor(props);
    const { onInsertImage } = props as { onInsertImage?: () => void };
    return (
      <>
        <div data-testid="tiptap-editor" />
        <button
          type="button"
          data-testid="tiptap-editor-insert-image"
          onClick={() => onInsertImage?.()}
        >
          Open image dialog
        </button>
      </>
    );
  },
  ImageUpload: () => null,
  LinkPickerDialog: () => null,
}));

// Mock tag components
vi.mock("@/components/tags", () => ({
  TagManager: () => <div data-testid="tag-manager" />,
  TagPicker: () => <div data-testid="tag-picker" />,
  TagBrowser: () => <div data-testid="tag-browser" />,
}));

// Mock provenance components
vi.mock("@/components/provenance", () => ({
  NodeAttribution: () => <div data-testid="node-attribution" />,
}));

// Mock FilterPanel component
vi.mock("@/components/navigation", () => ({
  FilterPanel: () => <div data-testid="filter-panel" />,
}));

// Mock ChatSidebar component
vi.mock("@/components/chat", () => ({
  ChatSidebar: () => <div data-testid="chat-sidebar" />,
}));

vi.mock("@/app/[locale]/(app)/projects/projects-import-directory", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/[locale]/(app)/projects/projects-import-directory")
  >("@/app/[locale]/(app)/projects/projects-import-directory");

  return {
    ...actual,
    prepareImportDirectoryWorkflow: vi.fn(
      actual.prepareImportDirectoryWorkflow,
    ),
  };
});

// Mock FileTree component - calls onSelectNode on mount to simulate selecting a node
vi.mock("@/components/file-tree", () => ({
  FileTree: React.forwardRef<FileTreeHandle, MockFileTreeProps>(
    function MockFileTree(
      { onSelectNode },
      _ref: React.ForwardedRef<FileTreeHandle>,
    ) {
      React.useEffect(() => {
        onSelectNode("node-1");
      }, [onSelectNode]);

      return <div data-testid="file-tree" />;
    },
  ),
  CreateNodeDialog: function MockCreateNodeDialog({ open }: { open: boolean }) {
    return open ? <div data-testid="create-node-dialog" /> : null;
  },
  RenameDialog: function MockRenameDialog({ open }: { open: boolean }) {
    return open ? <div data-testid="rename-dialog" /> : null;
  },
  NodeContextMenu: function MockNodeContextMenu({ open }: { open: boolean }) {
    return open ? <div data-testid="context-menu" /> : null;
  },
  BulkTagBar: () => null,
}));

// Mock tRPC
vi.mock("@/lib/trpc", () => {
  const makeMutation = ({
    mutate = vi.fn(),
    mutateAsync = vi.fn().mockResolvedValue({}),
  }: {
    mutate?: ReturnType<typeof vi.fn>;
    mutateAsync?: ReturnType<typeof vi.fn>;
  } = {}) => ({
    mutate,
    mutateAsync,
    isPending: false,
    isLoading: false,
    error: null,
  });

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
      getChildren: {
        useQuery: vi.fn(() => ({
          data: folderChildrenData,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        })),
      },
      getDescendants: {
        useQuery: vi.fn(() => ({
          data: [],
          isLoading: false,
          error: null,
        })),
      },
      create: {
        useMutation: vi.fn(() =>
          makeMutation({ mutate: mockCreateProjectMutate }),
        ),
      },
      update: {
        useMutation: vi.fn(() =>
          makeMutation({ mutateAsync: mockUpdateNodeMutateAsync }),
        ),
      },
      delete: { useMutation: vi.fn(() => makeMutation()) },
      move: { useMutation: vi.fn(() => makeMutation()) },
      importDirectory: {
        useMutation: vi.fn(() =>
          makeMutation({ mutateAsync: mockImportDirectoryMutateAsync }),
        ),
      },
      toggleFavorite: { useMutation: vi.fn(() => makeMutation()) },
      getFavorites: {
        useQuery: vi.fn(() => ({ data: [], isLoading: false, error: null })),
      },
    },
    tags: {
      getNodesByTags: {
        useQuery: vi.fn(() => ({
          data: [],
          isLoading: false,
          error: null,
        })),
      },
      bulkAddToNodes: { useMutation: vi.fn(() => makeMutation()) },
      bulkRemoveFromNodes: { useMutation: vi.fn(() => makeMutation()) },
    },
    search: {
      keywordSearch: {
        useQuery: vi.fn(() => ({
          data: [],
          isLoading: false,
          error: null,
        })),
      },
    },
    media: {
      getByProject: {
        useQuery: vi.fn(() => ({
          data: projectImagesData,
          isLoading: false,
          error: null,
        })),
      },
      upload: {
        useMutation: vi.fn(() =>
          makeMutation({ mutateAsync: mockMediaUploadMutateAsync }),
        ),
      },
      generateImage: { useMutation: vi.fn(() => makeMutation()) },
      getFirstImageByNodes: {
        useQuery: vi.fn(() => ({ data: {}, isLoading: false, error: null })),
      },
    },
    preferences: {
      getAppPreference: {
        useQuery: vi.fn(() => ({
          data: { value: false },
          isLoading: false,
          error: null,
        })),
      },
      getAllAppPreferences: {
        useQuery: vi.fn(() => ({
          data: {},
          isLoading: false,
          error: null,
        })),
      },
      setAppPreference: { useMutation: vi.fn(() => makeMutation()) },
      setAppPreferences: { useMutation: vi.fn(() => makeMutation()) },
      deleteAppPreference: { useMutation: vi.fn(() => makeMutation()) },
      getMasterKey: {
        useQuery: vi.fn(() => ({
          data: { masterKey: null },
          isLoading: false,
          error: null,
        })),
      },
    },
    useUtils: vi.fn(() => ({
      nodes: {
        getAllProjects: {
          invalidate: mockInvalidateGetAllProjects,
          refetch: vi.fn(),
        },
        getById: {
          invalidate: mockInvalidateGetById,
          fetch: mockGetByIdFetch,
        },
        getChildren: { invalidate: mockInvalidateGetChildren },
        getFavorites: { invalidate: vi.fn() },
        getDescendants: {
          fetch: mockGetDescendantsFetch,
          invalidate: mockInvalidateGetDescendants,
        },
        exportMarkdown: { fetch: mockFetchExportMarkdown },
        exportHtml: { fetch: mockFetchExportHtml },
      },
      media: {
        getDownloadUrl: {
          fetch: vi
            .fn()
            .mockResolvedValue({ url: "https://minio.test/img.png" }),
        },
      },
      tags: {
        getNodeTags: { invalidate: vi.fn() },
      },
      preferences: {
        getAllAppPreferences: {
          invalidate: vi.fn(),
        },
      },
    })),
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };

  return { trpc: mockTrpc, getTRPCClient: vi.fn() };
});

// Import the page component AFTER mocks
import * as projectsImportDirectory from "@/app/[locale]/(app)/projects/projects-import-directory";
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
    currentProjectState.value = "proj-1";
    mockSearchParamGet.mockImplementation(
      (_key: string): string | null => null,
    );
    mockCreateProjectMutate.mockReset();
    selectedNodeData.name = "Test Note";
    selectedNodeData.id = "node-1";
    selectedNodeData.type = "note";
    selectedNodeData.parentId = "proj-1";
    selectedNodeData.content = null;
    folderChildrenData.length = 0;
    projectImagesData.length = 0;
    mockImportDirectoryMutateAsync.mockReset();
    mockImportDirectoryMutateAsync.mockResolvedValue({});
    mockUpdateNodeMutateAsync.mockReset();
    mockUpdateNodeMutateAsync.mockResolvedValue({});
    mockMediaUploadMutateAsync.mockReset();
    mockMediaUploadMutateAsync.mockResolvedValue({ id: "media-1" });
    mockGetByIdFetch.mockReset();
    mockGetByIdFetch.mockResolvedValue(null);
    mockGetDescendantsFetch.mockReset();
    mockGetDescendantsFetch.mockResolvedValue([]);
  });

  it("should render a responsive folder card grid for folder selections", async () => {
    selectedNodeData.name = "Story Folder";
    selectedNodeData.type = "folder";
    folderChildrenData.push(
      {
        id: "child-note-1",
        name: "Scene One",
        type: "note",
        parentId: "node-1",
        content: { type: "doc", content: [] },
        metadata: null,
        position: 0,
      },
      {
        id: "child-note-2",
        name: "Scene Two",
        type: "note",
        parentId: "node-1",
        content: { type: "doc", content: [] },
        metadata: null,
        position: 1,
      },
    );

    render(<ProjectsPage />, { wrapper: TestWrapper });

    const folderCardGrid = await screen.findByTestId("folder-card-grid");

    expect(folderCardGrid).toHaveClass("grid", "w-full");
    expect(folderCardGrid.className).toContain("max-w-[calc(18rem*4+3rem)]");
    expect(folderCardGrid.className).toContain(
      "[grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]",
    );
    expect(screen.getByText("Scene One")).toBeInTheDocument();
    expect(screen.getByText("Scene Two")).toBeInTheDocument();
  });

  it("should render image thumbnails in the existing image picker tab", async () => {
    projectImagesData.push({
      id: "media-existing-1",
      filename: "castle-map.png",
      mimeType: "image/png",
    });

    render(<ProjectsPage />, { wrapper: TestWrapper });

    fireEvent.click(screen.getByTestId("tiptap-editor-insert-image"));
    expect(screen.getByTestId("image-upload-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByText("imageUpload.tabExisting"));

    const existingImageThumbnail = await screen.findByRole("img", {
      name: "castle-map.png",
    });

    expect(existingImageThumbnail).toHaveAttribute(
      "src",
      getMediaAttachmentUrl("media-existing-1"),
    );
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
    const mockFocus = vi.fn();
    const mockAddEventListener = vi.fn(
      (eventName: string, listener: EventListenerOrEventListenerObject) => {
        if (eventName === "load") {
          if (typeof listener === "function") {
            listener(new Event("load"));
          } else {
            listener.handleEvent(new Event("load"));
          }
        }
      },
    );
    const mockRemoveEventListener = vi.fn();
    const mockWindowObj = {
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      focus: mockFocus,
      print: mockPrint,
    };
    const originalOpen = window.open;
    const mockOpenFn = vi.fn().mockReturnValue(mockWindowObj);
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:test-url");
    const mockRevokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;
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
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockOpenFn).toHaveBeenCalledWith("blob:test-url", "_blank");
      expect(mockFocus).toHaveBeenCalled();
      expect(mockPrint).toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith("exportSuccess", "success");
    });

    // Restore
    Object.defineProperty(window, "open", {
      value: originalOpen,
      writable: true,
      configurable: true,
    });
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
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

  it("should rewrite imported internal links when fetched imported content is a JSON string", async () => {
    mockImportDirectoryMutateAsync.mockResolvedValueOnce({
      imported: 2,
      folders: 1,
      projectId: "proj-imported",
      importTargetNodeId: "proj-imported",
      nodeMap: {
        "pathfinders/places/dueling_hall.md": "node-dueling-hall",
        "pathfinders/places/bedlam.md": "node-bedlam",
      },
    });

    mockGetByIdFetch.mockResolvedValueOnce({
      id: "node-dueling-hall",
      content: JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Bedlam",
                marks: [
                  {
                    type: "link",
                    attrs: { href: "./bedlam.md" },
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    render(<ProjectsPage />, { wrapper: TestWrapper });

    const importedMarkdownFile = new File(
      ["[Bedlam](./bedlam.md)"],
      "dueling_hall.md",
      { type: "text/markdown" },
    );
    Object.defineProperty(importedMarkdownFile, "text", {
      value: vi.fn().mockResolvedValue("[Bedlam](./bedlam.md)"),
    });
    Object.defineProperty(importedMarkdownFile, "webkitRelativePath", {
      value: "pathfinders/places/dueling_hall.md",
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId("import-directory-input"), {
        target: { files: [importedMarkdownFile] },
      });
    });

    await waitFor(() => {
      expect(mockUpdateNodeMutateAsync).toHaveBeenCalledWith({
        id: "node-dueling-hall",
        data: {
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Bedlam",
                    marks: [
                      {
                        type: "link",
                        attrs: { href: "?node=node-bedlam" },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      });
    });

    expect(mockSetCurrentProject).toHaveBeenCalledWith("proj-imported");
    expect(mockPush).toHaveBeenCalledWith("/projects");
  });

  it("should heal older imported notes after a later import adds the missing target", async () => {
    mockImportDirectoryMutateAsync.mockResolvedValueOnce({
      imported: 1,
      folders: 0,
      projectId: "proj-1",
      importTargetNodeId: "proj-1",
      nodeMap: {
        "incoming/c.md": "node-c",
      },
    });

    mockGetByIdFetch.mockResolvedValueOnce({
      id: "node-c",
      content: { type: "doc", content: [] },
    });

    mockGetDescendantsFetch.mockResolvedValueOnce([
      {
        id: "node-b",
        name: "Page B",
        type: "note",
        parentId: "proj-1",
        metadata: { importSourcePath: "incoming/b.md" },
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Page C",
                  marks: [
                    {
                      type: "link",
                      attrs: { href: "./c.md" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        id: "node-c",
        name: "Page C",
        type: "note",
        parentId: "proj-1",
        metadata: { importSourcePath: "incoming/c.md" },
        content: { type: "doc", content: [] },
      },
    ]);

    render(<ProjectsPage />, { wrapper: TestWrapper });

    const laterImportedMarkdownFile = new File(["# Page C"], "c.md", {
      type: "text/markdown",
    });
    Object.defineProperty(laterImportedMarkdownFile, "text", {
      value: vi.fn().mockResolvedValue("# Page C"),
    });
    Object.defineProperty(laterImportedMarkdownFile, "webkitRelativePath", {
      value: "incoming/c.md",
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId("import-directory-input"), {
        target: { files: [laterImportedMarkdownFile] },
      });
    });

    await waitFor(() => {
      expect(mockGetDescendantsFetch).toHaveBeenCalledWith({
        nodeId: "proj-1",
      });
    });

    await waitFor(() => {
      expect(mockUpdateNodeMutateAsync).toHaveBeenCalledWith({
        id: "node-b",
        data: {
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Page C",
                    marks: [
                      {
                        type: "link",
                        attrs: { href: "?node=node-c" },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      });
    });
  });

  it("should preserve imported image URLs when the healing pass revisits a note", async () => {
    mockImportDirectoryMutateAsync.mockResolvedValueOnce({
      imported: 3,
      folders: 0,
      projectId: "proj-imported",
      importTargetNodeId: "proj-imported",
      nodeMap: {
        "incoming/b.md": "node-b",
        "incoming/c.md": "node-c",
        "incoming/map.md": "node-map",
      },
    });

    const staleImportedNoteContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                src: "./map.png",
                alt: "Map",
                title: null,
              },
            },
            {
              type: "text",
              text: "Page C",
              marks: [
                {
                  type: "link",
                  attrs: { href: "./c.md" },
                },
              ],
            },
          ],
        },
      ],
    };

    const imagePatchedNoteContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                src: getMediaAttachmentUrl("media-1"),
                alt: "Map",
                title: null,
              },
            },
            {
              type: "text",
              text: "Page C",
              marks: [
                {
                  type: "link",
                  attrs: { href: "./c.md" },
                },
              ],
            },
          ],
        },
      ],
    };

    const fullyPatchedNoteContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                src: getMediaAttachmentUrl("media-1"),
                alt: "Map",
                title: null,
              },
            },
            {
              type: "text",
              text: "Page C",
              marks: [
                {
                  type: "link",
                  attrs: { href: "?node=node-c" },
                },
              ],
            },
          ],
        },
      ],
    };

    mockGetByIdFetch
      .mockResolvedValueOnce({
        id: "node-b",
        content: staleImportedNoteContent,
      })
      .mockResolvedValueOnce({
        id: "node-map",
        content: {
          type: "doc",
          content: [
            {
              type: "image",
              attrs: {
                src: "incoming/map.png",
                alt: "map",
                title: null,
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        id: "node-b",
        content: imagePatchedNoteContent,
      })
      .mockResolvedValueOnce({
        id: "node-c",
        content: { type: "doc", content: [] },
      });

    mockGetDescendantsFetch.mockResolvedValue([
      {
        id: "node-b",
        name: "Page B",
        type: "note",
        parentId: "proj-imported",
        metadata: { importSourcePath: "incoming/b.md" },
        content: staleImportedNoteContent,
      },
      {
        id: "node-c",
        name: "Page C",
        type: "note",
        parentId: "proj-imported",
        metadata: { importSourcePath: "incoming/c.md" },
        content: { type: "doc", content: [] },
      },
      {
        id: "node-map",
        name: "map",
        type: "note",
        parentId: "proj-imported",
        metadata: { importSourcePath: "incoming/map.md" },
        content: {
          type: "doc",
          content: [
            {
              type: "image",
              attrs: {
                src: "incoming/map.png",
                alt: "map",
                title: null,
              },
            },
          ],
        },
      },
    ]);

    mockInvalidateGetDescendants.mockImplementation(() => {
      mockGetDescendantsFetch.mockResolvedValue([
        {
          id: "node-b",
          name: "Page B",
          type: "note",
          parentId: "proj-imported",
          metadata: { importSourcePath: "incoming/b.md" },
          content: fullyPatchedNoteContent,
        },
        {
          id: "node-c",
          name: "Page C",
          type: "note",
          parentId: "proj-imported",
          metadata: { importSourcePath: "incoming/c.md" },
          content: { type: "doc", content: [] },
        },
        {
          id: "node-map",
          name: "map",
          type: "note",
          parentId: "proj-imported",
          metadata: { importSourcePath: "incoming/map.md" },
          content: {
            type: "doc",
            content: [
              {
                type: "image",
                attrs: {
                  src: getMediaAttachmentUrl("media-1"),
                  alt: "map",
                  title: null,
                },
              },
            ],
          },
        },
      ]);
    });

    render(<ProjectsPage />, { wrapper: TestWrapper });

    const importedMarkdownFile = new File(
      ["![Map](./map.png) [Page C](./c.md)"],
      "b.md",
      { type: "text/markdown" },
    );
    Object.defineProperty(importedMarkdownFile, "text", {
      value: vi.fn().mockResolvedValue("![Map](./map.png) [Page C](./c.md)"),
    });
    Object.defineProperty(importedMarkdownFile, "webkitRelativePath", {
      value: "incoming/b.md",
    });

    const linkedMarkdownFile = new File(["# Page C"], "c.md", {
      type: "text/markdown",
    });
    Object.defineProperty(linkedMarkdownFile, "text", {
      value: vi.fn().mockResolvedValue("# Page C"),
    });
    Object.defineProperty(linkedMarkdownFile, "webkitRelativePath", {
      value: "incoming/c.md",
    });

    const importedImageFile = new File(["image-bytes"], "map.png", {
      type: "image/png",
    });
    Object.defineProperty(importedImageFile, "arrayBuffer", {
      value: vi
        .fn()
        .mockResolvedValue(new Uint8Array([137, 80, 78, 71]).buffer),
    });
    Object.defineProperty(importedImageFile, "webkitRelativePath", {
      value: "incoming/map.png",
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId("import-directory-input"), {
        target: {
          files: [importedMarkdownFile, linkedMarkdownFile, importedImageFile],
        },
      });
    });

    await waitFor(() => {
      expect(mockInvalidateGetDescendants).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockUpdateNodeMutateAsync).toHaveBeenCalledWith({
        id: "node-b",
        data: { content: imagePatchedNoteContent },
      });
    });

    expect(
      mockUpdateNodeMutateAsync.mock.calls.some(
        ([payload]) =>
          payload?.id === "node-b" &&
          JSON.stringify(payload.data?.content).includes('"src":"./map.png"'),
      ),
    ).toBe(false);
  });

  it("should create a blank project from the create project dialog", async () => {
    mockSearchParamGet.mockImplementation((key: string) =>
      key === "list" ? "1" : null,
    );

    render(<ProjectsPage />, { wrapper: TestWrapper });

    fireEvent.click(screen.getByText("createProject"));
    fireEvent.change(screen.getByLabelText("createDialog.name"), {
      target: { value: "Blank Pathfinder" },
    });
    fireEvent.click(screen.getByText("createDialog.createBlank"));

    expect(mockCreateProjectMutate).toHaveBeenCalledWith({
      type: "project",
      name: "Blank Pathfinder",
      parentId: null,
    });
  });

  it("should import from folder from the create project dialog", async () => {
    mockSearchParamGet.mockImplementation((key: string) =>
      key === "list" ? "1" : null,
    );
    mockImportDirectoryMutateAsync.mockResolvedValueOnce({
      imported: 1,
      folders: 0,
      projectId: "proj-imported",
      importTargetNodeId: "proj-imported",
      nodeMap: {
        "pathfinders/readme.md": "node-imported",
      },
    });

    render(<ProjectsPage />, { wrapper: TestWrapper });

    fireEvent.click(screen.getByText("createProject"));
    fireEvent.change(screen.getByLabelText("createDialog.name"), {
      target: { value: "My Imported Project" },
    });
    fireEvent.click(screen.getByText("createDialog.importFromFolder"));

    const importedMarkdownFile = new File(["# Imported"], "readme.md", {
      type: "text/markdown",
    });
    Object.defineProperty(importedMarkdownFile, "text", {
      value: vi.fn().mockResolvedValue("# Imported"),
    });
    Object.defineProperty(importedMarkdownFile, "webkitRelativePath", {
      value: "pathfinders/readme.md",
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId("import-directory-input"), {
        target: { files: [importedMarkdownFile] },
      });
    });

    await waitFor(() => {
      expect(mockImportDirectoryMutateAsync).toHaveBeenCalledWith({
        projectName: "My Imported Project",
        parentNodeId: undefined,
        files: expect.any(Array),
      });
    });
  });

  it("should not show a separate import directory button on the projects list", () => {
    mockSearchParamGet.mockImplementation((key: string) =>
      key === "list" ? "1" : null,
    );

    render(<ProjectsPage />, { wrapper: TestWrapper });

    expect(screen.queryByText("Import Directory")).not.toBeInTheDocument();
  });

  it("should create a new project when importing from the projects list", async () => {
    mockSearchParamGet.mockImplementation((key: string) =>
      key === "list" ? "1" : null,
    );
    mockImportDirectoryMutateAsync.mockResolvedValueOnce({
      imported: 1,
      folders: 0,
      projectId: "proj-imported",
      importTargetNodeId: "proj-imported",
      nodeMap: {
        "pathfinders/readme.md": "node-imported",
      },
    });

    render(<ProjectsPage />, { wrapper: TestWrapper });

    const importedMarkdownFile = new File(["# Imported"], "readme.md", {
      type: "text/markdown",
    });
    Object.defineProperty(importedMarkdownFile, "text", {
      value: vi.fn().mockResolvedValue("# Imported"),
    });
    Object.defineProperty(importedMarkdownFile, "webkitRelativePath", {
      value: "pathfinders/readme.md",
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId("import-directory-input"), {
        target: { files: [importedMarkdownFile] },
      });
    });

    await waitFor(() => {
      expect(mockImportDirectoryMutateAsync).toHaveBeenCalledWith({
        projectName: "pathfinders",
        parentNodeId: undefined,
        files: expect.any(Array),
      });
    });

    expect(mockSetCurrentProject).toHaveBeenCalledWith("proj-imported");
  });

  it("should prompt for a project name when importing loose files", async () => {
    mockSearchParamGet.mockImplementation((key: string) =>
      key === "list" ? "1" : null,
    );
    mockImportDirectoryMutateAsync.mockResolvedValueOnce({
      imported: 2,
      folders: 0,
      projectId: "proj-imported",
      importTargetNodeId: "proj-imported",
      nodeMap: {
        "alpha.md": "node-alpha",
        "beta.md": "node-beta",
      },
    });
    vi.mocked(
      projectsImportDirectory.prepareImportDirectoryWorkflow,
    ).mockResolvedValueOnce({
      kind: "prompt-for-project-name",
      initialProjectName: "",
      createNewProject: true,
      entries: [
        { path: "alpha.md", content: { type: "doc", content: [] } },
        { path: "beta.md", content: { type: "doc", content: [] } },
      ],
      imageFilesByNotePath: new Map(),
    });

    render(<ProjectsPage />, { wrapper: TestWrapper });

    const alphaMarkdownFile = new File(["# Alpha"], "alpha.md", {
      type: "text/markdown",
    });

    const betaMarkdownFile = new File(["# Beta"], "beta.md", {
      type: "text/markdown",
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId("import-directory-input"), {
        target: { files: [alphaMarkdownFile, betaMarkdownFile] },
      });
    });

    await waitFor(() => {
      expect(
        projectsImportDirectory.prepareImportDirectoryWorkflow,
      ).toHaveBeenCalledWith({
        allFiles: [alphaMarkdownFile, betaMarkdownFile],
        preferredProjectName: "",
        createNewProject: true,
      });
    });

    const projectNameInput = await screen.findByPlaceholderText("Project name");

    fireEvent.change(projectNameInput, {
      target: { value: "Loose Files Project" },
    });
    fireEvent.keyDown(projectNameInput, { key: "Enter" });

    await waitFor(() => {
      expect(mockImportDirectoryMutateAsync).toHaveBeenCalledWith({
        projectName: "Loose Files Project",
        parentNodeId: undefined,
        files: expect.any(Array),
      });
    });

    expect(mockSetCurrentProject).toHaveBeenCalledWith("proj-imported");
  });

  it("should import into the selected folder inside the workspace", async () => {
    selectedNodeData.id = "folder-1";
    selectedNodeData.name = "Places";
    selectedNodeData.type = "folder";
    selectedNodeData.parentId = "proj-1";
    mockImportDirectoryMutateAsync.mockResolvedValueOnce({
      imported: 1,
      folders: 0,
      projectId: "proj-1",
      importTargetNodeId: "folder-1",
      nodeMap: {
        "pathfinders/bedlam.md": "node-bedlam",
      },
    });

    render(<ProjectsPage />, { wrapper: TestWrapper });

    const importedMarkdownFile = new File(["# Bedlam"], "bedlam.md", {
      type: "text/markdown",
    });
    Object.defineProperty(importedMarkdownFile, "text", {
      value: vi.fn().mockResolvedValue("# Bedlam"),
    });
    Object.defineProperty(importedMarkdownFile, "webkitRelativePath", {
      value: "pathfinders/bedlam.md",
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId("import-directory-input"), {
        target: { files: [importedMarkdownFile] },
      });
    });

    await waitFor(() => {
      expect(mockImportDirectoryMutateAsync).toHaveBeenCalledWith({
        projectName: "pathfinders",
        parentNodeId: "folder-1",
        files: expect.any(Array),
      });
    });

    expect(mockSetCurrentProject).toHaveBeenCalledWith("proj-1");
  });
});
