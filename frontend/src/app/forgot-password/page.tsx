"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  AUTH_INPUT,
  AuthError,
  AuthField,
  AuthShell,
  AuthSubmit,
  lockIcon,
  userIcon,
} from "@/components/auth-shell";
import { api } from "@/lib/api";

// Mirrors the backend: codes are 6 digits, live 10 minutes, and a new one can
// only be requested once a minute.
const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const MIN_PASSWORD_LENGTH = 6;

type Step = "identify" | "code" | "password" | "done";

export default function ForgotPasswordPage() {
  // useSearchParams needs a Suspense boundary to keep the route statically
  // renderable; the fallback is the same shell so there's no visible flash.
  return (
    <Suspense
      fallback={
        <AuthShell title="Reset password" subtitle="Loading…">
          <div className="h-40" />
        </AuthShell>
      }
    >
      <ForgotPasswordFlow />
    </Suspense>
  );
}

function ForgotPasswordFlow() {
  const router = useRouter();
  const params = useSearchParams();

  const [step, setStep] = useState<Step>("identify");
  // Prefilled from the login screen when the admin already typed a username.
  const [identifier, setIdentifier] = useState(params.get("identifier") ?? "");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Ticks the resend timer down. The button is the only thing that reads it,
  // so a per-second re-render of this small tree is fine.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const sendCode = useCallback(async (target: string) => {
    await api("/auth/forgot-password", {
      method: "POST",
      body: { identifier: target.trim() },
    });
    setCooldown(RESEND_COOLDOWN_SECONDS);
    // Any digits from the previous code are stale once a new one is issued.
    setCode("");
  }, []);

  async function handleIdentify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await sendCode(identifier);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || busy) return;
    setError(null);
    setBusy(true);
    try {
      await sendCode(identifier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ resetToken: string }>("/auth/verify-reset-code", {
        method: "POST",
        body: { identifier: identifier.trim(), code },
      });
      setResetToken(res.resetToken);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the code");
      // Clear the boxes so the next attempt starts from an empty field rather
      // than making them backspace six times.
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { resetToken, password },
      });
      setStep("done");
      // Give them a beat to read the confirmation before the login screen.
      setTimeout(() => router.replace("/login"), 2200);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update the password",
      );
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <AuthShell
        title="Password updated"
        subtitle="You can sign in with your new password"
      >
        <div className="flex flex-col items-center py-4 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 13 4 4L19 7" />
            </svg>
          </span>
          <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
            Taking you back to sign in…
          </p>
          <Link
            href="/login"
            className="mt-5 text-sm font-medium text-amber-600 underline-offset-2 hover:underline dark:text-amber-400"
          >
            Go now
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (step === "identify") {
    return (
      <AuthShell
        title="Reset password"
        subtitle="We'll email a 6-digit code to the address on your admin account"
      >
        <form onSubmit={handleIdentify} className="space-y-5">
          <AuthField
            id="identifier"
            label="Username or email"
            type="text"
            placeholder="admin"
            autoComplete="username"
            autoFocus
            value={identifier}
            onChange={setIdentifier}
            icon={userIcon}
            hint="Only admin accounts can reset themselves. Cashiers: ask an admin to set a new password for you."
          />

          {error && <AuthError message={error} />}

          <AuthSubmit
            busy={busy}
            disabled={identifier.trim() === "" || busy}
            busyLabel="Sending code…"
          >
            Send code
          </AuthSubmit>

          <BackToLogin />
        </form>
      </AuthShell>
    );
  }

  if (step === "code") {
    return (
      <AuthShell
        title="Enter the code"
        subtitle="Check the inbox for your admin account — the code expires in 10 minutes"
      >
        <form onSubmit={handleVerify} className="space-y-5">
          <CodeInput value={code} onChange={setCode} />

          {error && <AuthError message={error} />}

          <AuthSubmit
            busy={busy}
            // Every box filled — a gap in the middle survives as a space, and
            // the backend would reject it with a validation error.
            disabled={!/^\d{6}$/.test(code) || busy}
            busyLabel="Checking…"
          >
            Continue
          </AuthSubmit>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setStep("identify");
                setError(null);
                setCode("");
              }}
              className="font-medium text-stone-500 underline-offset-2 hover:underline dark:text-stone-400"
            >
              Wrong account?
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || busy}
              className="font-medium text-amber-600 underline-offset-2 transition hover:underline disabled:cursor-not-allowed disabled:text-stone-400 disabled:no-underline dark:text-amber-400 dark:disabled:text-stone-500"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>

          <BackToLogin />
        </form>
      </AuthShell>
    );
  }

  const passwordsMatch = password === confirm;
  const canSubmit =
    password.length >= MIN_PASSWORD_LENGTH && passwordsMatch && !busy;

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Pick something you'll remember — at least 6 characters"
    >
      <form onSubmit={handleReset} className="space-y-5">
        <div>
          <label
            htmlFor="new-password"
            className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300"
          >
            New password
          </label>
          <div className="group relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-11 items-center justify-center text-stone-400 transition-colors group-focus-within:text-amber-500 dark:text-stone-500 dark:group-focus-within:text-amber-400">
              {lockIcon}
            </span>
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              <svg
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px]"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {showPassword ? (
                  <>
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </>
                ) : (
                  <>
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300"
          >
            Confirm password
          </label>
          <div className="group relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-11 items-center justify-center text-stone-400 transition-colors group-focus-within:text-amber-500 dark:text-stone-500 dark:group-focus-within:text-amber-400">
              {lockIcon}
            </span>
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className={`${AUTH_INPUT} pr-3`}
            />
          </div>
          {confirm !== "" && !passwordsMatch && (
            <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              Passwords don&apos;t match yet
            </p>
          )}
        </div>

        {error && <AuthError message={error} />}

        <AuthSubmit busy={busy} disabled={!canSubmit} busyLabel="Saving…">
          Update password
        </AuthSubmit>

        <BackToLogin />
      </form>
    </AuthShell>
  );
}

