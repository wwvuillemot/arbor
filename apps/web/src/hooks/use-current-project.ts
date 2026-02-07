"use client";

import * as React from "react";
import { useAppPreferences } from "./use-app-preferences";

/**
 * Hook for managing the currently selected project
 *
 * The current project is stored as an app-scope preference in PostgreSQL
 * and persists across sessions.
 */
export function useCurrentProject() {
  const { getPreference, setPreference, isLoading, isUpdating } =
    useAppPreferences();

  // Get current project ID from preferences
  const currentProjectId = getPreference("currentProjectId", null) as
    | string
    | null;

  // Set current project
  const setCurrentProject = React.useCallback(
    async (projectId: string | null) => {
      await setPreference("currentProjectId", projectId);
    },
    [setPreference],
  );

  return {
    currentProjectId,
    setCurrentProject,
    isLoading,
    isUpdating,
  };
}
