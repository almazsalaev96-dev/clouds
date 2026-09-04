import type { Metadata, Viewport } from 'next';
import './globals.css';
import { StudyProvider } from '@/lib/study';
import { Nav } from '@/components/Nav';
import { ServiceWorker } from '@/components/ServiceWorker';
import { ThemeScript } from '@/components/ThemeScript';

export const metadata: Metadata = {
  title: 'Atlas — every subject',
  description:
    'A learning platform that schedules what you are about to forget, marks against the real assessment objectives, and spends your time where the marks are.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Atlas',
  appleWebApp: { capable: true, title: 'Atlas', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f6' },
    { media: '(prefers-color-scheme: dark)', color: '#101215' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeScript />
        <StudyProvider>
          <div className="shell">
            <header className="topbar">
              <div className="topbar-inner">
                <a className="wordmark" href="/">
                  <span className="dot" aria-hidden="true" />
                  Atlas
                </a>
                <Nav />
              </div>
            </header>
            <main>{children}</main>
          </div>
        </StudyProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
