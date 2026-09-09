import type { MetadataRoute } from "next";

/**
 * Added to the Home Screen, Armi should open as an app rather than as a tab:
 * no browser chrome, its own colours behind the status bar, and its own icon.
 * `standalone` is what makes iOS treat it as an application; without a
 * manifest it stays a bookmark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Armi",
    short_name: "Armi",
    description:
      "One interface for Claude, GPT, Gemini and DeepSeek — and the notes, cards and papers that come out of them.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7f3ea",
    theme_color: "#f7f3ea",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
