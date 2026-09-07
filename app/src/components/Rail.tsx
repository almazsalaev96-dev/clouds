import type { ReactElement } from 'react'
import './Rail.css'

/** The seven places the app can be. The rail is the only always-visible navigation. */
export type RailSection = 'today' | 'course' | 'practise' | 'cards' | 'progress' | 'ask' | 'settings'

export interface RailProps {
  active: RailSection | null
}

/* Icons: 24 grid, 20px optical, 1.5px stroke, currentColor. Drawn here, not imported. */

const svg = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

function CalendarIcon() {
  return (
    <svg {...svg} aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M7.5 14.5h3" />
    </svg>
  )
}

function TreeIcon() {
  return (
    <svg {...svg} aria-hidden="true" focusable="false">
      <circle cx="5" cy="4.5" r="1.5" />
      <path d="M5 6v12M5 8.5h6M5 13h6M5 17.5h6" />
      <circle cx="14" cy="8.5" r="2" />
      <circle cx="14" cy="13" r="2" />
      <circle cx="14" cy="17.5" r="2" />
    </svg>
  )
}

function NibIcon() {
  return (
    <svg {...svg} aria-hidden="true" focusable="false">
      <path d="M12 3.5 7.5 10.5 12 20.5l4.5-10z" />
      <path d="M12 3.5v3.5" />
      <circle cx="12" cy="11.5" r="1.25" />
    </svg>
  )
}

function CardsIcon() {
  return (
    <svg {...svg} aria-hidden="true" focusable="false">
      <rect x="3" y="8" width="14" height="12" rx="2" />
      <path d="M7 5.5h10A2.5 2.5 0 0 1 19.5 8v9" />
    </svg>
  )
}

function RiseIcon() {
  return (
    <svg {...svg} aria-hidden="true" focusable="false">
      <path d="M4 4v16h16" />
      <path d="M7.5 15.5 11 11l3 2.5 5-6.5" />
      <path d="M15.5 7h4v4" />
    </svg>
  )
}

function AskIcon() {
  return (
    <svg {...svg} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.6a2.6 2.6 0 1 1 3.3 3.2c-.6.2-1 .8-1 1.5v.3" />
      <path d="M11.8 17.4h.1" />
    </svg>
  )
}

function SlidersIcon() {
  return (
    <svg {...svg} aria-hidden="true" focusable="false">
      <path d="M4 7h3M11 7h9M4 12h6M14 12h6M4 17h9M17 17h3" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="15" cy="17" r="2" />
    </svg>
  )
}

const ITEMS: { key: RailSection; label: string; href: string; icon: () => ReactElement }[] = [
  { key: 'today', label: 'Today', href: '#/today', icon: CalendarIcon },
  { key: 'course', label: 'Course', href: '#/course', icon: TreeIcon },
  { key: 'practise', label: 'Practise', href: '#/practise', icon: NibIcon },
  { key: 'cards', label: 'Cards', href: '#/cards', icon: CardsIcon },
  { key: 'progress', label: 'Progress', href: '#/progress', icon: RiseIcon },
  { key: 'ask', label: 'Ask', href: '#/ask', icon: AskIcon },
  { key: 'settings', label: 'Settings', href: '#/settings', icon: SlidersIcon },
]

export function Rail({ active }: RailProps) {
  return (
    <nav className="rail" aria-label="Sections">
      <ul className="rail__list">
        {ITEMS.map(item => {
          const Icon = item.icon
          const current = item.key === active
          return (
            <li className="rail__item" key={item.key}>
              <a
                className="rail__link"
                href={item.href}
                aria-current={current ? 'page' : undefined}
                data-current={current ? 'yes' : 'no'}
              >
                <span className="rail__icon"><Icon /></span>
                <span className="rail__label">{item.label}</span>
                <span className="rail__tip" aria-hidden="true">{item.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
