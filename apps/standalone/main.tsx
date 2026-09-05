/**
 * Standalone entry point.
 *
 * Same provider, same pages, same styles as the Next app — only the routing shell
 * is local, because a single-file build has no server to route for it.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StudyProvider } from '@/lib/study';
import { Nav } from '@/components/Nav';
import TodayPage from '@/app/page';
import ReviewPage from '@/app/review/page';
import MapPage from '@/app/map/page';
import SettingsPage from '@/app/settings/page';
import Link from './shims/next-link';
import { usePath } from './shims/router';

function App() {
  const path = usePath();

  const page =
    path === '/review' ? (
      <ReviewPage />
    ) : path === '/map' ? (
      <MapPage />
    ) : path === '/settings' ? (
      <SettingsPage />
    ) : (
      <TodayPage />
    );

  return (
    <StudyProvider>
      <div className="shell">
        <header className="topbar">
          <div className="topbar-inner">
            <Link className="wordmark" href="/">
              <span className="dot" aria-hidden="true" />
              Atlas
            </Link>
            <Nav />
          </div>
        </header>
        <main>{page}</main>
      </div>
    </StudyProvider>
  );
}

// Restore the saved theme before the first paint, same as the Next app's inline script.
try {
  const theme = localStorage.getItem('atlas-theme');
  if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
} catch {
  /* a browser blocking storage still renders in the system theme */
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
