'use client';

import * as React from 'react';
import { Sidebar } from './sidebar';
import { CommandPalette } from '../command-palette/command-palette';
import { useCommandPalette } from '@/hooks/use-command-palette';
import { useNavigationCommands } from '@/hooks/use-navigation-commands';

export interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const commandPalette = useCommandPalette();

  // Register navigation commands
  useNavigationCommands();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <CommandPalette
        open={commandPalette.open}
        onOpenChange={commandPalette.setOpen}
      />
    </div>
  );
}

