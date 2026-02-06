'use client';

import * as React from 'react';
import { useAppPreferences } from './use-app-preferences';

export type Theme = 'light' | 'dark' | 'system';

export interface UseThemeReturn {
  theme: Theme;
  setTheme: (theme: Theme) => Promise<void>;
  resolvedTheme: 'light' | 'dark';
  isLoading: boolean;
}

/**
 * Hook for managing theme preferences
 * 
 * Supports three modes:
 * - 'light': Force light theme
 * - 'dark': Force dark theme
 * - 'system': Follow system preference
 * 
 * Theme is persisted as an app-scope preference in PostgreSQL
 */
export function useTheme(): UseThemeReturn {
  const { getPreference, setPreference, isLoading } = useAppPreferences();
  
  // Get theme from preferences, default to 'system'
  const theme = (getPreference('theme', 'system') as Theme);
  
  // Determine the resolved theme (actual theme to apply)
  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>('light');

  // Update resolved theme based on current theme and system preference
  React.useEffect(() => {
    const updateResolvedTheme = () => {
      if (theme === 'system') {
        // Check system preference
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setResolvedTheme(isDark ? 'dark' : 'light');
      } else {
        setResolvedTheme(theme);
      }
    };

    updateResolvedTheme();

    // Listen for system theme changes when theme is 'system'
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => updateResolvedTheme();
      
      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
      } else {
        // Fallback for older browsers
        mediaQuery.addListener(handler);
        return () => mediaQuery.removeListener(handler);
      }
    }
  }, [theme]);

  // Apply theme to document
  React.useEffect(() => {
    const root = document.documentElement;
    
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  const handleSetTheme = React.useCallback(
    async (newTheme: Theme) => {
      await setPreference('theme', newTheme);
    },
    [setPreference]
  );

  return {
    theme,
    setTheme: handleSetTheme,
    resolvedTheme,
    isLoading,
  };
}

