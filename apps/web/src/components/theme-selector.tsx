"use client";

import * as React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme, type Theme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export interface ThemeSelectorProps {
  className?: string;
}

const themeOptions: Array<{
  value: Theme;
  labelKey: string;
  icon: React.ElementType;
}> = [
  { value: "system", labelKey: "system", icon: Monitor },
  { value: "light", labelKey: "light", icon: Sun },
  { value: "dark", labelKey: "dark", icon: Moon },
];

export function ThemeSelector({ className }: ThemeSelectorProps) {
  const { theme, setTheme, isLoading } = useTheme();
  const t = useTranslations("settings.theme");

  const handleThemeChange = React.useCallback(
    async (newTheme: Theme) => {
      if (isLoading) return;
      await setTheme(newTheme);
    },
    [setTheme, isLoading],
  );

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-input bg-background p-1 w-fit",
        className,
      )}
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const isSelected = theme === option.value;
        const label = t(option.labelKey);

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleThemeChange(option.value)}
            disabled={isLoading}
            aria-label={`${label} theme`}
            aria-pressed={isSelected}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all whitespace-nowrap",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-50",
              isSelected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "hover:bg-muted hover:text-foreground text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
