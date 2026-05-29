import { useEffect, useState } from 'react';
import { getCurrentTheme, type Theme } from './theme';

/**
 * Subscribe to `data-theme` attribute changes on `<html>`.
 *
 * Returns the current theme and a hook ref that increments on every
 * theme switch — components that own non-React paint surfaces (Three.js
 * scenes, Canvas renderers) read the ref and rebuild materials when it
 * changes.
 *
 * Spec §23 + §32 V11 — fixes the bug where theme toggles repaint chrome
 * but Three.js materials still hold cached token colors.
 */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() => getCurrentTheme());

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(getCurrentTheme());
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
