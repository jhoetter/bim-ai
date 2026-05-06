/**
 * Cheatsheet data — spec §19.
 *
 * Canonical keyboard-shortcut catalogue. Grouped by section so the
 * `?`-modal can render an organised list. Tests assert that every
 * spec'd action lives here.
 */

export interface CheatsheetEntry {
  action: string;
  keys: string;
}

export interface CheatsheetSection {
  id: string;
  label: string;
  entries: CheatsheetEntry[];
}

export const CHEATSHEET: CheatsheetSection[] = [
  {
    id: 'global',
    label: 'Global',
    entries: [
      { action: 'Command palette', keys: '⌘K / Ctrl+K' },
      { action: 'Show this cheatsheet', keys: '?' },
      { action: 'Cancel', keys: 'Escape' },
      { action: 'Confirm / Apply', keys: 'Enter' },
      { action: 'Save bundle', keys: '⌘S' },
      { action: 'Toggle theme', keys: '⌘⇧L' },
    ],
  },
  {
    id: 'modes',
    label: 'Workspace modes',
    entries: [
      { action: 'Plan', keys: '1' },
      { action: '3D', keys: '2' },
      { action: 'Plan + 3D', keys: '3' },
      { action: 'Section', keys: '4' },
      { action: 'Sheet', keys: '5' },
      { action: 'Schedule', keys: '6' },
      { action: 'Agent', keys: '7' },
    ],
  },
  {
    id: 'tools',
    label: 'Drawing tools',
    entries: [
      { action: 'Select', keys: 'V' },
      { action: 'Wall', keys: 'W' },
      { action: 'Door', keys: 'D' },
      { action: 'Window', keys: 'Shift+W' },
      { action: 'Floor', keys: 'F (plan canvas)' },
      { action: 'Roof', keys: 'R' },
      { action: 'Stair', keys: 'S' },
      { action: 'Railing', keys: 'Shift+R' },
      { action: 'Room marker', keys: 'M' },
      { action: 'Dimension', keys: 'Shift+D' },
      { action: 'Section', keys: 'Shift+S' },
      { action: 'Tag', keys: 'T' },
    ],
  },
  {
    id: 'nav3d',
    label: '3D navigation (orbit mode)',
    entries: [
      { action: 'Orbit', keys: 'LMB drag · Alt+LMB' },
      { action: 'Pan', keys: 'RMB drag · Shift+LMB · MMB drag' },
      { action: 'Zoom in / out', keys: 'Scroll wheel · Pinch' },
      { action: 'Zoom step', keys: '⌘= / ⌘-' },
      { action: 'Fit all to view', keys: 'F' },
      { action: 'Fit selection', keys: '⌘F / Ctrl+F' },
      { action: 'Reset view', keys: 'H · Home' },
      { action: 'Enter walk mode', keys: 'Click Walk button (bottom-left)' },
    ],
  },
  {
    id: 'walk',
    label: '3D navigation (walk mode)',
    entries: [
      { action: 'Move forward / back', keys: 'W / S · ↑ / ↓' },
      { action: 'Strafe left / right', keys: 'A / D · ← / →' },
      { action: 'Ascend / descend', keys: 'E / Q' },
      { action: 'Run', keys: 'Shift (hold)' },
      { action: 'Look around', keys: 'Mouse (pointer locked)' },
      { action: 'Jump to floor above', keys: 'PageUp' },
      { action: 'Jump to floor below', keys: 'PageDown' },
      { action: 'Exit walk mode', keys: 'Esc' },
    ],
  },
  {
    id: 'nav2d',
    label: '2D plan navigation',
    entries: [
      { action: 'Pan', keys: 'LMB drag (empty space) · RMB drag · Space+LMB · MMB' },
      { action: 'Zoom in / out', keys: 'Scroll wheel · Pinch' },
      { action: 'Zoom presets', keys: 'Click scale bar (bottom-left)' },
      { action: 'Fit to view', keys: 'Shift+F · scale bar → Fit to view' },
    ],
  },
  {
    id: 'history',
    label: 'History',
    entries: [
      { action: 'Undo', keys: '⌘Z' },
      { action: 'Redo', keys: '⇧⌘Z' },
    ],
  },
  {
    id: 'shell',
    label: 'Shell',
    entries: [
      { action: 'Toggle left rail', keys: '[' },
      { action: 'Toggle right rail', keys: ']' },
    ],
  },
];

/** Flat list of every action — useful for tests. */
export function flattenCheatsheet(): CheatsheetEntry[] {
  return CHEATSHEET.flatMap((s) => s.entries);
}

/** Filter entries that match `query` (case-insensitive substring on
 * action or keys). Empty query returns the original sections. */
export function filterCheatsheet(query: string): CheatsheetSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return CHEATSHEET;
  const out: CheatsheetSection[] = [];
  for (const s of CHEATSHEET) {
    const entries = s.entries.filter(
      (e) => e.action.toLowerCase().includes(q) || e.keys.toLowerCase().includes(q),
    );
    if (entries.length) out.push({ ...s, entries });
  }
  return out;
}

/** True if a key event should open the cheatsheet — `?` (Shift+/). */
export function shouldOpenCheatsheet(event: { key: string; shiftKey?: boolean }): boolean {
  return event.key === '?' || (event.shiftKey === true && event.key === '/');
}
