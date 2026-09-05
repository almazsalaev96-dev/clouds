/**
 * next/navigation, for the single-file build.
 *
 * A hash router with the same surface the app already uses: usePathname,
 * useRouter().push and useSearchParams. Subscriptions go through
 * useSyncExternalStore so every component re-renders on navigation without a
 * context provider being threaded through the tree.
 */

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", notify);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Current hash, normalised to a leading slash: "#/practice?x=1" → "/practice?x=1". */
function currentHash(): string {
  if (typeof window === "undefined") return "/";
  const raw = window.location.hash.replace(/^#/, "");
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function useHash(): string {
  return useSyncExternalStore(subscribe, currentHash, () => "/");
}

export function usePathname(): string {
  return useHash().split("?")[0] || "/";
}

export function useSearchParams(): URLSearchParams {
  const query = useHash().split("?")[1] ?? "";
  return new URLSearchParams(query);
}

export function useRouter() {
  const push = useCallback((href: string) => {
    window.location.hash = href;
    // Assigning an identical hash fires no event, so nudge subscribers directly.
    notify();
    window.scrollTo({ top: 0 });
  }, []);
  return {
    push,
    replace: push,
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => notify(),
    prefetch: () => undefined,
  };
}

export function navigate(href: string) {
  window.location.hash = href;
  notify();
}
