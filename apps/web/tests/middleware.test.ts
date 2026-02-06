import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import middleware from '@/middleware';

// Mock next-intl middleware with localeDetection: false
// It should just handle routing/rewrites, NOT locale detection
vi.mock('next-intl/middleware', () => ({
  default: vi.fn((config) => {
    return (request: NextRequest) => {
      // With localeDetection: false, next-intl just passes through
      // It only handles the routing/rewriting, not detection
      return NextResponse.next();
    };
  }),
}));

describe('Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Language preference cookie handling', () => {
    it('should redirect to English when preference is "en" but on Japanese page', async () => {
      const request = new NextRequest('http://app.arbor.local/ja/dashboard', {
        headers: {
          'accept-language': 'ja-JP,ja;q=0.9', // Browser prefers Japanese
          'cookie': 'ARBOR_LANGUAGE_PREF=en', // But user explicitly chose English
        },
      });

      const response = await middleware(request);

      // Should redirect to English version
      expect(response.status).toBe(307); // Temporary redirect
      expect(response.headers.get('location')).toBe('http://app.arbor.local/dashboard');
    });

    it('should redirect to Japanese when preference is "ja" but on English page', async () => {
      const request = new NextRequest('http://app.arbor.local/dashboard', {
        headers: {
          'accept-language': 'en-US,en;q=0.9', // Browser prefers English
          'cookie': 'ARBOR_LANGUAGE_PREF=ja', // But user explicitly chose Japanese
        },
      });

      const response = await middleware(request);

      // Should redirect to Japanese version
      expect(response.status).toBe(307); // Temporary redirect
      expect(response.headers.get('location')).toBe('http://app.arbor.local/ja/dashboard');
    });

    it('should redirect to Japanese when preference is "system" with Japanese browser', async () => {
      const request = new NextRequest('http://app.arbor.local/dashboard', {
        headers: {
          'accept-language': 'ja-JP,ja;q=0.9',
          'cookie': 'ARBOR_LANGUAGE_PREF=system',
        },
      });

      const response = await middleware(request);

      // Should redirect to Japanese version
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://app.arbor.local/ja/dashboard');
    });

    it('should not redirect when already on correct locale', async () => {
      const request = new NextRequest('http://app.arbor.local/dashboard', {
        headers: {
          'accept-language': 'en-US,en;q=0.9',
          'cookie': 'ARBOR_LANGUAGE_PREF=en',
        },
      });

      const response = await middleware(request);

      // Should not redirect (next-intl middleware returns next())
      expect(response.status).not.toBe(307);
    });

    it('should redirect based on browser language when no preference cookie is set', async () => {
      const request = new NextRequest('http://app.arbor.local/dashboard', {
        headers: {
          'accept-language': 'ja-JP,ja;q=0.9',
        },
      });

      const response = await middleware(request);

      // Should redirect to Japanese based on browser language
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://app.arbor.local/ja/dashboard');
    });
  });

  describe('getBrowserLanguage helper', () => {
    it('should detect Japanese from accept-language header with system preference', async () => {
      const request = new NextRequest('http://app.arbor.local/dashboard', {
        headers: {
          'accept-language': 'ja-JP,ja;q=0.9,en-US;q=0.8',
          'cookie': 'ARBOR_LANGUAGE_PREF=system',
        },
      });

      const response = await middleware(request);
      // Should redirect to Japanese
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://app.arbor.local/ja/dashboard');
    });

    it('should detect English from accept-language header with system preference', async () => {
      const request = new NextRequest('http://app.arbor.local/ja/dashboard', {
        headers: {
          'accept-language': 'en-US,en;q=0.9',
          'cookie': 'ARBOR_LANGUAGE_PREF=system',
        },
      });

      const response = await middleware(request);
      // Should redirect to English
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://app.arbor.local/dashboard');
    });

    it('should handle case-insensitive language detection', async () => {
      const request = new NextRequest('http://app.arbor.local/dashboard', {
        headers: {
          'accept-language': 'JA-jp,JA;q=0.9',
          'cookie': 'ARBOR_LANGUAGE_PREF=system',
        },
      });

      const response = await middleware(request);
      // Should redirect to Japanese
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://app.arbor.local/ja/dashboard');
    });
  });

  describe('Cookie priority', () => {
    it('should prioritize cookie over accept-language header', async () => {
      const request = new NextRequest('http://app.arbor.local/ja/dashboard', {
        headers: {
          'accept-language': 'ja-JP,ja;q=0.9',
          'cookie': 'ARBOR_LANGUAGE_PREF=en',
        },
      });

      const response = await middleware(request);

      // Cookie should win - redirect to English
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://app.arbor.local/dashboard');
    });
  });

  describe('Root path handling (CRITICAL BUG)', () => {
    it('should NOT cause infinite redirect on root path with en preference and ja browser', async () => {
      const request = new NextRequest('http://app.arbor.local/', {
        headers: {
          'accept-language': 'ja-JP,ja;q=0.9',
          'cookie': 'ARBOR_LANGUAGE_PREF=en',
        },
      });

      const response = await middleware(request);

      // With en preference, should stay on / (not redirect to /ja)
      // Since we're already on the correct locale (en), no redirect needed
      expect(response.status).not.toBe(307);
    });

    it('should NOT cause infinite redirect on /ja path with en preference', async () => {
      const request = new NextRequest('http://app.arbor.local/ja', {
        headers: {
          'accept-language': 'ja-JP,ja;q=0.9',
          'cookie': 'ARBOR_LANGUAGE_PREF=en',
        },
      });

      const response = await middleware(request);

      // Should redirect from /ja to / (English preference)
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://app.arbor.local/');
    });
  });
});

