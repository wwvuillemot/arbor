"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Redirect to preferences by default
    // Extract locale from pathname (e.g., /en/settings -> /en/settings/preferences)
    const newPath = `${pathname}/preferences`;
    router.replace(newPath);
  }, [router, pathname]);

  return null;
}