function BackToLogin() {
  return (
    <p className="pt-1 text-center text-sm text-stone-500 dark:text-stone-400">
      <Link
        href="/login"
        className="font-medium text-amber-600 underline-offset-2 hover:underline dark:text-amber-400"
      >
        Back to sign in
      </Link>
    </p>
  );
}

/**
 * Six single-character boxes rather than one text field: at a counter the code
 * is read off a phone a digit at a time, and the boxes make it obvious how many
 * are left. Typing advances, backspace retreats, and a pasted code fills the
 * row — the three ways people actually enter these.
 */
function CodeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(CODE_LENGTH, " ").slice(0, CODE_LENGTH).split("");

  function setDigit(index: number, digit: string) {
    const next = digits.map((d, i) => (i === index ? digit : d)).join("");
    onChange(next.trimEnd());
  }

  function handleChange(index: number, raw: string) {
    // Take the last character typed: on a re-type the box already holds one.
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    setDigit(index, digit);
    refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index].trim()) {
        setDigit(index, " ");
      } else {
        refs.current[index - 1]?.focus();
        setDigit(index - 1, " ");
      }
    } else if (e.key === "ArrowLeft") {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight") {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted.slice(0, CODE_LENGTH));
    // Land on the first empty box, or the last one for a complete code.
    refs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  }

  return (
    <div>
      <label
        htmlFor="code-0"
        className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300"
      >
        6-digit code
      </label>
      <div className="flex justify-between gap-2">
        {digits.map((digit, i) => (
          <input
            key={i}
            id={`code-${i}`}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            // Lets iOS/Android offer the code straight from the SMS/email
            // notification on the first box.
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={i === 0}
            maxLength={1}
            value={digit.trim()}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            aria-label={`Digit ${i + 1}`}
            className="h-14 w-full rounded-xl border text-center text-xl font-semibold tabular-nums outline-none transition duration-200 border-stone-200 bg-white text-stone-900 hover:border-stone-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 dark:border-white/12 dark:bg-black/30 dark:text-stone-50 dark:hover:border-white/20 dark:focus:border-amber-400/70 dark:focus:ring-amber-400/20"
          />
        ))}
      </div>
    </div>
  );
}
