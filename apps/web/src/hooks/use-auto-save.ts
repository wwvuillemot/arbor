import { useEffect, useRef, useState, useCallback } from "react";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveOptions {
  nodeId: string | null;
  content: Record<string, unknown> | null;
  onSave: (nodeId: string, content: Record<string, unknown>) => Promise<void>;
  debounceMs?: number;
}

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

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset status when node changes
  useEffect(() => {
    setStatus("idle");
    lastSavedRef.current = null;
  }, [nodeId]);

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
      if (!isMountedRef.current) return;

      setStatus("saving");
      try {
        await onSave(nodeId, content);
        if (isMountedRef.current) {
          lastSavedRef.current = contentJson;
          setStatus("saved");
          // Reset to idle after a delay
          setTimeout(() => {
            if (isMountedRef.current) {
              setStatus("idle");
            }
          }, 2000);
        }
      } catch {
        if (isMountedRef.current) {
          setStatus("error");
        }
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [nodeId, content, onSave, debounceMs]);

  const reset = useCallback(() => {
    setStatus("idle");
    lastSavedRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  return { status, reset };
}
