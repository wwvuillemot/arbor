"use client";

import * as React from "react";
import { useToast, type Toast } from "@/contexts/toast-context";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
} from "lucide-react";
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
  const Icon = TOAST_ICONS[toast.type];

  // Index 0 is oldest, highest index is newest (at bottom)
  // Older toasts (lower index) should be smaller and higher
  const positionFromBottom = total - index - 1;

  // Older toasts get progressively smaller (scale down)
  const scale = 1 - positionFromBottom * 0.1; // 10% smaller for each position
  const translateY = -positionFromBottom * 10; // 10px higher for each older toast
  const opacity = 1 - positionFromBottom * 0.15; // Fade slightly
  const zIndex = index; // Newer toasts (higher index) on top

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

  return (
    <div
      className={cn(
        "absolute bottom-0 right-0 w-96 transition-all duration-300 ease-out",
      )}
      style={{
        transform: isExiting
          ? `translateY(20px) scale(${scale})`
          : isEntering
            ? `translateY(20px) scale(${scale})`
            : `translateY(${translateY}px) scale(${scale})`,
        opacity: isExiting ? 0 : isEntering ? 0 : opacity,
        zIndex,
        transformOrigin: "bottom center",
      }}
    >
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border-2 p-4 shadow-lg",
          "backdrop-blur-sm",
          TOAST_COLORS[toast.type],
        )}
      >
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <p className="flex-1 text-sm font-medium">{toast.message}</p>
        <button
          onClick={handleRemove}
          className="flex-shrink-0 rounded-md p-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] pointer-events-none">
      <div className="relative w-96 h-32 pointer-events-auto">
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
