"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SearchPage() {
  const router = useRouter();
  // Search is now a modal (Cmd+K). Redirect to projects.
  useEffect(() => {
    router.replace("/projects");
  }, [router]);
  return null;
}
