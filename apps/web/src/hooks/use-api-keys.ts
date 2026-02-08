"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc";

/**
 * Hook for managing encrypted API keys
 *
 * API keys are encrypted at rest using AES-256-GCM with a master key
 * stored in the database (user_preferences table).
 *
 * The master key is automatically generated on first access and persisted.
 */
export function useApiKeys() {
  const utils = trpc.useUtils();

  // Get master key from database (auto-generated on first access)
  const { data: masterKeyData, isLoading: isLoadingMasterKey } =
    trpc.preferences.getMasterKey.useQuery();

  const masterKey = masterKeyData?.masterKey || null;

  // Get all API keys
  const { data: allKeys, isLoading: isLoadingKeys } =
    trpc.settings.getAllSettings.useQuery(
      { masterKey: masterKey || "" },
      { enabled: !!masterKey },
    );

  // Set an API key
  const setKeyMutation = trpc.settings.setSetting.useMutation({
    onSuccess: () => {
      utils.settings.getAllSettings.invalidate();
    },
  });

  // Delete an API key
  const deleteKeyMutation = trpc.settings.deleteSetting.useMutation({
    onSuccess: () => {
      utils.settings.getAllSettings.invalidate();
    },
  });

  const setApiKey = React.useCallback(
    async (key: string, value: string) => {
      if (!masterKey) {
        throw new Error("Master key not available");
      }
      return setKeyMutation.mutateAsync({ key, value, masterKey });
    },
    [masterKey, setKeyMutation],
  );

  const deleteApiKey = React.useCallback(
    (key: string) => {
      return deleteKeyMutation.mutateAsync({ key });
    },
    [deleteKeyMutation],
  );

  const getApiKey = React.useCallback(
    (key: string): string | undefined => {
      return allKeys?.[key];
    },
    [allKeys],
  );

  return {
    apiKeys: allKeys || {},
    isLoading: isLoadingMasterKey || isLoadingKeys,
    getApiKey,
    setApiKey,
    deleteApiKey,
    isUpdating: setKeyMutation.isPending || deleteKeyMutation.isPending,
    hasMasterKey: !!masterKey,
  };
}
