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
    /* In step with the metadata in `app/layout.tsx`, which is the same
       sentence in the other place it is read. */
    description:
      "Armi models — each one several AIs working a question together — with the projects, web apps and notebook that come out of them.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f3f6fc",
    theme_color: "#f3f6fc",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      /* Android's install prompt wants a square PNG it may crop to a
         circle or a squircle: the mark sits inside the safe middle 80%
         on the icon's own ground, so no shape cuts it. */
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
