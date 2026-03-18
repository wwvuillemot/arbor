"use client";

import * as React from "react";
import { useToast, type Toast } from "@/contexts/toast-context";
import {
  X,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
} from "lucide-react";
import { copyTextToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

const TOAST_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const TOAST_COLORS = {
  success:
    "bg-green-50 dark:bg-green-950 border-green-500 text-green-900 dark:text-green-100",
  error:
    "bg-red-50 dark:bg-red-950 border-red-500 text-red-900 dark:text-red-100",
  info: "bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-900 dark:text-blue-100",
  warning:
    "bg-yellow-50 dark:bg-yellow-950 border-yellow-500 text-yellow-900 dark:text-yellow-100",
};

interface ToastItemProps {
  toast: Toast;
  index: number;
  total: number;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, index, total, onRemove }: ToastItemProps) {
  const [isExiting, setIsExiting] = React.useState(false);
  const [isEntering, setIsEntering] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const Icon = TOAST_ICONS[toast.type];

  // Index 0 is oldest, highest index is newest.
  // Older toasts are slightly smaller and fainter.
  const positionFromBottom = total - index - 1;

  const scale = Math.max(0.92, 1 - positionFromBottom * 0.04);
  const opacity = Math.max(0.75, 1 - positionFromBottom * 0.08);
  const zIndex = total - index;

  // Fade in on mount
  React.useEffect(() => {
    // Trigger fade-in animation after a brief delay to ensure CSS transition applies
    const timer = setTimeout(() => setIsEntering(false), 10);
    return () => clearTimeout(timer);
  }, []);

  // Auto-remove with exit animation when duration expires
  React.useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 300);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onRemove]);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const handleCopy = React.useCallback(async () => {
    if (await copyTextToClipboard(toast.message)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [toast.message]);

  return (
    <div
      className={cn("w-full transition-all duration-300 ease-out")}
      data-testid="toast-item"
      style={{
        transform: isExiting
          ? `translateY(20px) scale(${scale})`
          : isEntering
            ? `translateY(20px) scale(${scale})`
            : `translateY(0px) scale(${scale})`,
        opacity: isExiting ? 0 : isEntering ? 0 : opacity,
        zIndex,
        transformOrigin: "bottom right",
      }}
    >
      <div
        data-testid="toast-card"
        className={cn(
          "flex items-start gap-3 rounded-lg border-2 p-4 shadow-lg",
          "backdrop-blur-sm",
          TOAST_COLORS[toast.type],
        )}
        role="status"
      >
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <p
          data-testid="toast-message"
          className="min-w-0 flex-1 select-text whitespace-pre-wrap break-words text-sm font-medium"
        >
          {toast.message}
        </p>
        <div className="flex flex-shrink-0 items-center gap-1 self-start">
          <button
            onClick={handleCopy}
            className="rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
            aria-label={copied ? "Copied toast message" : "Copy toast message"}
            title={copied ? "Copied" : "Copy"}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={handleRemove}
            className="rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex justify-end sm:left-auto sm:right-4"
      data-testid="toast-container"
    >
      <div
        className="pointer-events-auto flex w-full max-w-sm flex-col gap-2"
        data-testid="toast-stack"
      >
        {toasts.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            index={index}
            total={toasts.length}
            onRemove={removeToast}
          />
        ))}
      </div>
    </div>
  );
}
