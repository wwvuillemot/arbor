"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc";

/**
 * Hook for managing session-scope preferences (temporary)
 *
 * Session-scope preferences are stored in Redis and cleared when the session ends.
 * Examples: sidebar collapsed state, current filters, temporary UI state
 *
 * @param sessionId - Unique session identifier (e.g., from a cookie or generated client-side)
 */
export function useSessionPreferences(sessionId: string) {
  // Local state to cache session preferences
  const [sessionCache, setSessionCache] = React.useState<
    Record<string, unknown>
  >({});

  // Set a single session preference
  const setPreferenceMutation =
    trpc.preferences.setSessionPreference.useMutation({
      onSuccess: (_, variables) => {
        // Update local cache immediately for optimistic UI
        if (variables) {
          setSessionCache((prev) => ({
            ...prev,
            [variables.key]: variables.value,
          }));
        }
      },
    });

  // Set multiple session preferences at once
  const setPreferencesMutation =
    trpc.preferences.setSessionPreferences.useMutation({
      onSuccess: (_, variables) => {
        // Update local cache immediately for optimistic UI
        if (variables && variables.preferences) {
          setSessionCache((prev) => ({
            ...prev,
            ...variables.preferences,
          }));
        }
      },
    });

  // Delete a session preference
  const deletePreferenceMutation =
    trpc.preferences.deleteSessionPreference.useMutation({
      onSuccess: (_, variables) => {
        // Remove from local cache
        if (variables) {
          setSessionCache((prev) => {
            const newCache = { ...prev };
            delete newCache[variables.key];
            return newCache;
          });
        }
      },
    });

  const setPreference = React.useCallback(
    (key: string, value: unknown, ttl?: number) => {
      return setPreferenceMutation.mutateAsync({ sessionId, key, value, ttl });
    },
    [sessionId, setPreferenceMutation],
  );

  const setPreferences = React.useCallback(
    (preferences: Record<string, unknown>, ttl?: number) => {
      return setPreferencesMutation.mutateAsync({
        sessionId,
        preferences,
        ttl,
      });
    },
    [sessionId, setPreferencesMutation],
  );

  const deletePreference = React.useCallback(
    (key: string) => {
      return deletePreferenceMutation.mutateAsync({ sessionId, key });
    },
    [sessionId, deletePreferenceMutation],
  );

  const getPreference = React.useCallback(
    (key: string, defaultValue?: unknown) => {
      return sessionCache[key] ?? defaultValue;
    },
    [sessionCache],
  );

  // Helper to fetch a preference from the server (if not in cache)
  const utils = trpc.useUtils();
  const fetchPreference = React.useCallback(
    async (key: string) => {
      const result = await utils.preferences.getSessionPreference.fetch({
        sessionId,
        key,
      });
      if (result.value !== null) {
        setSessionCache((prev) => ({
          ...prev,
          [key]: result.value,
        }));
      }
      return result.value;
    },
    [sessionId, utils],
  );

  return {
    preferences: sessionCache,
    getPreference,
    setPreference,
    setPreferences,
    deletePreference,
    fetchPreference,
    isUpdating:
      setPreferenceMutation.isPending || setPreferencesMutation.isPending,
  };
}

/**
 * Generate a session ID for the current browser session
 * This persists in sessionStorage and is cleared when the browser tab is closed
 */
export function useSessionId(): string {
  const [sessionId, setSessionId] = React.useState<string>("");

  React.useEffect(() => {
    // Check if we already have a session ID in sessionStorage
    let id = sessionStorage.getItem("arbor_session_id");

    if (!id) {
      // Generate a new session ID
      id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      sessionStorage.setItem("arbor_session_id", id);
    }

    setSessionId(id);
  }, []);

  return sessionId;
}
