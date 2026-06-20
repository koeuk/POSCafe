// Shared API client for the POSCAFE backend (NestJS).
// Attaches the JWT (stored client-side) to every request.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const TOKEN_KEY = "poscafe_token";

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

export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
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
    throw new Error(message);
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

  const res = await fetch(`${API_URL}/uploads/image`, {
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
  return `${API_URL}${data.path}`;
}
