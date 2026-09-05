/**
 * A ~30-line hash router that stands in for Next's routing.
 *
 * The standalone build exists so Atlas can be opened from a single URL with no
 * server. It reuses the app's real page components unchanged — only the two Next
 * modules they import are swapped for these shims at bundle time — so there is one
 * UI codebase, not two.
 */

import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', notify);
}

export function currentPath(): string {
  if (typeof window === 'undefined') return '/';
  const hash = window.location.hash;
  return hash.length > 1 ? hash.slice(1) : '/';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, currentPath, () => '/');
}

export function navigate(to: string): void {
  if (currentPath() === to) return;
  window.location.hash = to;
  window.scrollTo(0, 0);
}
