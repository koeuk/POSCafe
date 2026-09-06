"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import { landingHref } from "@/lib/permissions";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t } = useT();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else {
      router.replace(landingHref(user.role, user.allowedPages));
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
      {t("Loading…")}
    </div>
  );
}
