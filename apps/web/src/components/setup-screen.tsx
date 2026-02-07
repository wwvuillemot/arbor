"use client";

import * as React from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type SetupStep =
  | "checkingDocker"
  | "startingServices"
  | "initializingDatabase"
  | "seedingData"
  | "generatingKeys"
  | "checkingServices"
  | "verifyingDatabase"
  | "verifyingRedis"
  | "checkingKeys"
  | "complete"
  | "ready";

export interface SetupScreenProps {
  mode: "cold" | "warm";
  currentStep: SetupStep;
  progress: number; // 0-100
  error?: string | null;
  onRetry?: () => void;
}

export function SetupScreen({
  mode,
  currentStep,
  progress,
  error,
  onRetry,
}: SetupScreenProps) {
  const t = useTranslations("setup");
  const stepKey = mode === "cold" ? "coldStart" : "warmStart";

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <div className="rounded-lg bg-card shadow-lg p-8 space-y-6">
          {/* Logo and Title */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <span className="text-6xl">🌳</span>
            </div>
            <h1 className="text-2xl font-semibold">{t(`${stepKey}.title`)}</h1>
            <p className="text-sm text-muted-foreground">
              {t(`${stepKey}.description`)}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 ease-out",
                  error ? "bg-destructive" : "bg-primary",
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress}%</span>
              <span>
                {error
                  ? t("error.title")
                  : t(`${stepKey}.steps.${currentStep}`)}
              </span>
            </div>
          </div>

          {/* Current Step Status */}
          <div className="flex items-center justify-center gap-3 py-4">
            {error ? (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  {error}
                </span>
              </>
            ) : currentStep === "complete" || currentStep === "ready" ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-green-500">
                  {t(`${stepKey}.steps.${currentStep}`)}
                </span>
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {t(`${stepKey}.steps.${currentStep}`)}
                </span>
              </>
            )}
          </div>

          {/* Error Actions */}
          {error && onRetry && (
            <div className="flex gap-2">
              <button
                onClick={onRetry}
                className={cn(
                  "flex-1 rounded-md px-4 py-2 text-sm font-medium",
                  "bg-primary text-primary-foreground",
                  "hover:bg-primary/90 transition-colors",
                )}
              >
                {t("error.retry")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
