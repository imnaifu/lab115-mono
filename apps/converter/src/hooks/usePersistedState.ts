import { useEffect, useRef, useState } from "react";

// SSR-safe localStorage-backed React state.
//
// During SSR (Astro pre-rendering), `localStorage` doesn't exist, so the
// initial render uses `initial`. After hydration we read from storage and
// `setValue` if a stored value exists. The first write to storage is gated
// behind a "have we hydrated yet" flag, otherwise we'd clobber the saved
// value with the SSR default on mount.
export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const hydratedRef = useRef(false);

  // Read once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // ignore — fall back to initial
    }
    hydratedRef.current = true;
  }, [key]);

  // Write on every change AFTER the initial hydration read has run.
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota / disabled storage
    }
  }, [key, value]);

  return [value, setValue];
}
