import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import type { Editor } from "@tiptap/react";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { getTRPCClient, trpc } from "@/lib/trpc";

const TEST_NODE_ID = "11111111-1111-1111-1111-111111111111";
const HISTORY_QUERY_INPUT = { nodeId: TEST_NODE_ID, limit: 50 };
type TiptapDocument = Record<string, unknown>;

const INITIAL_DOCUMENT: TiptapDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Hello world" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "AI helper note" }],
    },
  ],
};
const INITIAL_AI_HISTORY = [
  {
    id: "history-1",
    nodeId: TEST_NODE_ID,
    version: 1,
    actorType: "llm",
    actorId: "llm:gpt-4o",
    createdAt: "2024-01-01T00:00:00.000Z",
    metadata: { model: "gpt-4o" },
    contentBefore: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Plain helper note" }],
        },
      ],
    },
    contentAfter: INITIAL_DOCUMENT,
  },
];
const REFRESHED_AI_HISTORY = [
  {
    ...INITIAL_AI_HISTORY[0],
    id: "history-2",
    version: 2,
    createdAt: "2024-01-01T00:00:05.000Z",
  },
];

function normalizeEditorText(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function buildExternallySyncedDocument(
  currentDocument: TiptapDocument,
): TiptapDocument {
  return {
    ...currentDocument,
    content: [
      ...(((currentDocument.content as unknown[]) ?? []).slice(0, 1) as Record<
        string,
        unknown
      >[]),
      {
        type: "paragraph",
        content: [{ type: "text", text: "AI helper note refreshed" }],
      },
    ],
  };
}

function createProvidersHarness(initialHistoryData: unknown[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const trpcClient = getTRPCClient();

  queryClient.setQueryData(
    getQueryKey(trpc.provenance.getHistory, HISTORY_QUERY_INPUT, "query"),
    initialHistoryData,
  );

  return {
    queryClient,
    Providers({ children }: { children: React.ReactNode }) {
      return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </trpc.Provider>
      );
    },
  };
}

describe("TiptapEditor integration", () => {
  it("keeps change propagation working after switching into edit mode", async () => {
    const handleChange = vi.fn();
    const editorRef = React.createRef<Editor | null>();
    const { Providers } = createProvidersHarness();

    const { rerender } = render(
      <TiptapEditor
        content={{ type: "doc", content: [] }}
        editable={false}
        editorRef={editorRef}
      />,
      { wrapper: Providers },
    );

    await waitFor(() => expect(editorRef.current).not.toBeNull());
    await waitFor(() => expect(editorRef.current?.isEditable).toBe(false));

    rerender(
      <TiptapEditor
        content={{ type: "doc", content: [] }}
        editable={true}
        onChange={handleChange}
        editorRef={editorRef}
      />,
    );

    await waitFor(() => expect(editorRef.current?.isEditable).toBe(true));

    act(() => {
      editorRef.current?.commands.insertContent("Edited after toggle");
    });

    await waitFor(() => expect(handleChange).toHaveBeenCalled());

    const latestChangedContent = handleChange.mock.calls.at(-1)?.[0];

    expect(latestChangedContent).toMatchObject({ type: "doc" });
    expect(JSON.stringify(latestChangedContent)).toContain(
      "Edited after toggle",
    );
  });

  it("keeps the insertion point stable when parent state echoes local edits", async () => {
    const editorRef = React.createRef<Editor | null>();
    const { Providers } = createProvidersHarness();

    function StatefulEditorHarness() {
      const [content, setContent] = React.useState<TiptapDocument>({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello world" }],
          },
        ],
      });
      const handleContentChange = React.useCallback(
        (nextContent: TiptapDocument) => {
          setContent(nextContent);
        },
        [],
      );

      return (
        <TiptapEditor
          content={content}
          editable={true}
          onChange={handleContentChange}
          editorRef={editorRef}
        />
      );
    }

    render(<StatefulEditorHarness />, { wrapper: Providers });

    await waitFor(() => expect(editorRef.current).not.toBeNull());
    await waitFor(() => expect(editorRef.current?.isEditable).toBe(true));

    act(() => {
      editorRef.current
        ?.chain()
        .setTextSelection(6)
        .insertContent(" brave")
        .run();
    });

    await waitFor(() => {
      expect(editorRef.current?.getText()).toContain("Hello brave world");
    });

    act(() => {
      editorRef.current?.commands.insertContent(" new");
    });

    await waitFor(() => {
      expect(editorRef.current?.getText()).toContain("Hello brave new world");
    });
  });

  it("keeps the insertion point stable when provenance history refreshes during editing", async () => {
    const editorRef = React.createRef<Editor | null>();
    const { Providers, queryClient } =
      createProvidersHarness(INITIAL_AI_HISTORY);

    function AutosaveHistoryRefreshHarness() {
      const [content, setContent] =
        React.useState<TiptapDocument>(INITIAL_DOCUMENT);
      const hasAppliedExternalSyncRef = React.useRef(false);
      const handleContentChange = React.useCallback(
        (nextContent: TiptapDocument) => {
          setContent(nextContent);
        },
        [],
      );

      React.useEffect(() => {
        if (hasAppliedExternalSyncRef.current) {
          return;
        }

        if (!JSON.stringify(content).includes(" brave")) {
          return;
        }

        const refreshTimer = window.setTimeout(() => {
          hasAppliedExternalSyncRef.current = true;
          setContent(buildExternallySyncedDocument(content));
          queryClient.setQueryData(
            getQueryKey(
              trpc.provenance.getHistory,
              HISTORY_QUERY_INPUT,
              "query",
            ),
            REFRESHED_AI_HISTORY,
          );
        }, 25);

        return () => window.clearTimeout(refreshTimer);
      }, [content]);

      return (
        <TiptapEditor
          content={content}
          nodeId={TEST_NODE_ID}
          editable={true}
          onChange={handleContentChange}
          editorRef={editorRef}
        />
      );
    }

    render(<AutosaveHistoryRefreshHarness />, { wrapper: Providers });

    await waitFor(() => expect(editorRef.current).not.toBeNull());
    await waitFor(() => expect(editorRef.current?.isEditable).toBe(true));

    act(() => {
      editorRef.current
        ?.chain()
        .setTextSelection(6)
        .insertContent(" brave")
        .run();
    });

    await waitFor(() => {
      expect(normalizeEditorText(editorRef.current?.getText())).toContain(
        "Hello brave world AI helper note",
      );
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryData(
          getQueryKey(trpc.provenance.getHistory, HISTORY_QUERY_INPUT, "query"),
        ),
      ).toEqual(REFRESHED_AI_HISTORY);
    });

    await waitFor(() => {
      expect(normalizeEditorText(editorRef.current?.getText())).toContain(
        "Hello brave world AI helper note refreshed",
      );
    });

    act(() => {
      editorRef.current?.commands.insertContent(" new");
    });

    await waitFor(() => {
      expect(normalizeEditorText(editorRef.current?.getText())).toContain(
        "Hello brave new world AI helper note refreshed",
      );
    });
  });
});
