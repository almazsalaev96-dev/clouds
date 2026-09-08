import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Course } from '../lib/api'
import {
  setCourse, setNavOpen, setPaletteOpen, setSession, setSideOpen, toggleNav, togglePalette, toggleSide,
  useHotkeys, useStore,
} from '../lib/state'
import type { Theme } from '../lib/state'
import { setTheme } from '../lib/state'
import { Rail } from './Rail'
import { Recents } from './Recents'
import type { RailSection } from './Rail'
import './Shell.css'

export interface ShellProps {
  /** The current hash path, e.g. "/mark/mk_12ab". */
  path: string
  courses: Course[]
  course: Course | null
  topBar: ReactNode
  children: ReactNode
  /** Right-pane content supplied by the route itself. Screens may use <SidePane> instead. */
  side?: ReactNode
  sideLabel?: string
}

interface NavLink {
  href: string
  label: string
  hint: string
  match: (path: string) => boolean
}

/**
 * The chat is the product, so the sidebar is not a tool menu with the chat in it. It
 * is: start a thread, the few places the things made in threads live afterwards, and
 * then the threads themselves.
 */
const NAV_LINKS: NavLink[] = [
  { href: '#/today', label: 'Today', hint: 'What to do now', match: p => p.startsWith('/today') || p.startsWith('/plan') },
  { href: '#/course', label: 'Course', hint: 'Syllabus and topics', match: p => p.startsWith('/course') },
  { href: '#/practise', label: 'Practise', hint: 'Exam questions, marked', match: p => p.startsWith('/practise') || p.startsWith('/mark') },
  { href: '#/cards', label: 'Cards', hint: 'Due for review', match: p => p.startsWith('/cards') },
  { href: '#/progress', label: 'Progress', hint: 'Mastery and readiness', match: p => p.startsWith('/progress') },
  { href: '#/settings', label: 'Settings', hint: 'Appearance, reading, data', match: p => p.startsWith('/settings') },
]

/** The conversation a path names, for marking it in the thread list. */
export function conversationOf(path: string): string | null {
  const at = path.indexOf('/c/')
  if (at !== 0) return null
  const id = decodeURIComponent(path.slice(3).split('/')[0] || '')
  return id || null
}

/** Which rail icon is lit for a path. Session belongs to Course, a Mark to Practise. */
export function sectionFor(path: string): RailSection | null {
  if (path === '/' || path.startsWith('/chat') || path.startsWith('/c/') || path.startsWith('/session') || path.startsWith('/ask')) return 'ask'
  if (path.startsWith('/today') || path.startsWith('/plan')) return 'today'
  if (path.startsWith('/course')) return 'course'
  if (path.startsWith('/practise') || path.startsWith('/mark')) return 'practise'
  if (path.startsWith('/cards')) return 'cards'
  if (path.startsWith('/progress')) return 'progress'
  if (path.startsWith('/ask')) return 'ask'
  if (path.startsWith('/settings')) return 'settings'
  return null
}

/* ------------------------------------------------------------- right pane slot */

interface SideSlot {
  node: HTMLElement | null
  claim: () => void
  release: () => void
}

const SideSlotContext = createContext<SideSlot | null>(null)

export interface SidePaneProps {
  /** Names the pane for screen readers and titles its header. */
  title: string
  children: ReactNode
}

/**
 * Render into the shell's right pane from anywhere in the routed screen.
 * Mounting one opens the pane; unmounting it lets the pane collapse again.
 */
export function SidePane({ title, children }: SidePaneProps) {
  const slot = useContext(SideSlotContext)
  useEffect(() => {
    if (!slot) return
    slot.claim()
    return () => slot.release()
  }, [slot])
  if (!slot?.node) return null
  return createPortal(
    <section className="shell__pane" aria-label={title}>
      <h2 className="shell__pane-title">{title}</h2>
      <div className="shell__pane-body">{children}</div>
    </section>,
    slot.node,
  )
}

/* ------------------------------------------------------------ command palette */

interface Command {
  id: string
  label: string
  hint: string
  run: () => void
}

