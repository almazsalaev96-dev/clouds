import type { Metadata, Viewport } from "next";
import "./marketlab.css";
import { AppShell } from "@/components/marketlab/shell/AppShell";

export const metadata: Metadata = {
  title: {
    default: "MarketLab — an interactive economics laboratory",
    template: "%s · MarketLab",
  },
  description:
    "Explore economics, business strategy and real-world data through interactive experiments and independent research. "
    + "Change the variables, watch the results, and record what the model does and does not show.",
  icons: { icon: "/marketlab-icon.svg" },
  applicationName: "MarketLab",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f17" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Runs before the first paint.
 *
 * Reading the saved theme in an effect costs one frame of the wrong colours,
 * and on a dark-theme user that frame is a white flash — the most noticeable
 * bug a themed app can have. "system" is resolved to a concrete value here so
 * that `data-ml-theme` is always either "light" or "dark" and the stylesheet
 * never has to keep a second copy of the palette behind a media query.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem("marketlab.v1");
    var saved = raw ? (JSON.parse(raw).state || {}).theme : null;
    var t = saved && saved !== "system"
      ? saved
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.mlTheme = t;
  } catch (e) {
    document.documentElement.dataset.mlTheme = "light";
  }
})();
`;

export default function MarketLabLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preload" href="/fonts/inter-400.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/inter-600.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
