"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { api, uploadImage } from "@/lib/api";
import { Role, type User } from "@/lib/types";

const ROLE_META: Record<Role, { label: string; pill: string }> = {
  [Role.ADMIN]: {
    label: "Admin",
    pill: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  [Role.CASHIER]: {
    label: "Cashier",
    pill: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
};

const EMPTY = { name: "", username: "", password: "", role: Role.CASHIER };

function Settings() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingAvatar(true);
    try {
      const url = await uploadImage(file);
      setAvatar(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploadingAvatar(false);
      // Allow re-selecting the same file after a failure/removal.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const loadUsers = useCallback(async () => {
    try {
      const data = await api<User[]>("/users");
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const created = await api<User>("/users", {
        method: "POST",
        body: {
          name: form.name.trim(),
          username: form.username.trim(),
          password: form.password,
          role: form.role,
        },
      });
      setSuccess(`${created.name} (${ROLE_META[created.role].label}) created.`);
      setForm(EMPTY);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    form.name.trim().length > 0 &&
    form.username.trim().length >= 3 &&
    form.password.length >= 6 &&
    !submitting;

  return (
    <main className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          Settings
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Manage staff accounts and access levels.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Create user form */}
        <section className="lg:col-span-2">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-900"
          >
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">
              Create user
            </h2>
            <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
              Add a new admin or cashier account.
            </p>

            <div className="mt-5 space-y-4">
              <Field label="Full name">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Doe"
                  autoComplete="off"
                  className={inputClass}
                />
              </Field>

              <Field label="Username" hint="At least 3 characters">
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  placeholder="jane"
                  autoComplete="off"
                  className={inputClass}
                />
              </Field>

              <Field label="Password" hint="At least 6 characters">
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={inputClass}
                />
              </Field>

              <Field label="Role">
                <div className="grid grid-cols-2 gap-2">
                  {[Role.CASHIER, Role.ADMIN].map((role) => {
                    const active = form.role === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setForm({ ...form, role })}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                          active
                            ? "border-[#2A1D15] bg-[#2A1D15] text-amber-50 dark:border-amber-500 dark:bg-amber-500 dark:text-stone-950"
                            : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                        }`}
                      >
                        {ROLE_META[role].label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </p>
            )}
            {success && (
              <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-400">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-5 w-full rounded-xl bg-[#2A1D15] px-4 py-2.5 text-sm font-semibold text-amber-50 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:text-stone-950"
            >
              {submitting ? "Creating…" : "Create user"}
            </button>
          </form>
        </section>

        {/* User list */}
        <section className="lg:col-span-3">
          <div className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">
                Staff
              </h2>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                {users.length} {users.length === 1 ? "account" : "accounts"}
              </span>
            </div>

            {loading ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Loading users…
              </p>
            ) : users.length === 0 ? (
              <p className="text-sm text-stone-400 dark:text-stone-500">
                No users yet.
              </p>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {users.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-3 py-3 transition-colors hover:bg-stone-50/60 dark:hover:bg-stone-800/40"
                  >
                    <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-amber-200 text-sm font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-300">
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                        {u.name}
                      </p>
                      <p className="truncate text-xs text-stone-400 dark:text-stone-500">
                        @{u.username}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_META[u.role].pill}`}
                    >
                      {ROLE_META[u.role].label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-[#2A1D15] focus:ring-2 focus:ring-[#2A1D15]/15 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-amber-500 dark:focus:ring-amber-500/20";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
          {label}
        </span>
        {hint && (
          <span className="text-xs text-stone-400 dark:text-stone-500">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

export default function AdminSettingsPage() {
  return (
    <RequireAuth role={Role.ADMIN}>
      <Settings />
    </RequireAuth>
  );
}