function buildCommands(courses: Course[], theme: Theme): Command[] {
  const go = (hash: string) => () => { window.location.hash = hash }
  const commands: Command[] = [
    { id: 'go-chat', label: 'New chat', hint: 'Ask for anything on your course', run: () => { setSession(null); go('#/')() } },
    { id: 'go-today', label: 'Go to Today', hint: 'What to do now', run: go('#/today') },
    { id: 'go-course', label: 'Go to Course', hint: 'Syllabus and topics', run: go('#/course') },
    { id: 'go-practise', label: 'Practise', hint: 'Exam questions, marked', run: go('#/practise') },
    { id: 'go-cards', label: 'Review cards', hint: 'Due for review', run: go('#/cards') },
    { id: 'go-plan', label: 'Open plan', hint: 'The weeks before the exam', run: go('#/plan') },
    { id: 'go-progress', label: 'Open progress', hint: 'Mastery and readiness', run: go('#/progress') },
    { id: 'go-ask', label: 'Ask anything', hint: 'Outside a course', run: go('#/ask') },
    { id: 'go-settings', label: 'Open settings', hint: 'Appearance, reading, data', run: go('#/settings') },
    { id: 'toggle-side', label: 'Toggle the right pane', hint: 'Command J', run: () => toggleSide() },
    { id: 'toggle-nav', label: 'Toggle the sidebar', hint: 'Command B', run: () => toggleNav() },
    {
      id: 'toggle-theme',
      label: theme === 'dark' ? 'Switch to light' : 'Switch to dark',
      hint: `Theme is ${theme}`,
      run: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    },
    { id: 'theme-system', label: 'Follow the system theme', hint: 'Light or dark from the OS', run: () => setTheme('system') },
  ]
  for (const course of courses) {
    commands.push({
      id: `course-${course.id}`,
      label: `Switch to ${course.syllabus} ${course.title}`,
      hint: course.board,
      run: () => { setCourse(course.id) },
    })
  }
  return commands
}

