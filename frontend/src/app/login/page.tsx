"use client";

import { Fraunces } from "next/font/google";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";

// Warm display serif for the brand & headings — matches the POS screen.
const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"] });

// Path to the coffee hero photo (drop the file at frontend/public/coffee-login.jpg).
const HERO = "/coffee-login.jpg";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in → send them where they belong.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1a120c] px-5 py-12">
      {/* Coffee photo (espresso fallback underneath if absent) */}
      <div
        className="absolute inset-0 bg-[#1a120c] bg-cover bg-center"
        style={{ backgroundImage: `url('${HERO}')` }}
      />
      {/* Espresso washes for contrast + a centered glow so the card pops */}
      <div className="absolute inset-0 bg-[#160f0a]/75" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#160f0a]/90 via-transparent to-[#160f0a]/60" />
      <div className="ios-drift pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/15 blur-[120px]" />

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div
          className="ios-rise mb-8 flex flex-col items-center text-center"
          style={{ animationDelay: "60ms" }}
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50/10 text-3xl ring-1 ring-inset ring-amber-50/20 backdrop-blur-sm">
            ☕
          </span>
          <h1
            className={`${display.className} mt-5 text-5xl font-semibold leading-none text-amber-50`}
          >
            POS<span className="text-amber-400">CAFE</span>
          </h1>
          <p className="mt-3 text-sm text-amber-50/60">
            Point of sale, brewed for your counter
          </p>
        </div>

        {/* Card */}
        <div
          className="ios-rise rounded-3xl border border-white/60 bg-white/95 p-8 shadow-[0_30px_80px_-20px_rgba(22,15,10,0.6)] backdrop-blur-xl sm:p-9 dark:border-white/10 dark:bg-stone-900/85"
          style={{ animationDelay: "160ms" }}
        >
          <div className="mb-6">
            <h2
              className={`${display.className} text-2xl font-semibold text-stone-900 dark:text-stone-100`}
            >
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Sign in to your counter to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field
              id="username"
              label="Username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={setUsername}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
            />

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300"
              >
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-stone-400 dark:text-stone-500">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-11 pr-11 text-stone-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-stone-400 transition hover:text-stone-700 dark:hover:text-stone-200"
                >
                  {showPassword ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
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
                      className="h-5 w-5"
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
            </div>

            {error && (
              <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#2A1D15] py-3 font-semibold text-amber-50 shadow-sm transition hover:bg-[#3a2a1f] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-500 dark:text-stone-950 dark:hover:bg-amber-400"
            >
              {submitting ? (
                "Signing in…"
              ) : (
                <>
                  Sign in
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>

        <p
          className="ios-rise mt-6 text-center text-xs text-amber-50/40"
          style={{ animationDelay: "260ms" }}
        >
          POSCAFE · Coffee shop point of sale
        </p>
      </div>
    </main>
  );
}

// A labelled text input with a leading icon, styled for the warm theme.
function Field({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
  icon,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300"
      >
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-stone-400 dark:text-stone-500">
          {icon}
        </span>
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-11 pr-3 text-stone-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-100"
        />
      </div>
    </div>
  );
}
