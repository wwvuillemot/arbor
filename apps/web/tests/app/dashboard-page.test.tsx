import * as React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DashboardPage from "@/app/[locale]/(app)/dashboard/page";

type MockSettingsNode = {
  id: string;
  name: string;
  type: "project" | "folder";
  projectId: string;
  summary?: string | null;
  metadata: Record<string, unknown>;
};

const mockDeleteMutate = vi.fn();
const mockPush = vi.fn();
const capturedDialogNodes: MockSettingsNode[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/hooks/use-current-project", () => ({
  useCurrentProject: () => ({ setCurrentProject: vi.fn() }),
}));

vi.mock("@/components/note-card", () => ({
  NoteCard: ({
    node,
    onSettings,
  }: {
    node: { name: string };
    onSettings?: () => void;
  }) => (
    <div>
      <span>{node.name}</span>
      {onSettings ? <button onClick={onSettings}>Open settings</button> : null}
    </div>
  ),
}));

vi.mock("@/app/[locale]/(app)/projects/project-settings-dialog", () => ({
  ProjectSettingsDialog: ({ node }: { node: MockSettingsNode }) => {
    capturedDialogNodes.push(node);
    return <div data-testid="project-settings-dialog">{node.name}</div>;
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    nodes: {
      getAllProjects: {
        useQuery: vi.fn(() => ({
          data: [
            {
              id: "project-1",
              name: "Alpha Project",
              summary: "Project summary",
              metadata: { heroAttachmentId: "hero-1" },
            },
          ],
          isLoading: false,
        })),
      },
      getAllFavorites: {
        useQuery: vi.fn(() => ({ data: [], isLoading: false })),
      },
      delete: {
        useMutation: vi.fn(() => ({ mutate: mockDeleteMutate })),
      },
      toggleFavorite: {
        useMutation: vi.fn(() => ({ mutate: vi.fn() })),
      },
    },
    chat: {
      listThreads: {
        useQuery: vi.fn(() => ({ data: [], isLoading: false })),
      },
    },
    useUtils: vi.fn(() => ({
      nodes: { getAllProjects: { invalidate: vi.fn() } },
    })),
  },
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedDialogNodes.length = 0;
  });

  it("passes a project settings node to the project settings dialog", () => {
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    expect(screen.getByTestId("project-settings-dialog")).toBeInTheDocument();
    expect(capturedDialogNodes).toHaveLength(1);
    expect(capturedDialogNodes[0]).toEqual({
      id: "project-1",
      name: "Alpha Project",
      type: "project",
      projectId: "project-1",
      summary: "Project summary",
      metadata: { heroAttachmentId: "hero-1" },
    });
  });
});
