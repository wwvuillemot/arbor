import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  // Await params as required by Next.js 15
  const { locale } = await params;

  // Load messages manually since we're not using the next-intl plugin in Docker
  let messages;
  try {
    messages = (await import(`./[locale]/../../i18n/messages/${locale}.json`)).default;
  } catch (error) {
    messages = (await import(`./[locale]/../../i18n/messages/en.json`)).default;
  }

  return {
    title: messages.app?.title || 'Arbor - AI-Powered Writing Assistant',
    description: messages.app?.description || 'A local-first, AI-powered writing assistant for creative writers',
  };
}

// This is a root layout that just passes through to the locale-specific layout
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

