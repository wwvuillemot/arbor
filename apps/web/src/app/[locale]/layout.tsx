import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { locales } from "@/i18n/request";
import "../../styles/globals.css";
import { ToastProvider } from "@/contexts/toast-context";
import { ToastContainer } from "@/components/toast-container";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Await params as required by Next.js 15
  const { locale } = await params;

  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound();
  }

  // Load messages manually since we're not using the next-intl plugin in Docker
  let messages;
  try {
    messages = (await import(`@/i18n/messages/${locale}.json`)).default;
  } catch {
    notFound();
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ToastProvider>
            {children}
            <ToastContainer />
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
