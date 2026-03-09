"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "../command-palette/command-palette";
import { AboutDialog } from "../about-dialog";
import { SetupScreen } from "../setup-screen";
import { SearchModal } from "../search";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useAboutDialog } from "@/hooks/use-about-dialog";
import { useNavigationCommands } from "@/hooks/use-navigation-commands";
import { useAboutCommand } from "@/hooks/use-about-command";
import { useCommandGroups } from "@/hooks/use-command-groups";
import { useSetup } from "@/hooks/use-setup";
import { useTheme } from "@/hooks/use-theme";

export interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const commandPalette = useCommandPalette();
  const aboutDialog = useAboutDialog();
  const setup = useSetup();
  const router = useRouter();

  const [searchOpen, setSearchOpen] = React.useState(false);

  // Apply theme from database (replaces next-themes)
  useTheme();

  // Register command groups with translations
  useCommandGroups();

  // Register navigation commands
  useNavigationCommands(() => setSearchOpen(true));

  // Register about command
  useAboutCommand(() => aboutDialog.setOpen(true));

  // Cmd+K / Ctrl+K to open search
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Run setup on mount
  React.useEffect(() => {
    setup.runSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSelectNode = React.useCallback(
    (nodeId: string) => {
      router.push(`/projects?node=${nodeId}`);
    },
    [router],
  );

  // Show setup screen if setup is required
  if (setup.isSetupRequired && setup.mode) {
    return (
      <SetupScreen
        mode={setup.mode}
        currentStep={setup.currentStep}
        progress={setup.progress}
        error={setup.error}
        onRetry={setup.retry}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onSearchOpen={() => setSearchOpen(true)} />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <CommandPalette
        open={commandPalette.open}
        onOpenChange={commandPalette.setOpen}
      />
      <AboutDialog open={aboutDialog.open} onOpenChange={aboutDialog.setOpen} />
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectNode={handleSearchSelectNode}
      />
    </div>
  );
}
