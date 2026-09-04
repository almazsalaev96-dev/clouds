'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Today' },
  { href: '/review', label: 'Review' },
  { href: '/map', label: 'Syllabus' },
  { href: '/settings', label: 'Settings' },
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href ? 'page' : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
