"use client";

import * as React from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsReasoning?: boolean;
  costPer1kInput?: number;
  costPer1kOutput?: number;
}

export interface ModelSelectorProps {
  value: string | null;
  onChange: (modelId: string | null) => void;
  className?: string;
}

export function ModelSelector({
  value,
  onChange,
  className,
}: ModelSelectorProps) {
  const t = useTranslations("chat");
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const { data: models, isLoading } = trpc.llm.listAvailableModels.useQuery();

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Group models by provider
  const groupedModels = React.useMemo(() => {
    if (!models) return {};

    const groups: Record<string, ModelInfo[]> = {};
    models.forEach((model) => {
      if (!groups[model.provider]) {
        groups[model.provider] = [];
      }
      groups[model.provider].push(model);
    });

    return groups;
  }, [models]);

  const selectedModel = React.useMemo(() => {
    if (!value || !models) return null;
    return models.find((m) => m.id === value) || null;
  }, [value, models]);

  const handleSelect = (modelId: string | null) => {
    onChange(modelId);
    setIsOpen(false);
  };

  const formatContextWindow = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
    return tokens.toString();
  };

  if (isLoading) {
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        {t("loadingModels")}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
          "bg-background hover:bg-muted transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        data-testid="model-selector-button"
      >
        <Sparkles className="h-3 w-3" />
        <span className="truncate max-w-[120px]">
          {selectedModel ? selectedModel.name : t("defaultModel")}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            isOpen && "transform rotate-180",
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 z-50 min-w-[280px] rounded-md border bg-popover shadow-md"
          data-testid="model-selector-dropdown"
        >
          {/* Default option */}
          <div className="p-1 border-b">
            <button
              onClick={() => handleSelect(null)}
              className={cn(
                "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm",
                "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
                "transition-colors",
                !value && "bg-accent text-accent-foreground",
              )}
              data-testid="model-option-default"
            >
              <span className="font-medium">{t("defaultModel")}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {t("useProviderDefault")}
              </span>
            </button>
          </div>

          {/* Grouped models */}
          <div className="max-h-[300px] overflow-y-auto p-1">
            {Object.entries(groupedModels).map(([provider, providerModels]) => (
              <div key={provider} className="mb-2 last:mb-0">
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground capitalize">
                  {provider}
                </div>
                {providerModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleSelect(model.id)}
                    className={cn(
                      "flex flex-col gap-1 w-full rounded-sm px-2 py-1.5 text-left",
                      "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
                      "transition-colors",
                      value === model.id && "bg-accent text-accent-foreground",
                    )}
                    data-testid={`model-option-${model.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{model.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatContextWindow(model.contextWindow)}
                      </span>
                    </div>
                    {(model.supportsReasoning ||
                      model.supportsVision ||
                      model.supportsTools) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {model.supportsReasoning && <span>🧠 Reasoning</span>}
                        {model.supportsVision && <span>👁️ Vision</span>}
                        {model.supportsTools && <span>🔧 Tools</span>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
