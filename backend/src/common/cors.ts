/**
 * Shared CORS origin policy for both the REST app (main.ts) and the Socket.IO
 * gateway (orders.gateway.ts). Credentials are enabled, so we reflect the
 * request's own origin when it's trusted rather than using a wildcard.
 *
 * Trusted = an explicit CORS_ORIGIN entry, or any localhost / private-LAN
 * address, so the POS works from phones and tablets on the same WiFi without
 * hard-coding each device's IP.
 */

const isPrivateHost = (hostname: string): boolean =>
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
    hostname,
  );

export function isAllowedOrigin(origin: string | undefined): boolean {
  // Same-origin / non-browser requests (curl, server-side) have no origin.
  if (!origin) {
    return true;
  }

  const allowList = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (allowList.includes(origin)) {
    return true;
  }

  try {
    return isPrivateHost(new URL(origin).hostname);
  } catch {
    // malformed origin — reject
    return false;
  }
}

/** Express/Socket.IO-style origin callback built on {@link isAllowedOrigin}. */
export const corsOrigin = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void => {
  if (isAllowedOrigin(origin)) {
    return callback(null, true);
  }
  callback(new Error(`Origin ${origin} not allowed by CORS`));
};
