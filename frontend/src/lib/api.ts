// Shared API client for the POSCAFE backend (NestJS).
// Attaches the JWT (stored client-side) to every request.

// Backend port (override with NEXT_PUBLIC_API_PORT if it ever moves off 3001).
const API_PORT = process.env.NEXT_PUBLIC_API_PORT ?? "3001";

/**
 * Base URL of the NestJS backend.
 * - An explicit NEXT_PUBLIC_API_URL always wins (e.g. a separate API host).
 * - Otherwise, in the browser, talk to the SAME host the app was opened from,
 *   on the backend port. This means localhost and the LAN IP both work with no
 *   reconfiguration — a phone opening http://192.168.x.x:3000 automatically
 *   calls http://192.168.x.x:3001.
 * - On the server (SSR) fall back to localhost, since the Next and Nest
 *   processes share a machine.
 */
export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  return `http://localhost:${API_PORT}`;
}

const TOKEN_KEY = "poscafe_token";

// Cached user record, kept alongside the token so a reload can render the shell
// immediately while /auth/me revalidates in the background.
export const USER_KEY = "poscafe_user";

/** Drops the whole client-side session (token + cached user). */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

/** A non-2xx response. Carries the status so callers can branch on it. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = getToken();

  const res = await fetch(`${getApiUrl()}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = (data as { message?: string }).message ?? message;
    } catch {
      // ignore non-JSON error bodies
    }

    // An expired or revoked token otherwise leaves the app rendering a
    // logged-in shell whose every action fails with a red banner and no way
    // back to login. Drop the dead session and bounce to the login screen.
    //
    // /auth/* is excluded: a 401 from /auth/login is just a wrong password,
    // and /auth/me is the hydration probe that AuthProvider handles itself.
    if (res.status === 401 && token && !path.startsWith("/auth/")) {
      clearSession();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    throw new ApiError(message, res.status);
  }

  // 204 No Content, or an empty body (e.g. an endpoint that returned null —
  // Nest serializes null to an empty response, which res.json() can't parse).
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// Uploads a single image file (multipart) and returns its absolute URL.
// Used by the product form for the main image and gallery images.
export async function uploadImage(file: File): Promise<string> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${getApiUrl()}/uploads/image`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const data = await res.json();
      message = (data as { message?: string }).message ?? message;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  const data = (await res.json()) as { path: string };
  return `${getApiUrl()}${data.path}`;
}
