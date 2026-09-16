import type { NextConfig } from "next";

/**
 * Headers every response carries.
 *
 * The keys people paste into this app never leave the browser except to the
 * one route that forwards them, and the pages it makes run in a sandbox with
 * no origin — so most of what a content policy would guard against is
 * already guarded by shape. What is left is the ordinary set every site
 * should send and most do not: no sniffing a file into a script, no framing
 * this app inside somebody else's page, no leaking the URL to the sites a
 * link points at, and no camera, microphone or location unless the page
 * asks for the microphone itself, which the voice mode does.
 *
 * A full Content-Security-Policy is deliberately not here. A `srcdoc` frame
 * inherits its parent's policy, and every canvas this app runs is one —
 * inline styling and behaviour by construction. A policy strict enough to
 * mean anything would break the thing the app is for.
 */
const HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const config: NextConfig = {
  reactStrictMode: true,
  experimental: { optimizePackageImports: ["lucide-react", "shiki"] },
  async headers() {
    return [
      { source: "/(.*)", headers: HEADERS },
      /* The worker script is what decides which copy of the app runs
         offline; a browser holding a stale one would keep serving a build
         that is gone. Checked on every load. */
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default config;
