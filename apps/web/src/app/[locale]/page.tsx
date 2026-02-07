import { redirect } from "next/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Use locale prefix only for non-default locales (as-needed strategy)
  const prefix = locale === "en" ? "" : `/${locale}`;
  redirect(`${prefix}/dashboard`);
}
