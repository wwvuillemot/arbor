'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  FolderTree,
  MessageSquare,
  Settings,
} from 'lucide-react';
import { commandRegistry } from '@/lib/command-registry';

export function useNavigationCommands() {
  const router = useRouter();

  React.useEffect(() => {
    const unregister = commandRegistry.registerMany([
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        description: 'View your dashboard',
        icon: LayoutDashboard,
        group: 'navigation',
        keywords: ['home', 'overview'],
        shortcut: ['g', 'd'],
        action: () => router.push('/dashboard'),
      },
      {
        id: 'nav-search',
        label: 'Go to Search',
        description: 'Search your content',
        icon: Search,
        group: 'navigation',
        keywords: ['find', 'lookup'],
        shortcut: ['g', 's'],
        action: () => router.push('/search'),
      },
      {
        id: 'nav-projects',
        label: 'Go to Projects',
        description: 'Browse your projects',
        icon: FolderTree,
        group: 'navigation',
        keywords: ['folders', 'files'],
        shortcut: ['g', 'p'],
        action: () => router.push('/projects'),
      },
      {
        id: 'nav-chat',
        label: 'Go to AI Chat',
        description: 'Chat with AI assistant',
        icon: MessageSquare,
        group: 'navigation',
        keywords: ['ai', 'assistant', 'help'],
        shortcut: ['g', 'c'],
        action: () => router.push('/chat'),
      },
      {
        id: 'nav-settings',
        label: 'Go to Settings',
        description: 'Configure your preferences',
        icon: Settings,
        group: 'settings',
        keywords: ['preferences', 'config'],
        shortcut: ['g', ','],
        action: () => router.push('/settings'),
      },
    ]);

    return unregister;
  }, [router]);
}

