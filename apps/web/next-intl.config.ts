import { getRequestConfig } from 'next-intl/server';
import { getRequestConfig as getRequestLocale } from 'next-intl/server';

export const locales = ['en', 'ja'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  // Await the locale as required by next-intl 3.22+
  const locale = await requestLocale;

  return {
    locale,
    messages: (await import(`./src/i18n/messages/${locale}.json`)).default,
  };
});

