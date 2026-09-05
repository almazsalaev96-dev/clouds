/**
 * next/link, for the single-file build.
 *
 * The app is routed by hash here rather than by the server, so a Link is just
 * an anchor into the hash. Everything else about the component's contract —
 * className, children, aria attributes — passes straight through, so no call
 * site needs to know which build it is running in.
 */
import type { AnchorHTMLAttributes, ReactNode } from "react";

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: ReactNode;
}

export default function Link({ href, children, ...rest }: LinkProps) {
  const external = /^https?:/.test(href);
  return (
    <a
      href={external ? href : `#${href}`}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      {...rest}
    >
      {children}
    </a>
  );
}
