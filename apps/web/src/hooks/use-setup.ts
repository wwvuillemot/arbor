"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc";
import type { SetupStep } from "@/components/setup-screen";

export interface SetupState {
  isSetupRequired: boolean;
  isLoading: boolean;
  mode: "cold" | "warm" | null;
  currentStep: SetupStep;
  progress: number;
  error: string | null;
}

export function useSetup() {
  const [state, setState] = React.useState<SetupState>({
    isSetupRequired: true,
    isLoading: true,
    mode: null,
    currentStep: "checkingServices",
    progress: 0,
    error: null,
  });

  const setupStatusQuery = trpc.setup.getSetupStatus.useQuery(undefined, {
    enabled: false, // We'll call this manually
  });

  const healthCheckQuery = trpc.setup.checkHealth.useQuery(undefined, {
    enabled: false,
  });

  const runSeedMutation = trpc.setup.runSeed.useMutation();
  const markCompleteMutation = trpc.setup.markSetupComplete.useMutation();

  const runSetup = React.useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Step 1: Check if setup has been completed before
      setState((prev) => ({
        ...prev,
        currentStep: "checkingServices",
        progress: 10,
      }));

      const setupStatus = await setupStatusQuery.refetch();
      const isColdStart = !setupStatus.data?.setupCompleted;

      setState((prev) => ({
        ...prev,
        mode: isColdStart ? "cold" : "warm",
        progress: 20,
      }));

      if (isColdStart) {
        // Cold start flow
        await runColdStart();
      } else {
        // Warm start flow
        await runWarmStart();
      }
    } catch (error) {
      console.error("Setup failed:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Setup failed",
        isLoading: false,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    setupStatusQuery,
    runSeedMutation,
    markCompleteMutation,
    healthCheckQuery,
  ]);

  const runColdStart = async () => {
    // Step 1: Check Docker (would need Tauri command)
    setState((prev) => ({
      ...prev,
      currentStep: "checkingDocker",
      progress: 30,
    }));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 2: Start services (would need Tauri command)
    setState((prev) => ({
      ...prev,
      currentStep: "startingServices",
      progress: 40,
    }));
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Step 3: Initialize database
    setState((prev) => ({
      ...prev,
      currentStep: "initializingDatabase",
      progress: 60,
    }));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 4: Seed data
    setState((prev) => ({
      ...prev,
      currentStep: "seedingData",
      progress: 80,
    }));
    await runSeedMutation.mutateAsync();

    // Step 5: Generate keys (would need Tauri command)
    setState((prev) => ({
      ...prev,
      currentStep: "generatingKeys",
      progress: 90,
    }));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 6: Mark complete
    await markCompleteMutation.mutateAsync();

    setState((prev) => ({
      ...prev,
      currentStep: "complete",
      progress: 100,
      isSetupRequired: false,
      isLoading: false,
    }));
  };

  const runWarmStart = async () => {
    // Step 1: Check services
    setState((prev) => ({
      ...prev,
      currentStep: "checkingServices",
      progress: 50,
    }));

    const health = await healthCheckQuery.refetch();

    // If services aren't healthy, just show a warning but continue
    if (!health.data?.database || !health.data?.redis) {
      console.warn(
        "Services not healthy. Please run 'make up' to start services.",
      );
    }

    // Step 2: Check keys (would need Tauri command)
    setState((prev) => ({
      ...prev,
      currentStep: "checkingKeys",
      progress: 90,
    }));
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Done
    setState((prev) => ({
      ...prev,
      currentStep: "ready",
      progress: 100,
      isSetupRequired: false,
      isLoading: false,
    }));
  };

  return {
    ...state,
    runSetup,
    retry: runSetup,
  };
}
