/**
 * Theme controller — spec §23.
 *
 * - Default theme is `light`. Activate dark by setting `data-theme="dark"`
 *   on `<html>` (and a back-compat `.dark` class).
 * - Component code never branches on theme. It only reads tokens.
 * - Source of truth (in priority order):
 *     1. `#theme=…` URL hash (shareable view)
 *     2. `localStorage["bim.theme"]`
 *     3. `prefers-color-scheme` media query
 * - Toggle action persists to all three.
 */

export const THEME_VALUES = ['light', 'dark'] as const;
export type Theme = (typeof THEME_VALUES)[number];

const STORAGE_KEY = 'bim.theme';
const HASH_KEY = 'theme';

function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark';
}

function parseHashTheme(hash: string): Theme | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const candidate = params.get(HASH_KEY);
  return isTheme(candidate) ? candidate : null;
}

function writeHashTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(raw);
    params.set(HASH_KEY, theme);
    const next = `#${params.toString()}`;
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next);
    }
  } catch {
    /* noop */
  }
}

function readStorageTheme(): Theme | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStorageTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* noop */
  }
}

function readSystemPreference(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Resolve the desired theme using the priority cascade. */
export function readPreferredTheme(): Theme {
  if (typeof window !== 'undefined') {
    const fromHash = parseHashTheme(window.location.hash);
    if (fromHash) return fromHash;
  }
  const fromStorage = readStorageTheme();
  if (fromStorage) return fromStorage;
  return readSystemPreference();
}

/** Apply the theme to `<html>` (data-theme attribute + .dark class) and
 * persist it to localStorage and the URL hash. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', theme === 'dark');
  writeStorageTheme(theme);
  writeHashTheme(theme);
}

/** Read the theme currently rendered on `<html>`; defaults to `light`. */
export function getCurrentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  if (isTheme(attr)) return attr;
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** Flip the current theme and persist. Returns the new theme. */
export function toggleTheme(): Theme {
  const next: Theme = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

/** Idempotent boot hook — call once before render. */
export function initTheme(): Theme {
  const theme = readPreferredTheme();
  applyTheme(theme);
  return theme;
}

/** True when the user has requested reduced motion. Used by motion
 * surfaces (§21) to short-circuit transitions. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
