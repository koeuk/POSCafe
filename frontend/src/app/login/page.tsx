"use client";

import { Fraunces } from "next/font/google";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/lib/branding-context";
import { landingHref } from "@/lib/permissions";

// Warm display serif for the brand & headings — matches the POS screen.
const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"] });

// Path to the coffee hero photo (drop the file at frontend/public/coffee-login.jpg).
const HERO = "/coffee-login.jpg";

// Shared field styling. The dark values matter: the card is already dark, so
// inputs need a *darker* recessed well plus a visible edge, otherwise the box
// disappears into the card and staff can't tell where to type.
const INPUT =
  "w-full rounded-xl border py-3 pl-11 text-[15px] tracking-[-0.01em] outline-none transition duration-200 " +
  "border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 " +
  "hover:border-stone-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 " +
  "dark:border-white/12 dark:bg-black/30 dark:text-stone-50 dark:placeholder:text-stone-500 " +
  "dark:hover:border-white/20 dark:focus:border-amber-400/70 dark:focus:ring-amber-400/20";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const { appName, logoUrl } = useBranding();
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1a120c] px-5 py-12">
      {/* Coffee photo — kept legible instead of buried under a flat black wash */}
      <div
        className="absolute inset-0 scale-105 bg-[#1a120c] bg-cover bg-center"
        style={{ backgroundImage: `url('${HERO}')` }}
      />
      {/* Warm espresso washes: lighter overall, with a vignette so the centre
          stays bright and the edges fall away behind the card. */}
      <div className="absolute inset-0 bg-[#1c120b]/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#160f0a]/70 via-[#160f0a]/20 to-[#160f0a]/85" />
      <div className="absolute inset-0 [background:radial-gradient(115%_85%_at_50%_45%,transparent_20%,rgba(16,10,6,0.75)_100%)]" />
      <div className="ios-drift pointer-events-none absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/20 blur-[130px]" />
      {/* Fine grain — stops the large dark areas from banding and adds texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div
          className="ios-rise mb-8 flex flex-col items-center text-center"
          style={{ animationDelay: "60ms" }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={appName}
              className="h-16 w-16 rounded-2xl object-cover shadow-lg shadow-black/40 ring-1 ring-inset ring-amber-50/25"
            />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-50/10 text-3xl shadow-lg shadow-black/40 ring-1 ring-inset ring-amber-50/25 backdrop-blur-sm">
              ☕
            </span>
          )}
          <h1
            className={`${display.className} mt-5 text-5xl font-semibold leading-none tracking-[-0.02em] text-amber-50 [text-shadow:0_2px_24px_rgba(0,0,0,0.45)]`}
          >
            {appName}
          </h1>
          <p className="mt-3 text-sm text-amber-50/75">
            Point of sale, brewed for your counter
          </p>
        </div>

        {/* Card */}
        <div
          className="ios-rise rounded-3xl border border-white/60 bg-white/95 p-8 shadow-[0_30px_80px_-20px_rgba(22,15,10,0.7)] backdrop-blur-xl sm:p-9 dark:border-white/10 dark:bg-[#1b1310]/85 dark:shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)] dark:ring-1 dark:ring-inset dark:ring-white/5"
          style={{ animationDelay: "160ms" }}
        >
          <div className="mb-7">
            <h2
              className={`${display.className} text-2xl font-semibold tracking-[-0.01em] text-stone-900 dark:text-amber-50`}
            >
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">
              Sign in to your counter to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field
              id="username"
              label="Username"
              type="text"
              placeholder="your username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={setUsername}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  className="h-[18px] w-[18px]"
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
              <div className="group relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-11 items-center justify-center text-stone-400 transition-colors group-focus-within:text-amber-500 dark:text-stone-500 dark:group-focus-within:text-amber-400">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-[18px] w-[18px]"
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
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={trackCapsLock}
                  onKeyDown={trackCapsLock}
                  onBlur={() => setCapsLock(false)}
                  required
                  className={`${INPUT} pr-11`}
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

            {error && (
              <p
                role="alert"
                className="ios-rise flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="mt-0.5 h-4 w-4 flex-shrink-0"
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
              disabled={!canSubmit}
              className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-pos-button py-3.5 font-semibold tracking-[-0.01em] text-pos-button-fg shadow-lg shadow-black/15 transition duration-200 hover:brightness-110 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:brightness-100"
            >
              {submitting ? (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                  </svg>
                  Signing in…
                </>
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
          className="ios-rise mt-6 text-center text-xs text-amber-50/55"
          style={{ animationDelay: "260ms" }}
        >
          {appName} · Coffee shop point of sale
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
  placeholder,
  autoComplete,
  autoFocus,
  value,
  onChange,
  icon,
}: {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  autoComplete: string;
  autoFocus?: boolean;
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
      <div className="group relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-11 items-center justify-center text-stone-400 transition-colors group-focus-within:text-amber-500 dark:text-stone-500 dark:group-focus-within:text-amber-400">
          {icon}
        </span>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className={`${INPUT} pr-3`}
        />
      </div>
    </div>
  );
}
