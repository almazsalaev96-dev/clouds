import type { Metadata, Viewport } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  title: "Armi",
  description:
    "One interface for Claude, GPT, Gemini and DeepSeek — and the notes, cards and papers that come out of them.",
};

export const viewport: Viewport = {
  // Manela and the deep teal it becomes in the dark. These were still set to
  // the colours of a palette two revisions ago, which meant the iOS status bar
  // and the Android chrome were painting a band of the wrong app above ours.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffcee" },
    { media: "(prefers-color-scheme: dark)", color: "#0c191f" },
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
      </head>
      <body>{children}</body>
    </html>
  );
}
