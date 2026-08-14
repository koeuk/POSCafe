"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  AUTH_INPUT,
  AuthError,
  AuthField,
  AuthShell,
  AuthSubmit,
  lockIcon,
  userIcon,
} from "@/components/auth-shell";
import { useAuth } from "@/lib/auth-context";
import { landingHref } from "@/lib/permissions";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in → send them where they belong.
  useEffect(() => {
    if (!loading && user) {
      router.replace(landingHref(user.role, user.allowedPages));
    }
  }, [user, loading, router]);

  const canSubmit = username.trim() !== "" && password !== "" && !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Use the user returned by login(), not the one from context — context
      // hasn't re-rendered with the new session yet at this point.
      const signedIn = await login(username, password);
      router.replace(landingHref(signedIn.role, signedIn.allowedPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setSubmitting(false);
    }
  }

  // Caps Lock is the single most common cause of a "wrong password" at a
  // counter — surface it before they submit rather than after.
  function trackCapsLock(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState("CapsLock"));
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your counter to continue">
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField
          id="username"
          label="Username or email"
          type="text"
          placeholder="your username or email"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={setUsername}
          icon={userIcon}
        />

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-stone-700 dark:text-stone-300"
            >
              Password
            </label>
            {/* Carries the typed username across so the reset screen doesn't
                ask for it again — the admin has already told us who they are. */}
            <Link
              href={
                username.trim()
                  ? `/forgot-password?identifier=${encodeURIComponent(username.trim())}`
                  : "/forgot-password"
              }
              className="text-xs font-medium text-amber-600 underline-offset-2 transition hover:text-amber-700 hover:underline dark:text-amber-400 dark:hover:text-amber-300"
            >
              Forgot password?
            </Link>
          </div>
          <div className="group relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-11 items-center justify-center text-stone-400 transition-colors group-focus-within:text-amber-500 dark:text-stone-500 dark:group-focus-within:text-amber-400">
              {lockIcon}
            </span>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={trackCapsLock}
              onKeyDown={trackCapsLock}
              onBlur={() => setCapsLock(false)}
              required
              className={`${AUTH_INPUT} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 z-10 flex w-11 items-center justify-center rounded-r-xl text-stone-400 transition hover:text-stone-700 dark:hover:text-amber-50"
            >
              {showPassword ? (
                <svg
                  viewBox="0 0 24 24"
                  className="h-[18px] w-[18px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="h-[18px] w-[18px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {capsLock && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 4 4 12h4v4h8v-4h4L12 4Z" />
                <line x1="8" y1="20" x2="16" y2="20" />
              </svg>
              Caps Lock is on
            </p>
          )}
        </div>

        {error && <AuthError message={error} />}

        <AuthSubmit
          busy={submitting}
          disabled={!canSubmit}
          busyLabel="Signing in…"
        >
          Sign in
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
