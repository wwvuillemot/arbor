import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  ProjectSettingsDialog,
  type ProjectSettingsNode,
} from "@/app/[locale]/(app)/projects/project-settings-dialog";
import { getMediaAttachmentUrl } from "@/lib/media-url";

vi.mock("@/contexts/toast-context", () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn(), toasts: [] }),
}));

const {
  mockMediaGetByProjectUseQuery,
  mockSetHeroImageMutate,
  mockUpdateNodeMutate,
  mockSetAppPreferenceMutate,
  mockInvalidateProjects,
  mockInvalidateNodeById,
  mockInvalidateChildren,
  mockInvalidateDescendants,
  mockInvalidateAppPreferences,
  projectImagesData,
} = vi.hoisted(() => ({
  mockMediaGetByProjectUseQuery: vi.fn(),
  mockSetHeroImageMutate: vi.fn(),
  mockUpdateNodeMutate: vi.fn(),
  mockSetAppPreferenceMutate: vi.fn(),
  mockInvalidateProjects: vi.fn(),
  mockInvalidateNodeById: vi.fn(),
  mockInvalidateChildren: vi.fn(),
  mockInvalidateDescendants: vi.fn(),
  mockInvalidateAppPreferences: vi.fn(),
  projectImagesData: [] as Array<{
    id: string;
    filename: string;
    mimeType: string;
  }>,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/trpc", () => {
  function createMutationResult(
    mutateSpy: ReturnType<typeof vi.fn>,
    options?: { onSuccess?: () => void },
  ) {
    return {
      mutate: (input: unknown) => {
        mutateSpy(input);
        options?.onSuccess?.();
      },
      mutateAsync: vi.fn(async (input: unknown) => {
        mutateSpy(input);
        options?.onSuccess?.();
        return {};
      }),
      isPending: false,
      isLoading: false,
      error: null,
    };
  }

  return {
    trpc: {
      media: {
        getByProject: {
          useQuery: mockMediaGetByProjectUseQuery,
        },
        upload: {
          useMutation: vi.fn(() => createMutationResult(vi.fn())),
        },
      },
      nodes: {
        setHeroImage: {
          useMutation: vi.fn((options?: { onSuccess?: () => void }) =>
            createMutationResult(mockSetHeroImageMutate, options),
          ),
        },
        update: {
          useMutation: vi.fn((options?: { onSuccess?: () => void }) =>
            createMutationResult(mockUpdateNodeMutate, options),
          ),
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
        setAppPreference: {
          useMutation: vi.fn(() =>
            createMutationResult(mockSetAppPreferenceMutate),
          ),
        },
      },
      useUtils: vi.fn(() => ({
        nodes: {
          getAllProjects: { invalidate: mockInvalidateProjects },
          getById: { invalidate: mockInvalidateNodeById },
          getChildren: { invalidate: mockInvalidateChildren },
          getDescendants: { invalidate: mockInvalidateDescendants },
        },
        media: {
          getByProject: { invalidate: vi.fn() },
        },
        preferences: {
          getAllAppPreferences: { invalidate: mockInvalidateAppPreferences },
        },
      })),
    },
  };
});

function createFolderNode(
  overrides: Partial<ProjectSettingsNode> = {},
): ProjectSettingsNode {
  return {
    id: "folder-1",
    name: "Story Folder",
    type: "folder",
    projectId: "proj-1",
    summary: null,
    metadata: {},
    ...overrides,
  };
}

describe("ProjectSettingsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectImagesData.length = 0;
    mockMediaGetByProjectUseQuery.mockImplementation(() => ({
      data: projectImagesData,
      isLoading: false,
      error: null,
    }));
  });

  it("shows folder appearance settings without the style tab", async () => {
    render(
      <ProjectSettingsDialog
        open
        onClose={vi.fn()}
        node={createFolderNode({
          metadata: { heroAttachmentId: "existing-hero" },
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "tabGeneral" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "tabAppearance" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "tabStyle" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "tabAppearance" }));

    await waitFor(() => {
      expect(mockMediaGetByProjectUseQuery).toHaveBeenLastCalledWith(
        { projectId: "proj-1" },
        expect.objectContaining({ enabled: true, staleTime: 30_000 }),
      );
    });

    expect(screen.getByAltText("Hero")).toHaveAttribute(
      "src",
      getMediaAttachmentUrl("existing-hero"),
    );
  });

  it("sets a folder hero image from the project image library", async () => {
    projectImagesData.push(
      {
        id: "image-1",
        filename: "cover.png",
        mimeType: "image/png",
      },
      {
        id: "document-1",
        filename: "notes.txt",
        mimeType: "text/plain",
      },
    );

    render(
      <ProjectSettingsDialog
        open
        onClose={vi.fn()}
        node={createFolderNode()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "tabAppearance" }));

    const heroImageButton = screen.getByAltText("cover.png").closest("button");
    expect(heroImageButton).not.toBeNull();
    expect(screen.queryByAltText("notes.txt")).not.toBeInTheDocument();

    fireEvent.click(heroImageButton!);

    await waitFor(() => {
      expect(mockSetHeroImageMutate).toHaveBeenCalledWith({
        nodeId: "folder-1",
        attachmentId: "image-1",
      });
    });

    expect(screen.getByAltText("Hero")).toHaveAttribute(
      "src",
      getMediaAttachmentUrl("image-1"),
    );
  });
});
