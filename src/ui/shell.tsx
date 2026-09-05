"use client";

/**
 * The application frame.
 *
 * Navigation is intentionally not flat. Twenty equally-weighted links is how a
 * product with many capabilities becomes unusable; the sidebar is grouped by
 * what a student is trying to do — work now, understand, review, look back —
 * and secondary tools stay out of the way until they are wanted.
 *
 * Live counts are the exception to that restraint: due reviews and open
 * mistakes are shown in the nav because they decay, and a number that decays
 * needs to be visible before it is forgotten.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ContentProvider, StoreProvider, useAppearance, useContent, useStore } from "@/store/provider";
import type { ContentBundle } from "@/content/bundle";
import { CommandBar } from "./command-bar";
import { buildSubjectView } from "@/view/derive";

export function AppFrame({ bundle, children }: { bundle: ContentBundle; children: ReactNode }) {
  return (
    <ContentProvider bundle={bundle}>
      <StoreProvider>
        <Frame>{children}</Frame>
      </StoreProvider>
    </ContentProvider>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  count?: number;
}

function Frame({ children }: { children: ReactNode }) {
  useAppearance();
  const { state, ready } = useStore();
  const bundle = useContent();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  // ⌘K / Ctrl+K anywhere. The fastest path through a large product is a
  // command bar, not a deeper menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
      if (e.key === "Escape") setCmdOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = useMemo(() => {
    if (!ready) return { due: 0, mistakes: 0 };
    const now = new Date().toISOString();
    let due = 0;
    let mistakes = 0;
    for (const enrolment of state.profile.subjects.filter((s) => !s.archived)) {
      const view = buildSubjectView(state, bundle, enrolment, now);
      if (!view) continue;
      due += view.dueCards.length;
      mistakes += view.openMistakes;
    }
    return { due, mistakes };
  }, [state, bundle, ready]);

  const onboarded = state.profile.subjects.length > 0;

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "Now",
      items: [
        { href: "/", label: "Command centre", icon: "◈" },
        { href: "/practice", label: "Practise", icon: "◐" },
        { href: "/review", label: "Review", icon: "↻", count: counts.due },
        { href: "/mistakes", label: "Mistake lab", icon: "△", count: counts.mistakes },
      ],
    },
    {
      label: "Learn",
      items: [
        { href: "/subjects", label: "Subjects", icon: "▤" },
        { href: "/tutor", label: "Tutor", icon: "✦" },
        { href: "/technique", label: "Technique", icon: "✎" },
      ],
    },
    {
      label: "Prove",
      items: [
        { href: "/mock", label: "Mock exams", icon: "▣" },
        { href: "/readiness", label: "Readiness", icon: "◎" },
        { href: "/progress", label: "Progress", icon: "◭" },
      ],
    },
    {
      label: "Organise",
      items: [
        { href: "/plan", label: "Study plan", icon: "▦" },
        { href: "/notes", label: "Notes", icon: "✒" },
        { href: "/library", label: "Library", icon: "▥" },
      ],
    },
  ];

  return (
    <div className="shell">
      <nav className="sidebar" data-open={open} aria-label="Main">
        <Link href="/" className="brand">
          <span className="brand-mark">Lodestar</span>
          <span className="brand-sub">beta</span>
        </Link>

        {onboarded ? (
          groups.map((g) => (
            <div className="nav-group" key={g.label}>
              <div className="nav-label">{g.label}</div>
              {g.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-item"
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                  {item.count ? <span className="count num">{item.count}</span> : null}
                </Link>
              ))}
            </div>
          ))
        ) : (
          <div className="nav-group">
            <Link href="/" className="nav-item" aria-current={pathname === "/" ? "page" : undefined}>
              <span className="nav-icon">◈</span> Get started
            </Link>
            <Link href="/library" className="nav-item">
              <span className="nav-icon">▥</span> Library
            </Link>
          </div>
        )}

        <div className="spacer" />
        <div className="nav-group">
          <Link href="/settings" className="nav-item" aria-current={isActive(pathname, "/settings") ? "page" : undefined}>
            <span className="nav-icon">⚙</span> Settings
          </Link>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <button
            className="btn ghost small"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            style={{ display: "var(--menu-display, none)" }}
            data-mobile-menu
          >
            ☰
          </button>
          <button className="btn ghost small" onClick={() => setCmdOpen(true)} aria-label="Open command bar">
            <span aria-hidden="true">⌕</span>
            <span className="hide-mobile">Search or command</span>
            <kbd className="hide-mobile">⌘K</kbd>
          </button>
          <div className="spacer" />
          {onboarded && <QuickSession />}
        </header>
        {state.profile.isExample && <ExampleBanner />}
        <main id="main" className="content">
          {children}
        </main>
      </div>

      {cmdOpen && <CommandBar onClose={() => setCmdOpen(false)} onNavigate={(href) => router.push(href)} />}

      <style>{`@media (max-width: 900px){ [data-mobile-menu]{ display: inline-flex !important; } }`}</style>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * "I have N minutes" is the single most-used entry point in the product, so it
 * lives in the top bar on every screen rather than on one page.
 */
function QuickSession() {
  const router = useRouter();
  return (
    <div className="row" style={{ gap: 6 }}>
      <span className="tiny muted hide-mobile">I have</span>
      <div className="btn-group">
        {[10, 25, 45].map((m) => (
          <button key={m} className="btn small" onClick={() => router.push(`/session?minutes=${m}`)}>
            {m}m
          </button>
        ))}
      </div>
    </div>
  );
}


/**
 * Example-data banner.
 *
 * Deliberately a thin strip rather than a card: it must be impossible to miss
 * and impossible to mistake for content. It states plainly which part is
 * fabricated (the answers) and which is not (everything derived from them),
 * and offers the one action that matters.
 */
function ExampleBanner() {
  const { reset } = useStore();
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "8px 30px",
        background: "var(--fading-wash)",
        borderBottom: "1px solid color-mix(in srgb, var(--fading) 30%, transparent)",
        color: "var(--ink-soft)",
        fontSize: "0.82rem",
      }}
    >
      <strong style={{ color: "var(--fading)" }}>Example data</strong>
      <span>
        These answers are made up, so the figures are not your progress. The analysis of them is real
        — the same engines, on these attempts.
      </span>
      <button className="btn small ghost" style={{ marginLeft: "auto" }} onClick={() => void reset()}>
        Clear and start properly
      </button>
    </div>
  );
}
