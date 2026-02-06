'use client';

import * as React from 'react';
import { Languages, Globe } from 'lucide-react';
import { useAppPreferences } from '@/hooks/use-app-preferences';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { cn } from '@/lib/utils';

export type Language = 'en' | 'ja' | 'system';

export interface LanguageSelectorProps {
  className?: string;
}

const languageOptions: Array<{ value: Language; label: string; nativeLabel: string; icon: typeof Languages }> = [
  { value: 'system', label: 'System', nativeLabel: 'System', icon: Globe },
  { value: 'en', label: 'English', nativeLabel: 'English', icon: Languages },
  { value: 'ja', label: 'Japanese', nativeLabel: '日本語', icon: Languages },
];

// Helper to detect browser language
function getBrowserLanguage(): 'en' | 'ja' {
  if (typeof window === 'undefined') return 'en';

  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('ja')) return 'ja';
  return 'en';
}

export function LanguageSelector({ className }: LanguageSelectorProps) {
  const { getPreference, setPreference, isLoading } = useAppPreferences();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();

  // Get language preference from database, default to 'system'
  const languagePreference = (getPreference('language', 'system') as Language);

  // Resolve the actual language to use
  const resolvedLanguage = languagePreference === 'system'
    ? getBrowserLanguage()
    : languagePreference;

  // The current language shown is based on the URL locale
  const language = languagePreference;

  const handleLanguageChange = React.useCallback(
    async (newLanguage: Language) => {
      if (isLoading) return;

      // Set cookie for middleware to read (expires in 1 year)
      document.cookie = `ARBOR_LANGUAGE_PREF=${newLanguage}; path=/; max-age=31536000; SameSite=lax`;

      // Save preference to database
      await setPreference('language', newLanguage);

      // Determine the actual locale to navigate to
      const targetLocale = newLanguage === 'system' ? getBrowserLanguage() : newLanguage;

      // Navigate to the new locale URL
      // Remove current locale prefix from pathname
      const pathnameWithoutLocale = pathname.replace(/^\/(en|ja)/, '') || '/';

      // Add new locale prefix (only for non-default locale)
      const newPath = targetLocale === 'en'
        ? pathnameWithoutLocale
        : `/${targetLocale}${pathnameWithoutLocale}`;

      router.push(newPath);
      router.refresh();
    },
    [setPreference, isLoading, router, pathname]
  );

  return (
    <div className={cn('inline-flex items-center gap-1 rounded-lg border border-input bg-background p-1 w-fit', className)}>
      {languageOptions.map((option) => {
        const Icon = option.icon;
        const isSelected = language === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleLanguageChange(option.value)}
            disabled={isLoading}
            aria-label={`${option.label} language`}
            aria-pressed={isSelected}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all whitespace-nowrap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50',
              isSelected
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'hover:bg-muted hover:text-foreground text-muted-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{option.nativeLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

