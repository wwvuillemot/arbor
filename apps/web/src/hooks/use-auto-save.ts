import { useEffect, useRef, useState, useCallback } from "react";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveOptions {
  nodeId: string | null;
  content: Record<string, unknown> | null;
  onSave: (nodeId: string, content: Record<string, unknown>) => Promise<void>;
  debounceMs?: number;
}

type AutoSaveContent = Record<string, unknown> | null;

export function useAutoSave({
  nodeId,
  content,
  onSave,
  debounceMs = 500,
}: UseAutoSaveOptions) {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const nodeIdRef = useRef(nodeId);
  const contentRef = useRef<AutoSaveContent>(content);
  const onSaveRef = useRef(onSave);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    nodeIdRef.current = nodeId;
    contentRef.current = content;
    onSaveRef.current = onSave;
  }, [content, nodeId, onSave]);

  // Reset status when node changes
  useEffect(() => {
    setStatus("idle");
    lastSavedRef.current = null;
  }, [nodeId]);

  const saveContent = useCallback(
    async (targetNodeId: string | null, targetContent: AutoSaveContent) => {
      if (!targetNodeId || !targetContent) {
        return;
      }

      const contentJson = JSON.stringify(targetContent);

      if (contentJson === lastSavedRef.current) {
        return;
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (!isMountedRef.current) {
        return;
      }

      setStatus("saving");

      try {
        await onSaveRef.current(targetNodeId, targetContent);
        if (isMountedRef.current) {
          lastSavedRef.current = contentJson;
          setStatus("saved");
          setTimeout(() => {
            if (isMountedRef.current) {
              setStatus("idle");
            }
          }, 2000);
        }
      } catch (error) {
        if (isMountedRef.current) {
          setStatus("error");
        }
        throw error;
      }
    },
    [],
  );

  // Debounced save effect
  useEffect(() => {
    if (!nodeId || !content) return;

    const contentJson = JSON.stringify(content);

    // Skip if content hasn't changed since last save
    if (contentJson === lastSavedRef.current) return;

    // Clear any pending save
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      try {
        await saveContent(nodeId, content);
      } catch {
        // saveContent already updates status
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [nodeId, content, debounceMs, saveContent]);

  const reset = useCallback(() => {
    setStatus("idle");
    lastSavedRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const markSaved = useCallback((savedContent: AutoSaveContent) => {
    setStatus("idle");
    lastSavedRef.current = savedContent ? JSON.stringify(savedContent) : null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(async () => {
    await saveContent(nodeIdRef.current, contentRef.current);
  }, [saveContent]);

  return { status, reset, markSaved, flush };
}
