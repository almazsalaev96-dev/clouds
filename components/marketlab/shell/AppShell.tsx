"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Sun, Sparkles, X, Monitor } from "lucide-react";
import { NAV, MOBILE_NAV, ALL_NAV } from "./nav";
import { Logo, Wordmark } from "./Logo";
import { cx } from "@/components/marketlab/ui/primitives";
import { useLab, useHydrated } from "@/lib/marketlab/store";
import { LabAssistant } from "@/components/marketlab/assistant/LabAssistant";
import { Onboarding } from "./Onboarding";

/**
 * The frame every page sits in: a persistent sidebar on desktop, a drawer plus
 * a bottom bar on a phone, and the assistant docked to the right on a wide
 * screen. One frame for the whole product — the brief's instruction that no
 * section should look like a separate app is enforced structurally rather than
 * by remembering to match styles.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = React.useState(false);
  const [assistant, setAssistant] = React.useState(false);

  React.useEffect(() => { setDrawer(false); }, [pathname]);

  return (
    <div className="ml-root min-h-dvh">
      <a href="#ml-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-ml-sm focus:bg-ml-accent focus:px-3 focus:py-2 focus:text-ml-accent-fg">
        Skip to content
      </a>

      <MobileBar onMenu={() => setDrawer(true)} onAssistant={() => setAssistant(true)} />

      <div className="lg:flex">
        <Sidebar className="hidden lg:flex" />

        {drawer ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-[var(--ml-overlay)]" onClick={() => setDrawer(false)} aria-hidden />
            <div className="ml-fade-in absolute inset-y-0 left-0 w-[17rem] max-w-[85vw]">
              <Sidebar className="flex h-full" onClose={() => setDrawer(false)} />
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <main id="ml-main" className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-4 sm:px-6 lg:pb-16 lg:pt-8">
            {children}
          </main>
          <Footer />
        </div>
      </div>

      <BottomBar />
      <LabAssistant open={assistant} onOpenChange={setAssistant} />
      <Onboarding />

      {/* The assistant's handle. Hidden while its panel is open so the two are
          never on screen fighting for the same corner — and hidden on a phone
          entirely, where the top bar already carries the same control and this
          one floated over whatever the page was trying to show. */}
      {!assistant ? (
        <button
          type="button"
          onClick={() => setAssistant(true)}
          className="ml-no-print fixed bottom-6 right-6 z-30 hidden h-12 items-center gap-2 rounded-full border border-ml-border bg-ml-surface px-4 text-[0.875rem] font-medium text-ml-text shadow-ml-lg transition-colors hover:bg-ml-subtle lg:inline-flex"
        >
          <Sparkles size={16} className="text-ml-accent" aria-hidden />
          Lab Assistant
        </button>
      ) : null}
    </div>
  );
}

function Sidebar({ className, onClose }: { className?: string; onClose?: () => void }) {
  const pathname = usePathname();
  return (
    <aside className={cx("ml-no-print w-[17rem] shrink-0 flex-col border-r border-ml-border bg-ml-surface lg:sticky lg:top-0 lg:h-dvh", className)}>
      <div className="flex items-center justify-between gap-2 px-4 py-4">
        <Link href="/" className="flex items-center gap-2.5 rounded-ml-sm py-1 text-[1.0625rem] text-ml-text">
          <Logo />
          <Wordmark />
        </Link>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-ml-xs p-1.5 text-ml-text-3 hover:bg-ml-subtle">
            <X size={18} />
          </button>
        ) : null}
      </div>

      <nav aria-label="Main" className="ml-scroll flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="ml-label px-2 pb-1.5 text-ml-text-4">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex items-center gap-2.5 rounded-ml-sm px-2.5 py-2 text-[0.875rem] transition-colors",
                        active
                          ? "bg-ml-accent-subtle font-medium text-ml-accent"
                          : "text-ml-text-2 hover:bg-ml-subtle hover:text-ml-text",
                      )}
                    >
                      <Icon size={16} aria-hidden className={active ? "text-ml-accent" : "text-ml-text-4"} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-ml-border p-3">
        <ThemeSwitch />
      </div>
    </aside>
  );
}

function MobileBar({ onMenu, onAssistant }: { onMenu: () => void; onAssistant: () => void }) {
  return (
    <header className="ml-no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ml-border bg-ml-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
      <button type="button" onClick={onMenu} aria-label="Open menu" className="rounded-ml-xs p-1.5 text-ml-text-2 hover:bg-ml-subtle">
        <Menu size={20} />
      </button>
      <Link href="/" className="flex items-center gap-2 text-[1rem] text-ml-text">
        <Logo size={22} />
        <Wordmark />
      </Link>
      <button type="button" onClick={onAssistant} aria-label="Open Lab Assistant" className="rounded-ml-xs p-1.5 text-ml-text-2 hover:bg-ml-subtle">
        <Sparkles size={18} />
      </button>
    </header>
  );
}

function BottomBar() {
  const pathname = usePathname();
  const items = ALL_NAV.filter((i) => MOBILE_NAV.includes(i.href));
  return (
    <nav
      aria-label="Sections"
      className="ml-no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-ml-border bg-ml-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx("flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.6875rem] font-medium",
              active ? "text-ml-accent" : "text-ml-text-4")}
          >
            <Icon size={19} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ThemeSwitch() {
  const theme = useLab((s) => s.theme);
  const setTheme = useLab((s) => s.setTheme);
  const hydrated = useHydrated();

  React.useEffect(() => {
    if (!hydrated) return;
    apply(theme);
  }, [theme, hydrated]);

  React.useEffect(() => {
    if (!hydrated || theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, hydrated]);

  const options = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];

  return (
    <div role="radiogroup" aria-label="Colour theme" className="flex rounded-ml-sm border border-ml-border-strong bg-ml-inset p-0.5">
      {options.map((o) => {
        const Icon = o.icon;
        const active = hydrated && theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => setTheme(o.value)}
            className={cx("flex flex-1 items-center justify-center rounded-[6px] py-1.5 transition-colors",
              active ? "bg-ml-surface text-ml-text shadow-ml-sm" : "text-ml-text-4 hover:text-ml-text-2")}
          >
            <Icon size={15} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

function apply(theme: "light" | "dark" | "system") {
  const resolved = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  document.documentElement.dataset.mlTheme = resolved;
}

function Footer() {
  return (
    <footer className="ml-no-print mt-8 border-t border-ml-border bg-ml-surface">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <Link href="/" className="flex items-center gap-2.5 text-[1.0625rem] text-ml-text">
              <Logo />
              <Wordmark />
            </Link>
            <p className="ml-small mt-3 text-ml-text-3">
              An interactive economics laboratory. Build a model, change its assumptions, record what happens, and write up
              what it does and does not show.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-3">
            {NAV.map((group) => (
              <div key={group.label}>
                <p className="ml-label text-ml-text-4">{group.label}</p>
                <ul className="mt-2 space-y-1.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="ml-small text-ml-text-2 hover:text-ml-accent">{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 border-t border-ml-border pt-5">
          <p className="ml-small text-ml-text-4">
            MarketLab is an independent student project. It is not affiliated with, endorsed by or connected to any
            examination board, university or institution. Its models are simplified teaching models: results describe the
            model, not any real market. Nothing here has been shown to improve learning — that would require a study,
            and none has been run.
          </p>
          <p className="ml-small mt-3 text-ml-text-4">Built with Next.js. Your work is stored in this browser only.</p>
        </div>
      </div>
    </footer>
  );
}
