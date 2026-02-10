"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Chat page - redirects to Projects page with chat sidebar open
 * This preserves backward compatibility with old /chat links
 */
export default function ChatPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to projects page with chat sidebar open
    router.replace("/projects?chat=open");
  }, [router]);

  return null;
}
