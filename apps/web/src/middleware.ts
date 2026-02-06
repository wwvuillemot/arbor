import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n/request';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Helper to detect browser language from Accept-Language header
function getBrowserLanguage(request: NextRequest): 'en' | 'ja' {
  const acceptLanguage = request.headers.get('accept-language') || '';
  if (acceptLanguage.toLowerCase().includes('ja')) return 'ja';
  return 'en';
}

// Create next-intl middleware with locale detection DISABLED
// We'll handle locale detection ourselves based on the cookie
const handleI18nRouting = createMiddleware({
  locales,
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  localeDetection: false, // CRITICAL: Disable automatic locale detection
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for language preference cookie
  const languagePref = request.cookies.get('ARBOR_LANGUAGE_PREF')?.value;

  // Determine target locale based on preference
  let targetLocale: 'en' | 'ja';
  if (languagePref === 'system' || !languagePref) {
    targetLocale = getBrowserLanguage(request);
  } else if (languagePref === 'en' || languagePref === 'ja') {
    targetLocale = languagePref;
  } else {
    targetLocale = getBrowserLanguage(request);
  }

  // Determine current locale from pathname
  const currentLocale = pathname.startsWith('/ja') ? 'ja' : 'en';

  // If we're on the wrong locale, redirect
  if (currentLocale !== targetLocale) {
    const newPathname = targetLocale === 'en'
      ? pathname.replace(/^\/ja/, '') || '/'
      : `/ja${pathname}`;

    const url = request.nextUrl.clone();
    url.pathname = newPathname;
    return NextResponse.redirect(url);
  }

  // Call next-intl middleware for proper routing/rewrites
  return handleI18nRouting(request);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};

