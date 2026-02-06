'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ThemeSelector } from '@/components/theme-selector';
import { LanguageSelector } from '@/components/language-selector';

export default function SettingsPage() {
  const t = useTranslations('settings');

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
      <p className="text-muted-foreground mb-8">
        {t('description')}
      </p>

      {/* Appearance Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{t('appearance')}</h2>
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="theme-selector" className="text-sm font-medium">
              {t('theme.label')}
            </label>
            <p className="text-sm text-muted-foreground mb-2">
              {t('theme.description')}
            </p>
            <ThemeSelector className="max-w-xs" />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              {t('language.label')}
            </label>
            <p className="text-sm text-muted-foreground mb-2">
              {t('language.description')}
            </p>
            <LanguageSelector className="max-w-xs" />
          </div>
        </div>
      </section>
    </div>
  );
}

