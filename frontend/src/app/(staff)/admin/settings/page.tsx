"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";
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
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // The user currently being edited (drives the modal).
  const [editing, setEditing] = useState<User | null>(null);
  // The user pending deletion (drives the confirm dialog).
  const [deleting, setDeleting] = useState<User | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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
          avatar,
        },
      });
      setSuccess(`${created.name} (${ROLE_META[created.role].label}) created.`);
      setForm(EMPTY);
      setAvatar(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

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
                <RolePicker
                  value={form.role}
                  onChange={(role) => setForm({ ...form, role })}
                />
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
                  <StaffRow
                    key={u.id}
                    user={u}
                    isSelf={u.id === currentUser?.id}
                    onEdit={() => setEditing(u)}
                    onDelete={() => setDeleting(u)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

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
    </main>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pos-drop w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-800 dark:bg-stone-900"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6M10 11v6M14 11v6" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">
              {title}
            </h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Staff row + ⋮ dropdown ───────────────────────────────────────────────

function StaffRow({
  user,
  isSelf,
  onEdit,
  onDelete,
}: {
  user: User;
  isSelf: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  return (
    <li className="flex items-center gap-3 py-3">
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
        </p>
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
            className="pos-drop absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-800 dark:bg-stone-900"
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
            className="flex-1 rounded-xl bg-[#2A1D15] px-4 py-2.5 text-sm font-semibold text-amber-50 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:text-stone-950"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────

const sw = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-[#2A1D15] focus:ring-2 focus:ring-[#2A1D15]/15 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-amber-500 dark:focus:ring-amber-500/20";

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
                ? "border-[#2A1D15] bg-[#2A1D15] text-amber-50 dark:border-amber-500 dark:bg-amber-500 dark:text-stone-950"
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
