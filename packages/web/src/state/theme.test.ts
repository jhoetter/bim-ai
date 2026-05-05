import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  getCurrentTheme,
  initTheme,
  prefersReducedMotion,
  readPreferredTheme,
  toggleTheme,
} from './theme';

describe('theme controller — spec §23', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
    window.history.replaceState(null, '', '#');
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('default theme is light when nothing is set and system preference is unknown', () => {
    expect(readPreferredTheme()).toBe('light');
  });

  it('respects prefers-color-scheme when storage and hash are empty', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({
      matches: q === '(prefers-color-scheme: dark)',
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }));
    expect(readPreferredTheme()).toBe('dark');
  });

  it('applyTheme writes data-theme attribute and back-compat .dark class', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applyTheme persists to localStorage', () => {
    applyTheme('dark');
    expect(localStorage.getItem('bim.theme')).toBe('dark');
    applyTheme('light');
    expect(localStorage.getItem('bim.theme')).toBe('light');
  });

  it('applyTheme reflects into the URL hash for shareable views', () => {
    applyTheme('dark');
    expect(window.location.hash).toContain('theme=dark');
    applyTheme('light');
    expect(window.location.hash).toContain('theme=light');
  });

  it('hash beats localStorage when resolving preference', () => {
    localStorage.setItem('bim.theme', 'light');
    window.history.replaceState(null, '', '#theme=dark');
    expect(readPreferredTheme()).toBe('dark');
  });

  it('localStorage beats system preference when hash is empty', () => {
    localStorage.setItem('bim.theme', 'dark');
    expect(readPreferredTheme()).toBe('dark');
  });

  it('toggleTheme flips light↔dark and returns the new value', () => {
    applyTheme('light');
    expect(toggleTheme()).toBe('dark');
    expect(getCurrentTheme()).toBe('dark');
    expect(toggleTheme()).toBe('light');
    expect(getCurrentTheme()).toBe('light');
  });

  it('initTheme is idempotent and applies the resolved theme', () => {
    localStorage.setItem('bim.theme', 'dark');
    expect(initTheme()).toBe('dark');
    expect(getCurrentTheme()).toBe('dark');
    expect(initTheme()).toBe('dark');
  });

  it('ignores invalid hash and storage values', () => {
    localStorage.setItem('bim.theme', 'sepia');
    window.history.replaceState(null, '', '#theme=midnight');
    expect(readPreferredTheme()).toBe('light');
  });
});

describe('prefersReducedMotion', () => {
  it('returns false when matchMedia missing', () => {
    const original = window.matchMedia;
    // @ts-expect-error simulate missing API
    window.matchMedia = undefined;
    try {
      expect(prefersReducedMotion()).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });

  it('mirrors the media query', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({
      matches: q === '(prefers-reduced-motion: reduce)',
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }));
    expect(prefersReducedMotion()).toBe(true);
  });
});
