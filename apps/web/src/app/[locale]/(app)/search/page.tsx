"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SearchPage() {
  const router = useRouter();
  // Legacy search route redirects to projects because search now opens from layout controls.
  useEffect(() => {
    router.replace("/projects");
  }, [router]);
  return null;
}
