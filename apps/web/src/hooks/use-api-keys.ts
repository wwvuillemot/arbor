"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc";

/**
 * Hook for managing encrypted API keys
 *
 * API keys are encrypted at rest using AES-256-GCM with a master key
 * stored in the OS keychain (via Tauri).
 */
export function useApiKeys() {
  const utils = trpc.useUtils();
  const [masterKey, setMasterKey] = React.useState<string | null>(null);
  const [isLoadingMasterKey, setIsLoadingMasterKey] = React.useState(true);

  // Get master key from Tauri on mount
  React.useEffect(() => {
    async function getMasterKey() {
      try {
        // Check if we're in Tauri environment
        if (typeof window !== "undefined" && "__TAURI__" in window) {
          const { invoke } = await import("@tauri-apps/api/core");
          const key = await invoke<string>("get_or_generate_master_key");
          setMasterKey(key);
        } else {
          // Development mode: use a test key
          console.warn("Not in Tauri environment, using test master key");
          setMasterKey("YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=");
        }
      } catch (error) {
        console.error("Failed to get master key:", error);
      } finally {
        setIsLoadingMasterKey(false);
      }
    }

    getMasterKey();
  }, []);

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
