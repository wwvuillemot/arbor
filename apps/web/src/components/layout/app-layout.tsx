"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "../command-palette/command-palette";
import { AboutDialog } from "../about-dialog";
import { SetupScreen } from "../setup-screen";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useAboutDialog } from "@/hooks/use-about-dialog";
import { useNavigationCommands } from "@/hooks/use-navigation-commands";
import { useAboutCommand } from "@/hooks/use-about-command";
import { useCommandGroups } from "@/hooks/use-command-groups";
import { useSetup } from "@/hooks/use-setup";

export interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const commandPalette = useCommandPalette();
  const aboutDialog = useAboutDialog();
  const setup = useSetup();

  // Register command groups with translations
  useCommandGroups();

  // Register navigation commands
  useNavigationCommands();

  // Register about command
  useAboutCommand(() => aboutDialog.setOpen(true));

  // Run setup on mount
  React.useEffect(() => {
    setup.runSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <CommandPalette
        open={commandPalette.open}
        onOpenChange={commandPalette.setOpen}
      />
      <AboutDialog open={aboutDialog.open} onOpenChange={aboutDialog.setOpen} />
    </div>
  );
}
