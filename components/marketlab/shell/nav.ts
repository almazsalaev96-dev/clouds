import type { LucideIcon } from "lucide-react";
import {
  BookOpen, Compass, Database, FlaskConical, Home, Info, Calculator, NotebookPen,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  blurb: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * The whole application, in three groups. The grouping is the argument the
 * product makes about itself: you arrive, you look around, you do work, and
 * you keep reference material to hand while you do it.
 */
export const NAV: NavGroup[] = [
  {
    label: "Start",
    items: [
      { href: "/", label: "Home", icon: Home, blurb: "What MarketLab is and where to begin." },
      { href: "/explore", label: "Explore", icon: Compass, blurb: "Every experiment, tool and concept in one place." },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/experiments", label: "Experiments", icon: FlaskConical, blurb: "Interactive economic models you can change and re-run." },
      { href: "/tools", label: "Business tools", icon: Calculator, blurb: "Pricing, break-even and scenario calculators." },
      { href: "/research", label: "Research", icon: NotebookPen, blurb: "Your research projects, notes and saved runs." },
    ],
  },
  {
    label: "Reference",
    items: [
      { href: "/data", label: "Data", icon: Database, blurb: "Real economic indicators, with their sources." },
      { href: "/learn", label: "Learn", icon: BookOpen, blurb: "Economics and business, explained from zero." },
      { href: "/about", label: "About", icon: Info, blurb: "What this is, how it works, and what it cannot do." },
    ],
  },
];

export const ALL_NAV: NavItem[] = NAV.flatMap((g) => g.items);

/** The four items that get a bar on a phone. */
export const MOBILE_NAV = ["/", "/experiments", "/research", "/learn"];
