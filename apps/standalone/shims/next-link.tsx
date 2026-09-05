import { createElement, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { navigate } from './router';

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children?: ReactNode;
}

/** Drop-in for `next/link` that drives the hash router instead of the Next one. */
export default function Link({ href, children, onClick, ...rest }: LinkProps) {
  return createElement(
    'a',
    {
      ...rest,
      href: `#${href}`,
      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        navigate(href);
      },
    },
    children,
  );
}
