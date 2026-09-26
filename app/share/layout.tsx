import type { Metadata } from "next";

/* A shared conversation is a page for the person it was sent to, not for
   a search engine: the link is the only way in, and it stays that way. */
export const metadata: Metadata = {
  title: "Shared from Armi",
  robots: { index: false, follow: false },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
