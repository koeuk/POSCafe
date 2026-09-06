"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";

/**
 * Terminal page for an account with no granted pages.
 *
 * Both landingHref and PageGuard redirect here rather than to a page the user
 * cannot see; without a real destination the two bounce off each other and the
 * account is unusable, with no reachable sign-out. This page is deliberately
 * outside the permission check — it is the one place such a user can land.
 */
export default function NoAccessPage() {
  const { user, logout } = useAuth();
  const { t } = useT();
  const router = useRouter();

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </span>
      <h1 className="mt-5 text-xl font-semibold text-pos-page-fg">
        {t("No pages assigned")}
      </h1>
      <p className="mt-2 text-sm text-pos-page-fg/60">
        {user
          ? t(
              "Hi {name} — your account doesn't have access to any pages yet. Ask an admin to grant you access from Settings → Staff.",
              { name: user.name },
            )
          : t(
              "Your account doesn't have access to any pages yet. Ask an admin to grant you access from Settings → Staff.",
            )}
      </p>
      <button
        type="button"
        onClick={() => {
          logout();
          router.replace("/login");
        }}
        className="mt-6 rounded-xl bg-pos-button px-4 py-2.5 text-sm font-semibold text-pos-button-fg transition hover:opacity-90"
      >
        {t("Sign out")}
      </button>
    </main>
  );
}
