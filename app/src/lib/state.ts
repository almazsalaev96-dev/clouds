/**
 * The client store: one object, no library, read through useSyncExternalStore.
 * Holds the selected course, the current session, the theme and the reading-comfort
 * preferences (§09.13, §09.9). Theme and comfort are mirrored onto <html> as
 * data-theme / data-font / data-density, which is what tokens.css keys off.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'
export type FontChoice = 'default' | 'dyslexic'
export type Density = 'default' | 'roomy'

/** Client-side tally of what this browser has spent since the page loaded. */
export interface UsageTally {
  turns: number
  marks: number
  costUsd: number
}

export interface AppState {
  /** Course the whole app is scoped to. Screens read this instead of taking props. */
  courseId: string | null
  /** Session the composer is writing into, when a Session is open. */
  sessionId: string | null
  theme: Theme
  font: FontChoice
  density: Density
  /** Navigation column: a column on desktop, a drawer under 820px. */
  navOpen: boolean
  /** Right pane: 480px column, an overlay sheet under 1100px. */
  sideOpen: boolean
  paletteOpen: boolean
  usage: UsageTally
}

export interface Store<T> {
  get(): T
  set(patch: Partial<T> | ((prev: T) => Partial<T>)): void
  subscribe(listener: () => void): () => void
}

/** A store is a value, a setter that shallow-merges, and a subscription. That is all. */
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch
      let changed = false
      for (const key of Object.keys(next) as (keyof T)[]) {
        if (!Object.is(state[key], next[key])) { changed = true; break }
      }
      if (!changed) return
      state = { ...state, ...next }
      for (const listener of [...listeners]) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

/* ---------------------------------------------------------------- persistence */

const PREFS_KEY = 'margin.prefs'

interface Prefs {
  theme: Theme
  font: FontChoice
  density: Density
  courseId: string | null
}

const DEFAULT_PREFS: Prefs = { theme: 'system', font: 'default', density: 'default', courseId: null }

/** localStorage throws outright in some privacy modes, so every touch is guarded. */
function readPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const saved = JSON.parse(raw) as Partial<Prefs>
    return {
      theme: saved.theme === 'light' || saved.theme === 'dark' ? saved.theme : 'system',
      font: saved.font === 'dyslexic' ? 'dyslexic' : 'default',
      density: saved.density === 'roomy' ? 'roomy' : 'default',
      courseId: typeof saved.courseId === 'string' ? saved.courseId : null,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function writePrefs(state: AppState): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({
      theme: state.theme, font: state.font, density: state.density, courseId: state.courseId,
    }))
  } catch {
    /* No storage: preferences last for this tab only. Nothing else changes. */
  }
}

/** Stamp the theme on <html>. 'system' removes the attribute so the OS decides. */
function applyTheme(state: AppState): void {
  const root = document.documentElement
  if (state.theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', state.theme)
}

/**
 * Stamp one reading-comfort attribute. Theme and comfort are stamped separately so
 * changing the theme never clears a comfort setting another surface wrote.
 */
function applyComfort(attribute: 'data-font' | 'data-density', value: string, isDefault: boolean): void {
  const root = document.documentElement
  if (isDefault) root.removeAttribute(attribute)
  else root.setAttribute(attribute, value)
}

function wideEnoughForNav(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(min-width: 821px)').matches
}

const prefs = readPrefs()

export const store = createStore<AppState>({
  courseId: prefs.courseId,
  sessionId: null,
  theme: prefs.theme,
  font: prefs.font,
  density: prefs.density,
  navOpen: wideEnoughForNav(),
  sideOpen: false,
  paletteOpen: false,
  usage: { turns: 0, marks: 0, costUsd: 0 },
})

if (typeof document !== 'undefined') applyTheme(store.get())

/* -------------------------------------------------------------------- setters */

export function setCourse(courseId: string | null): void {
  store.set({ courseId, sessionId: null })
  writePrefs(store.get())
}

export function setSession(sessionId: string | null): void {
  store.set({ sessionId })
}

export function setTheme(theme: Theme): void {
  store.set({ theme })
  applyTheme(store.get())
  writePrefs(store.get())
}

export function setFont(font: FontChoice): void {
  store.set({ font })
  applyComfort('data-font', font, font === 'default')
  writePrefs(store.get())
}

export function setDensity(density: Density): void {
  store.set({ density })
  applyComfort('data-density', density, density === 'default')
  writePrefs(store.get())
}

export function setNavOpen(navOpen: boolean): void { store.set({ navOpen }) }
export function toggleNav(): void { store.set(s => ({ navOpen: !s.navOpen })) }
export function setSideOpen(sideOpen: boolean): void { store.set({ sideOpen }) }
export function toggleSide(): void { store.set(s => ({ sideOpen: !s.sideOpen })) }
export function setPaletteOpen(paletteOpen: boolean): void { store.set({ paletteOpen }) }
export function togglePalette(): void { store.set(s => ({ paletteOpen: !s.paletteOpen })) }

/** Called by the API client when a turn or a mark completes, so the meter is real. */
export function noteUsage(patch: Partial<UsageTally>): void {
  store.set(s => ({
    usage: {
      turns: s.usage.turns + (patch.turns ?? 0),
      marks: s.usage.marks + (patch.marks ?? 0),
      costUsd: s.usage.costUsd + (patch.costUsd ?? 0),
    },
  }))
}

/* --------------------------------------------------------------------- hooks */

export function useStore(): AppState {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/* ------------------------------------------------------------------ hotkeys */

interface Chord {
  mod: boolean       // ⌘ on macOS, Ctrl elsewhere
  ctrl: boolean
  alt: boolean
  shift: boolean
  key: string
}

const APPLE = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)

function parseChord(spec: string): Chord {
  const parts = spec.toLowerCase().split('+').map(p => p.trim()).filter(Boolean)
  const chord: Chord = { mod: false, ctrl: false, alt: false, shift: false, key: '' }
  for (const part of parts) {
    if (part === 'mod' || part === 'cmd' || part === 'meta') chord.mod = true
    else if (part === 'ctrl' || part === 'control') chord.ctrl = true
    else if (part === 'alt' || part === 'option') chord.alt = true
    else if (part === 'shift') chord.shift = true
    else chord.key = part
  }
  return chord
}

function matches(chord: Chord, event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase()
  if (key !== chord.key) return false
  const wantsMod = chord.mod || chord.ctrl
  const hasPrimary = APPLE ? event.metaKey : event.ctrlKey
  if (chord.mod && !hasPrimary) return false
  if (chord.ctrl && !event.ctrlKey) return false
  if (!wantsMod && (event.metaKey || event.ctrlKey)) return false
  if (chord.alt !== event.altKey) return false
  if (chord.shift !== event.shiftKey) return false
  return true
}

function inTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * Bind a map of chords, e.g. { 'mod+k': open, 'escape': close }.
 * A chord with no modifier never fires while a text field has focus (09-KEYS-001).
 */
export function useHotkeys(map: Record<string, (event: KeyboardEvent) => void>): void {
  const latest = useRef(map)
  latest.current = map
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      for (const [spec, handler] of Object.entries(latest.current)) {
        const chord = parseChord(spec)
        if (!chord.key || !matches(chord, event)) continue
        const bare = !chord.mod && !chord.ctrl && !chord.alt
        if (bare && chord.key !== 'escape' && inTextField(event.target)) continue
        event.preventDefault()
        handler(event)
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
