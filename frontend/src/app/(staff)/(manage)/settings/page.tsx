"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { RequireAuth } from "@/components/require-auth";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useClickOutside } from "@/lib/use-click-outside";
import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/lib/branding-context";
import { api, uploadImage } from "@/lib/api";
import { Role, type PaymentConfig, type User } from "@/lib/types";
import {
  CASHIER_PAGES,
  DEFAULT_CASHIER_PAGES,
  resolveCashierPages,
} from "@/lib/permissions";

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

const EMPTY = {
  name: "",
  username: "",
  email: "",
  password: "",
  role: Role.CASHIER,
};

const sw = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type Tab = "general" | "staff";

const TABS: { key: Tab; label: string; hint: string; icon: ReactNode }[] = [
  {
    key: "general",
    label: "General",
    hint: "App name & logo",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" {...sw}>
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
  {
    key: "staff",
    label: "Staff",
    hint: "Accounts & access",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" {...sw}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

function Settings() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-pos-page-fg">
          Settings
        </h1>
        <p className="text-sm text-pos-page-fg/60">
          Manage your app branding, staff accounts and access levels.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Section sidebar */}
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  active
                    ? "bg-pos-button text-pos-button-fg"
                    : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                }`}
              >
                <span className="shrink-0">{t.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">
                    {t.label}
                  </span>
                  <span
                    className={`hidden text-xs lg:block ${
                      active
                        ? "text-pos-button-fg/70"
                        : "text-stone-400 dark:text-stone-500"
                    }`}
                  >
                    {t.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Active section */}
        <div className="min-w-0">
          {tab === "general" ? <AppSettingsPanel /> : <StaffPanel />}
        </div>
      </div>
    </main>
  );
}

// ── General: app name & logo ─────────────────────────────────────────────

function AppSettingsPanel() {
  const { appName, logoUrl, khrPerUsd, refresh } = useBranding();
  const [name, setName] = useState(appName);
  const [logo, setLogo] = useState<string | null>(logoUrl);
  const [rate, setRate] = useState(String(khrPerUsd));
  // Bakong/KHQR config lives behind an admin-only endpoint, so it's loaded
  // separately from the public branding settings.
  const [bakongId, setBakongId] = useState("");
  const [bakongName, setBakongName] = useState("");
  const [bakongCity, setBakongCity] = useState("");
  const [savedPayment, setSavedPayment] = useState<PaymentConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<PaymentConfig>("/settings/payment")
      .then((cfg) => {
        if (cancelled) return;
        setSavedPayment(cfg);
        setBakongId(cfg.bakongAccountId ?? "");
        setBakongName(cfg.bakongMerchantName ?? "");
        setBakongCity(cfg.bakongMerchantCity ?? "");
      })
      .catch(() => {
        // Non-fatal: the rest of the form still works without it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync local fields once branding has loaded / changed from the backend.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(appName);
    setLogo(logoUrl);
    setRate(String(khrPerUsd));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [appName, logoUrl, khrPerUsd]);

  const rateNum = Number(rate);
  const rateValid =
    Number.isInteger(rateNum) && rateNum >= 100 && rateNum <= 100000;
  // A Bakong id looks like "name@bank"; empty is allowed (QR stays off).
  const bakongValid =
    bakongId.trim() === "" || /^[\w.-]{1,32}@[a-zA-Z0-9]{2,16}$/.test(bakongId.trim());
  const paymentDirty =
    savedPayment !== null &&
    (bakongId.trim() !== (savedPayment.bakongAccountId ?? "") ||
      bakongName.trim() !== (savedPayment.bakongMerchantName ?? "") ||
      bakongCity.trim() !== (savedPayment.bakongMerchantCity ?? ""));
  const dirty =
    name.trim() !== appName ||
    logo !== logoUrl ||
    rateNum !== khrPerUsd ||
    paymentDirty;
  const canSave =
    name.trim().length > 0 && rateValid && bakongValid && dirty && !saving;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await api("/settings", {
        method: "PATCH",
        body: {
          appName: name.trim(),
          logoUrl: logo,
          khrPerUsd: rateNum,
          bakongAccountId: bakongId.trim() || null,
          bakongMerchantName: bakongName.trim() || null,
          bakongMerchantCity: bakongCity.trim() || null,
        },
      });
      await refresh();
      setSavedPayment({
        bakongAccountId: bakongId.trim() || null,
        bakongMerchantName: bakongName.trim() || null,
        bakongMerchantCity: bakongCity.trim() || null,
      });
      setSuccess("App settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow duration-200 hover:shadow-md dark:border-stone-800 dark:bg-stone-900"
    >
      <h2 className="font-semibold text-stone-900 dark:text-stone-100">
        App branding
      </h2>
      <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
        The name and logo shown in the sidebar, login screen and menu.
      </p>

      <div className="mt-5 space-y-4">
        <Field label="Logo" hint="Optional — square image works best">
          <LogoPicker value={logo} onChange={setLogo} onError={setError} />
        </Field>

        <Field label="App name" hint="Up to 60 characters">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="POSCAFE"
            autoComplete="off"
            className={inputClass}
          />
        </Field>

        <Field
          label="Exchange rate"
          hint="Riel per 1 US dollar — shown next to prices at checkout"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-stone-500 dark:text-stone-400">
              $1 =
            </span>
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              min={100}
              max={100000}
              step={50}
              inputMode="numeric"
              className={`${inputClass} max-w-36`}
            />
            <span className="text-sm text-stone-500 dark:text-stone-400">
              ៛ (KHR)
            </span>
          </div>
        </Field>
      </div>

      <div className="mt-7 border-t border-stone-100 pt-5 dark:border-stone-800">
        <h3 className="font-semibold text-stone-900 dark:text-stone-100">
          QR payment (KHQR)
        </h3>
        <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
          Your Bakong account. Once set, the Take Payment screen shows a
          scannable KHQR with the order amount already filled in.
        </p>

        <div className="mt-4 space-y-4">
          <Field
            label="Bakong account ID"
            hint='Looks like "yourname@aclb" — find it in your banking app'
          >
            <input
              type="text"
              value={bakongId}
              onChange={(e) => setBakongId(e.target.value)}
              placeholder="yourname@aclb"
              autoComplete="off"
              spellCheck={false}
              className={inputClass}
            />
            {!bakongValid && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Must look like &quot;name@bank&quot;.
              </p>
            )}
          </Field>

          <Field
            label="Merchant name"
            hint="Shown in the customer's banking app — max 25 characters"
          >
            <input
              type="text"
              value={bakongName}
              onChange={(e) => setBakongName(e.target.value)}
              maxLength={25}
              placeholder={name || "POSCAFE"}
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <Field label="Merchant city" hint="Max 15 characters">
            <input
              type="text"
              value={bakongCity}
              onChange={(e) => setBakongCity(e.target.value)}
              maxLength={15}
              placeholder="Phnom Penh"
              autoComplete="off"
              className={inputClass}
            />
          </Field>
        </div>
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
        disabled={!canSave}
        className="mt-5 rounded-xl bg-pos-button px-5 py-2.5 text-sm font-semibold text-pos-button-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

// Logo upload control — mirrors AvatarPicker but with a rounded-square preview.
function LogoPicker({
  value,
  onChange,
  onError,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  onError: (msg: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="Logo preview"
          className="h-14 w-14 rounded-2xl object-cover shadow-sm"
        />
      ) : (
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-pos-button text-2xl text-pos-button-fg shadow-sm">
          ☕
        </span>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
        >
          {uploading ? "Uploading…" : value ? "Change" : "Upload"}
        </button>
        {value && !uploading && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

// ── Staff: accounts & access ─────────────────────────────────────────────

function StaffPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Whether the "Create user" modal is open.
  const [creating, setCreating] = useState(false);
  // The user currently being edited (drives the modal).
  const [editing, setEditing] = useState<User | null>(null);
  // The user pending deletion (drives the confirm dialog).
  const [deleting, setDeleting] = useState<User | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  // The cashier whose page permissions are being edited (drives that modal).
  const [permitting, setPermitting] = useState<User | null>(null);

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
    // Mount fetch: loading the staff list after mount is intentional, not a
    // render-time state update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers]);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await api(`/users/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow duration-200 hover:shadow-md dark:border-stone-800 dark:bg-stone-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">
              Staff
            </h2>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
              {users.length} {users.length === 1 ? "account" : "accounts"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-xl bg-pos-button px-3.5 py-2 text-sm font-semibold text-pos-button-fg transition hover:opacity-90"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" {...sw}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add user
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Loading users…
          </p>
        ) : users.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-stone-500">
            No users yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {[...users]
              .sort((a, b) => b.id - a.id)
              .map((u) => (
              <StaffRow
                key={u.id}
                user={u}
                isSelf={u.id === currentUser?.id}
                onEdit={() => setEditing(u)}
                onDelete={() => setDeleting(u)}
                onPermissions={() => setPermitting(u)}
              />
            ))}
          </ul>
        )}
      </div>

      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await loadUsers();
          }}
        />
      )}

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadUsers();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete user"
          message={`Delete ${deleting.name} (@${deleting.username})? This action cannot be undone.`}
          confirmLabel="Delete"
          busy={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}

      {permitting && (
        <PermissionsModal
          user={permitting}
          onClose={() => setPermitting(null)}
          onSaved={async () => {
            setPermitting(null);
            await loadUsers();
          }}
        />
      )}
    </>
  );
}

