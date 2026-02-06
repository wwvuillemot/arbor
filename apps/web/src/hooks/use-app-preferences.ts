'use client';

import * as React from 'react';
import { trpc } from '@/lib/trpc';

/**
 * Hook for managing app-scope preferences (persistent)
 * 
 * App-scope preferences are stored in PostgreSQL and persist across sessions.
 * Examples: default theme, language, editor settings
 */
export function useAppPreferences() {
  const utils = trpc.useUtils();

  // Get all app preferences
  const { data: preferences, isLoading } = trpc.preferences.getAllAppPreferences.useQuery();

  // Set a single preference
  const setPreferenceMutation = trpc.preferences.setAppPreference.useMutation({
    onSuccess: () => {
      // Invalidate and refetch
      utils.preferences.getAllAppPreferences.invalidate();
    },
  });

  // Set multiple preferences at once
  const setPreferencesMutation = trpc.preferences.setAppPreferences.useMutation({
    onSuccess: () => {
      utils.preferences.getAllAppPreferences.invalidate();
    },
  });

  // Delete a preference
  const deletePreferenceMutation = trpc.preferences.deleteAppPreference.useMutation({
    onSuccess: () => {
      utils.preferences.getAllAppPreferences.invalidate();
    },
  });

  const setPreference = React.useCallback(
    (key: string, value: any) => {
      return setPreferenceMutation.mutateAsync({ key, value });
    },
    [setPreferenceMutation]
  );

  const setPreferences = React.useCallback(
    (prefs: Record<string, any>) => {
      return setPreferencesMutation.mutateAsync(prefs);
    },
    [setPreferencesMutation]
  );

  const deletePreference = React.useCallback(
    (key: string) => {
      return deletePreferenceMutation.mutateAsync({ key });
    },
    [deletePreferenceMutation]
  );

  const getPreference = React.useCallback(
    (key: string, defaultValue?: any) => {
      return preferences?.[key] ?? defaultValue;
    },
    [preferences]
  );

  return {
    preferences: preferences || {},
    isLoading,
    getPreference,
    setPreference,
    setPreferences,
    deletePreference,
    isUpdating: setPreferenceMutation.isPending || setPreferencesMutation.isPending,
  };
}

