'use client';

import { useEffect } from 'react';

/**
 * Registers the offline shell. Study has to work on a train, in a basement, on a
 * plane — offline is a requirement, not an enhancement (MASTER-PROMPT.md §1.4).
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (window.location.hostname === 'localhost' && process.env.NODE_ENV === 'development') return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline caching is best-effort; the app still works without it */
    });
  }, []);
  return null;
}