// ── Create modal ─────────────────────────────────────────────────────────

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [avatar, setAvatar] = useState<string | null>(null);
  // Sidebar pages a new cashier may see (only used when role === cashier).
  const [pages, setPages] = useState<string[]>(DEFAULT_CASHIER_PAGES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api<User>("/users", {
        method: "POST",
        body: {
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          avatar,
          // Page restrictions only apply to cashiers.
          ...(form.role === Role.CASHIER ? { allowedPages: pages } : {}),
        },
      });
      onCreated();
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
    // A cashier locked out of every page can't use the app (and PageGuard would
    // bounce them to /login), so require at least one granted page.
    (form.role !== Role.CASHIER || pages.length > 0) &&
    !submitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="pos-drop max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-800 dark:bg-stone-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">
              Create user
            </h2>
            <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
              Add a new admin or cashier account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Profile photo" hint="Optional">
            <AvatarPicker
              value={avatar}
              name={form.name}
              onChange={setAvatar}
              onError={setError}
            />
          </Field>

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
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="jane"
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <Field
            label="Email"
            hint={
              form.role === Role.ADMIN
                ? "Required for the forgot-password code — without one this admin can't reset themselves"
                : "Optional — cashiers get their password reset by an admin"
            }
          >
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jane@example.com"
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <Field label="Password" hint="At least 6 characters">
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>

          <Field label="Role">
            <RolePicker
              value={form.role}
              onChange={(role) => setForm({ ...form, role })}
            />
          </Field>

          {form.role === Role.CASHIER && (
            <Field label="Page access" hint="Sidebar pages this cashier can see">
              <PagePermissions value={pages} onChange={setPages} />
            </Field>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 rounded-xl bg-pos-button px-4 py-2.5 text-sm font-semibold text-pos-button-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create user"}
          </button>
        </div>
      </form>
    </div>
  );
}


// ── Staff row + ⋮ dropdown ───────────────────────────────────────────────

function StaffRow({
  user,
  isSelf,
  onEdit,
  onDelete,
  onPermissions,
}: {
  user: User;
  isSelf: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPermissions: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-3 transition-shadow duration-200 hover:bg-stone-50 hover:shadow-md dark:hover:bg-stone-800/40">
      <Avatar src={user.avatar} name={user.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
          {user.name}
          {isSelf && (
            <span className="ml-1.5 text-xs font-normal text-stone-400">
              (you)
            </span>
          )}
        </p>
        <p className="truncate text-xs text-stone-400 dark:text-stone-500">
          @{user.username}
          {user.email && <span className="ml-1.5">· {user.email}</span>}
        </p>
        {/* An admin with no email can't use the forgot-password flow, and
            there's no one above them to reset it — surface that here rather
            than at the moment they're locked out. */}
        {user.role === Role.ADMIN && !user.email && (
          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-500">
            <svg viewBox="0 0 24 24" className="h-3 w-3 flex-shrink-0" {...sw}>
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            No recovery email
          </p>
        )}
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_META[user.role].pill}`}
      >
        {ROLE_META[user.role].label}
      </span>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Open actions"
          className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="pos-drop absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-800 dark:bg-stone-900"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-stone-700 transition hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" {...sw}>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Edit
            </button>
            {user.role === Role.CASHIER && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onPermissions();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-stone-700 transition hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" {...sw}>
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Permissions
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              disabled={isSelf}
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              title={isSelf ? "You can't delete your own account" : undefined}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" {...sw}>
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6M10 11v6M14 11v6" />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

// ── Edit modal ───────────────────────────────────────────────────────────

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(user.role);
  const [avatar, setAvatar] = useState<string | null>(user.avatar ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api<User>(`/users/${user.id}`, {
        method: "PATCH",
        body: {
          name: name.trim(),
          username: username.trim(),
          // "" clears the address on the backend; null would too, but the
          // input can only ever produce a string.
          email: email.trim(),
          role,
          avatar,
          ...(password ? { password } : {}),
        },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    name.trim().length > 0 &&
    username.trim().length >= 3 &&
    (password.length === 0 || password.length >= 6) &&
    !saving;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
        className="pos-drop w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-800 dark:bg-stone-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100">
            Edit user
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Profile photo" hint="Optional">
            <AvatarPicker
              value={avatar}
              name={name}
              onChange={setAvatar}
              onError={setError}
            />
          </Field>

          <Field label="Full name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <Field label="Username" hint="At least 3 characters">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <Field
            label="Email"
            hint={
              role === Role.ADMIN
                ? "Where the forgot-password code is sent"
                : "Optional — cashiers get their password reset by an admin"
            }
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <Field label="New password" hint="Leave blank to keep current">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>

          <Field label="Role">
            <RolePicker value={role} onChange={setRole} />
          </Field>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="flex-1 rounded-xl bg-pos-button px-4 py-2.5 text-sm font-semibold text-pos-button-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Permissions modal ────────────────────────────────────────────────────

function PermissionsModal({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pages, setPages] = useState<string[]>(
    resolveCashierPages(user.allowedPages),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api<User>(`/users/${user.id}`, {
        method: "PATCH",
        body: { allowedPages: pages },
      });
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update permissions",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
        className="pos-drop w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-800 dark:bg-stone-900"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100">
            Page access
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
          Choose which sidebar pages{" "}
          <span className="font-medium text-stone-700 dark:text-stone-300">
            {user.name}
          </span>{" "}
          can see.
        </p>

        <PagePermissions value={pages} onChange={setPages} />

        <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">
          {pages.length === 0
            ? "Select at least one page — a cashier with no access can't sign in."
            : "Changes take effect the next time this cashier logs in."}
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || pages.length === 0}
            className="flex-1 rounded-xl bg-pos-button px-4 py-2.5 text-sm font-semibold text-pos-button-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save access"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Multi-select grid of the cashier-assignable sidebar pages.
function PagePermissions({
  value,
  onChange,
}: {
  value: string[];
  onChange: (pages: string[]) => void;
}) {
  function toggle(key: string) {
    onChange(
      value.includes(key)
        ? value.filter((k) => k !== key)
        : [...value, key],
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {CASHIER_PAGES.map((p) => {
        const active = value.includes(p.key);
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => toggle(p.key)}
            aria-pressed={active}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
              active
                ? "border-pos-button bg-pos-button text-pos-button-fg"
                : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            }`}
          >
            <span
              className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                active
                  ? "border-transparent bg-white/20 dark:bg-stone-950/20"
                  : "border-stone-300 dark:border-stone-600"
              }`}
            >
              {active && (
                <svg viewBox="0 0 24 24" className="h-3 w-3" {...sw}>
                  <path d="m5 13 4 4L19 7" />
                </svg>
              )}
            </span>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-pos-button focus:ring-2 focus:ring-pos-button/15 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500";

function Avatar({ src, name }: { src?: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-amber-200 text-sm font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-300">
      {name.charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function AvatarPicker({
  value,
  name,
  onChange,
  onError,
}: {
  value: string | null;
  name: string;
  onChange: (url: string | null) => void;
  onError: (msg: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar src={value} name={name} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
        >
          {uploading ? "Uploading…" : value ? "Change" : "Upload"}
        </button>
        {value && !uploading && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

function RolePicker({
  value,
  onChange,
}: {
  value: Role;
  onChange: (role: Role) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[Role.CASHIER, Role.ADMIN].map((role) => {
        const active = value === role;
        return (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "border-pos-button bg-pos-button text-pos-button-fg"
                : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            }`}
          >
            {ROLE_META[role].label}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
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
