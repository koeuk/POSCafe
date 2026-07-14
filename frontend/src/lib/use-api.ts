"use client";

import {
  useCallback,
  useEffect,
  useState,
  type DependencyList,
  type Dispatch,
  type SetStateAction,
} from "react";

/** Normalizes an unknown thrown value to a message string. */
export function toErrorMessage(
  err: unknown,
  fallback = "Something went wrong",
): string {
  return err instanceof Error ? err.message : fallback;
}

export interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-run the fetcher (e.g. after a mutation). */
  reload: () => void;
  /** Update the cached data locally (optimistic UI). */
  setData: Dispatch<SetStateAction<T | null>>;
}

/**
 * Fetches on mount and whenever `deps` change, tracking loading/error state and
 * discarding stale responses. Pass `pollMs` to silently re-fetch on an interval
 * (poll refreshes don't toggle `loading`). Replaces the copy-pasted
 * loading/error/cancelled effect triad across the staff pages.
 */
export function useFetch<T>(
  fn: () => Promise<T>,
  deps: DependencyList,
  options: { fallback?: string; pollMs?: number } = {},
): UseFetchResult<T> {
  const { fallback = "Failed to load", pollMs } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function run(silent = false) {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const result = await fn();
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(toErrorMessage(err, fallback));
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    }

    void run();
    const timer = pollMs
      ? setInterval(() => void run(true), pollMs)
      : undefined;

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // fn/fallback are intentionally excluded — callers pass an inline fetcher
    // and declare their real inputs via `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, pollMs]);

  return { data, loading, error, reload, setData };
}
