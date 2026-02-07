"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  LayoutDashboard,
  FolderTree,
  MessageSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SidebarItem {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  href: string;
  badge?: string | number;
}

export interface SidebarProps {
  className?: string;
  defaultCollapsed?: boolean;
}

const navigationItems: SidebarItem[] = [
  {
    id: "search",
    labelKey: "search",
    icon: Search,
    href: "/search",
  },
  {
    id: "dashboard",
    labelKey: "dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    id: "projects",
    labelKey: "projects",
    icon: FolderTree,
    href: "/projects",
  },
  {
    id: "chat",
    labelKey: "chat",
    icon: MessageSquare,
    href: "/chat",
  },
];

export function Sidebar({ className, defaultCollapsed = false }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const pathname = usePathname();
  const t = useTranslations("sidebar");

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r bg-card transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className,
      )}
    >
      {/* Header with collapse toggle */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌳</span>
            <span className="font-semibold text-lg">{t("arbor")}</span>
          </div>
        )}
        {isCollapsed && (
          <div className="flex w-full justify-center">
            <span className="text-2xl">🌳</span>
          </div>
        )}
      </div>

      {/* Collapse toggle button - positioned on right edge, near the top */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-md hover:bg-accent transition-all"
        aria-label={isCollapsed ? t("expandLabel") : t("collapseLabel")}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      {/* Navigation items */}
      <nav className="flex-1 space-y-1 p-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const label = t(item.labelKey);

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-accent text-accent-foreground",
                isCollapsed && "justify-center px-2",
              )}
              title={isCollapsed ? label : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && (
                <>
                  <span className="flex-1">{label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <div className="border-t p-2">
        <Link
          href="/settings/preferences"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            pathname.startsWith("/settings") &&
              "bg-accent text-accent-foreground",
            isCollapsed && "justify-center px-2",
          )}
          title={isCollapsed ? t("settings") : undefined}
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span>{t("settings")}</span>}
        </Link>
      </div>
    </aside>
  );
}
