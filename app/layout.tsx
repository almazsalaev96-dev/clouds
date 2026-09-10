import type { Metadata, Viewport } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  title: "Armi",
  description:
    "One interface for Claude, GPT, Gemini and DeepSeek — and the projects, web apps and notebook that come out of them.",
};

export const viewport: Viewport = {
  // The paper, and the ink it becomes in the dark. Kept in step with the
  // palette by hand, because the last time they drifted the iOS status bar
  // was painting a band of the previous app above this one.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3ea" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1633" },
  ],
  width: "device-width",
  initialScale: 1,
  // The app paints to the edges on a notched phone; every element that needs
  // to stay clear of the notch or the home indicator does so with env() insets
  // rather than by letting the system letterbox the whole page.
  viewportFit: "cover",
  // Keeps the composer above the on-screen keyboard instead of behind it.
  interactiveWidget: "resizes-content",
};

/**
 * Applied before first paint. Reading the theme in an effect means one frame of
 * the wrong colors, and that flash is the most-noticed bug in any themed app.
 *
 * "system" is resolved here rather than left to a media query, so `data-theme`
 * is always a concrete value. That is not a micro-optimisation: while the
 * palette lived in two places — one for the attribute, one for
 * `prefers-color-scheme` — they drifted, and picking Dark in settings gave you
 * different shadows and different syntax colours than having your OS in dark
 * with System selected. One resolved attribute means one palette, and no
 * second copy to forget.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var keys = ["store.settings.v1", "astra.settings", "armi.settings", "clouds.settings"];
    var raw = "{}";
    for (var i = 0; i < keys.length; i++) {
      var v = localStorage.getItem(keys[i]);
      if (v) { raw = v; break; }
    }
    var s = JSON.parse(raw).state || {};
    var t = s.theme && s.theme !== "system" ? s.theme
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = t;
    if (s.density && s.density !== "comfortable") document.documentElement.dataset.density = s.density;
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* The two faces on screen before anyone has done anything: the
            interface, and the signature in the corner. Preloaded so the first
            paint is already in them rather than swapping a moment later. */}
        <link rel="preload" href="/fonts/inter-400.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/pinyon-script-400.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
