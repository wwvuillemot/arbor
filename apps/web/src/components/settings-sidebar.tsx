"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Settings, Palette, Key, Cog } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsNavItem {
  id: string;
  labelKey: string;
  href: string;
  icon: React.ElementType;
}

const settingsNavItems: SettingsNavItem[] = [
  {
    id: "preferences",
    labelKey: "preferences",
    href: "/settings/preferences",
    icon: Palette,
  },
  {
    id: "integrations",
    labelKey: "integrations",
    href: "/settings/integrations",
    icon: Key,
  },
  {
    id: "configuration",
    labelKey: "configuration",
    href: "/settings/configuration",
    icon: Cog,
  },
];

export function SettingsSidebar() {
  const pathname = usePathname();
  const t = useTranslations("settings.nav");

  return (
    <aside className="w-64 border-r border-border bg-background h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {settingsNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname?.includes(item.href);

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    "hover:bg-muted hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
