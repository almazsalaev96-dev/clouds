import type { Metadata, Viewport } from "next";
import { getBundle } from "@/content/bundle";
import { AppFrame } from "@/ui/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lodestar — exam learning system",
  description:
    "An adaptive learning system for Cambridge IGCSE, AS and A Level. It works out what to study next, why, and whether you are ready.",
  applicationName: "Lodestar",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1216" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Content is read on the server once and handed down as plain data. It is the
  // same for every student, so it never belongs in the student's own store.
  const bundle = getBundle();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap"
        />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <AppFrame bundle={bundle}>{children}</AppFrame>
      </body>
    </html>
  );
}
