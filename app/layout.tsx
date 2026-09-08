import type { Metadata, Viewport } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  title: "Clouds",
  description: "One calm interface for Claude, GPT, Gemini and DeepSeek.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
  width: "device-width",
  initialScale: 1,
  // Keeps the composer above the on-screen keyboard instead of behind it.
  interactiveWidget: "resizes-content",
};

/**
 * Applied before first paint. Reading the theme in an effect means one frame of
 * the wrong colors, and that flash is the most-noticed bug in any themed app.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var s = JSON.parse(localStorage.getItem("clouds.settings") || "{}").state || {};
    if (s.theme && s.theme !== "system") document.documentElement.dataset.theme = s.theme;
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