function CommandPalette({ courses }: { courses: Course[] }) {
  const { theme } = useStore()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const openerRef = useRef<Element | null>(null)

  const commands = useMemo(() => buildCommands(courses, theme), [courses, theme])
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return commands
    return commands.filter(command =>
      command.label.toLowerCase().includes(needle) || command.hint.toLowerCase().includes(needle))
  }, [commands, query])

  useEffect(() => {
    openerRef.current = document.activeElement
    inputRef.current?.focus()
    return () => {
      const opener = openerRef.current
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  useEffect(() => { setIndex(0) }, [query])

  const close = () => setPaletteOpen(false)
  const run = (command: Command | undefined) => {
    if (!command) return
    close()
    command.run()
  }

  return (
    <div className="shell__palette-layer">
      {/* Decorative: closing by keyboard is Escape, which is where the standard puts it. */}
      <div className="shell__scrim" aria-hidden="true" onClick={close} />
      <div
        className="shell__palette"
        role="dialog"
        aria-modal="true"
        aria-label="Commands"
        onKeyDown={event => {
          // The input is the only interactive element here, so Tab stays inside it.
          if (event.key === 'Tab') { event.preventDefault(); inputRef.current?.focus() }
        }}
      >
        <label className="sr" htmlFor="shell-palette-input">Type a command</label>
        <input
          id="shell-palette-input"
          ref={inputRef}
          className="shell__palette-input"
          type="text"
          autoComplete="off"
          placeholder="Type a command"
          value={query}
          role="combobox"
          aria-expanded="true"
          aria-controls="shell-palette-list"
          aria-activedescendant={results[index] ? `shell-cmd-${results[index].id}` : undefined}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setIndex(i => Math.min(i + 1, results.length - 1)) }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
            else if (event.key === 'Enter') { event.preventDefault(); run(results[index]) }
            else if (event.key === 'Escape') { event.preventDefault(); close() }
          }}
        />
        <ul className="shell__palette-list" id="shell-palette-list" role="listbox" aria-label="Commands">
          {results.map((command, position) => (
            <li
              key={command.id}
              id={`shell-cmd-${command.id}`}
              className="shell__palette-row"
              role="option"
              aria-selected={position === index}
              onMouseEnter={() => setIndex(position)}
              onClick={() => run(command)}
            >
              <span className="shell__palette-label">{command.label}</span>
              <span className="shell__palette-hint">{command.hint}</span>
            </li>
          ))}
        </ul>
        {results.length === 0 && (
          <p className="shell__palette-empty">No command matches that. Try another word.</p>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------- shell */

export function Shell({ path, courses, course, topBar, children, side, sideLabel }: ShellProps) {
  const { navOpen, sideOpen, paletteOpen, sessionId } = useStore()
  const [paneNode, setPaneNode] = useState<HTMLElement | null>(null)
  const [claims, setClaims] = useState(0)

  const filled = Boolean(side) || claims > 0
  const section = sectionFor(path)

  const slot = useMemo<SideSlot>(() => ({
    node: paneNode,
    claim: () => setClaims(n => n + 1),
    release: () => setClaims(n => Math.max(0, n - 1)),
  }), [paneNode])

  // The pane opens itself the first time a screen puts something in it (10-CONV-002).
  const wasFilled = useRef(false)
  useEffect(() => {
    if (filled && !wasFilled.current) setSideOpen(true)
    wasFilled.current = filled
  }, [filled])

  // The nav is a column above 820px and a drawer below it; crossing resets the default.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const wide = window.matchMedia('(min-width: 821px)')
    const onChange = (event: MediaQueryListEvent) => setNavOpen(event.matches)
    wide.addEventListener('change', onChange)
    return () => wide.removeEventListener('change', onChange)
  }, [])

  const sideShown = filled && sideOpen
  const keys: Record<string, () => void> = {
    'mod+k': () => togglePalette(),
    'mod+b': () => toggleNav(),
    'mod+j': () => toggleSide(),
    'mod+,': () => { window.location.hash = '#/settings' },
    'mod+shift+n': () => { window.location.hash = '#/session' },
    'alt+arrowleft': () => window.history.back(),
  }
  if (paletteOpen || sideShown || navOpen) {
    keys.escape = () => {
      if (paletteOpen) setPaletteOpen(false)
      else if (sideShown) setSideOpen(false)
      else setNavOpen(false)
    }
  }
  useHotkeys(keys)

  return (
    <SideSlotContext.Provider value={slot}>
      <div className="shell" data-nav={navOpen ? 'open' : 'closed'} data-side={sideShown ? 'open' : 'closed'}>
        <a className="skip" href="#main">Skip to content</a>

        <div className="shell__rail">
          <Rail active={section} />
        </div>

        <div className="shell__topbar">{topBar}</div>

        <nav className="shell__nav" id="shell-nav" aria-label="Course">
          <div className="shell__course">
            <p className="shell__course-title">{course ? course.title : 'No course selected'}</p>
            <p className="shell__course-meta mono">
              {course ? `${course.board} · ${course.syllabus}` : 'Add a course to begin'}
              {course?.targetGrade ? ` · target ${course.targetGrade}` : ''}
            </p>
          </div>

          <a className="shell__new" href="#/" onClick={() => setSession(null)}>
            <span className="shell__new-plus" aria-hidden="true">+</span>
            New chat
          </a>

          <ul className="shell__nav-list">
            {NAV_LINKS.map(link => {
              const current = link.match(path)
              return (
                <li key={link.href}>
                  <a
                    className="shell__nav-link"
                    href={link.href}
                    aria-current={current ? 'page' : undefined}
                    data-current={current ? 'yes' : 'no'}
                  >
                    <span className="shell__nav-label">{link.label}</span>
                    <span className="shell__nav-hint">{link.hint}</span>
                  </a>
                </li>
              )
            })}
          </ul>

          <Recents currentId={conversationOf(path) ?? sessionId} />

          <button type="button" className="shell__nav-commands" onClick={() => setPaletteOpen(true)}>
            Commands
            <kbd className="shell__kbd mono">⌘K</kbd>
          </button>
        </nav>

        <main className="shell__main" id="main" tabIndex={-1}>{children}</main>

        <aside
          className="shell__side"
          aria-label={sideLabel ?? 'Panel'}
          ref={setPaneNode}
        >
          <div className="shell__side-head">
            <button type="button" className="shell__side-close" onClick={() => setSideOpen(false)}>
              Close panel
            </button>
          </div>
          {side}
        </aside>

        {filled && !sideOpen && (
          <button type="button" className="shell__side-tab" onClick={() => setSideOpen(true)}>
            Panel
          </button>
        )}

        {navOpen && (
          <button type="button" className="shell__scrim shell__scrim--nav" onClick={() => setNavOpen(false)}>
            <span className="sr">Close the navigation</span>
          </button>
        )}

        {sideShown && (
          <button type="button" className="shell__scrim shell__scrim--side" onClick={() => setSideOpen(false)}>
            <span className="sr">Close the panel</span>
          </button>
        )}

        {paletteOpen && <CommandPalette courses={courses} />}
      </div>
    </SideSlotContext.Provider>
  )
}
