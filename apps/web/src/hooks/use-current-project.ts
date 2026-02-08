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
  const {
    getPreference,
    setPreference,
    deletePreference,
    isLoading,
    isUpdating,
  } = useAppPreferences();

  // Get current project ID from preferences
  const currentProjectId = getPreference("currentProjectId", null) as
    | string
    | null;

  // Set current project
  const setCurrentProject = React.useCallback(
    async (projectId: string | null) => {
      if (projectId === null) {
        // Delete the preference instead of setting it to null
        // (user_preferences.value has NOT NULL constraint)
        await deletePreference("currentProjectId");
      } else {
        await setPreference("currentProjectId", projectId);
      }
    },
    [setPreference, deletePreference],
  );

  return {
    currentProjectId,
    setCurrentProject,
    isLoading,
    isUpdating,
  };
}
