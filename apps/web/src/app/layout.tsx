import type { Metadata } from "next";
import { TRPCProvider } from "@/components/providers/trpc-provider";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // Await params as required by Next.js 15
  const { locale } = await params;

  // Load messages manually since we're not using the next-intl plugin in Docker
  let messages;
  try {
    messages = (await import(`./[locale]/../../i18n/messages/${locale}.json`))
      .default;
  } catch {
    messages = (await import(`./[locale]/../../i18n/messages/en.json`)).default;
  }

  return {
    title: messages.app?.title || "Arbor - AI-Powered Writing Assistant",
    description:
      messages.app?.description ||
      "A local-first, AI-powered writing assistant for creative writers",
  };
}

/**
 * Root Layout
 *
 * IMPORTANT: TRPCProvider is at the root level to persist across locale changes.
 * This prevents the QueryClient from being recreated when the user changes languages,
 * which would otherwise clear all cached data (current project, preferences, API keys).
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TRPCProvider>{children}</TRPCProvider>;
}
