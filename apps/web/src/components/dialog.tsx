"use client";

import * as React from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  showFullscreenToggle?: boolean;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "6xl";
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
};

export function Dialog({
  open,
  onClose,
  title,
  children,
  showFullscreenToggle = true,
  className,
  maxWidth = "2xl",
}: DialogProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const utils = trpc.useUtils();

  // Load fullscreen preference
  const { data: preference } = trpc.preferences.getAppPreference.useQuery(
    { key: "dialog_fullscreen" },
    { enabled: open }
  );

  // Save fullscreen preference mutation
  const setPreferenceMutation = trpc.preferences.setAppPreference.useMutation({
    onSuccess: () => {
      utils.preferences.getAllAppPreferences.invalidate();
    },
  });

  // Initialize from preference when dialog opens
  React.useEffect(() => {
    if (open && preference?.value !== undefined) {
      setIsFullscreen(preference.value);
    }
  }, [open, preference]);

  const toggleFullscreen = () => {
    const newValue = !isFullscreen;
    setIsFullscreen(newValue);
    setPreferenceMutation.mutate({ key: "dialog_fullscreen", value: newValue });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative bg-background rounded-lg shadow-lg overflow-hidden flex flex-col",
          isFullscreen
            ? "w-full h-full max-w-none max-h-none"
            : `w-full ${maxWidthClasses[maxWidth]} max-h-[90vh]`,
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">{title}</h2>
          <div className="flex items-center gap-2">
            {showFullscreenToggle && (
              <button
                type="button"
                onClick={toggleFullscreen}
                className="rounded-md p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

