import type { TFunction } from 'i18next';

export interface CheatsheetEntry {
  action: string;
  keys: string;
}

export interface CheatsheetSection {
  id: string;
  label: string;
  entries: CheatsheetEntry[];
}

export function getCheatsheetData(t: TFunction): CheatsheetSection[] {
  return [
    {
      id: 'global',
      label: t('cheatsheet.sections.global'),
      entries: [
        { action: t('cheatsheet.actions.commandPalette'), keys: '⌘K / Ctrl+K' },
        { action: t('cheatsheet.actions.showCheatsheet'), keys: '?' },
        { action: t('cheatsheet.actions.cancel'), keys: 'Escape' },
        { action: t('cheatsheet.actions.confirmApply'), keys: 'Enter' },
        { action: t('cheatsheet.actions.saveBundle'), keys: '⌘S' },
        { action: t('cheatsheet.actions.toggleTheme'), keys: '⌘⇧L' },
      ],
    },
    {
      id: 'modes',
      label: t('cheatsheet.sections.modes'),
      entries: [
        { action: t('cheatsheet.actions.modePlan'), keys: '1' },
        { action: t('cheatsheet.actions.mode3d'), keys: '2' },
        { action: t('cheatsheet.actions.modePlan3d'), keys: '3' },
        { action: t('cheatsheet.actions.modeSection'), keys: '4' },
        { action: t('cheatsheet.actions.modeSheet'), keys: '5' },
        { action: t('cheatsheet.actions.modeSchedule'), keys: '6' },
        { action: t('cheatsheet.actions.modeAgent'), keys: '7' },
      ],
    },
    {
      id: 'tools',
      label: t('cheatsheet.sections.tools'),
      entries: [
        { action: t('cheatsheet.actions.toolSelect'), keys: 'V' },
        { action: t('cheatsheet.actions.toolWall'), keys: 'W' },
        { action: t('cheatsheet.actions.toolDoor'), keys: 'D' },
        { action: t('cheatsheet.actions.toolWindow'), keys: 'Shift+W' },
        { action: t('cheatsheet.actions.toolFloor'), keys: 'F (plan canvas)' },
        { action: t('cheatsheet.actions.toolRoof'), keys: 'R' },
        { action: t('cheatsheet.actions.toolStair'), keys: 'S' },
        { action: t('cheatsheet.actions.toolRailing'), keys: 'Shift+R' },
        { action: t('cheatsheet.actions.toolRoom'), keys: 'M' },
        { action: t('cheatsheet.actions.toolDimension'), keys: 'Shift+D' },
        { action: t('cheatsheet.actions.toolSection'), keys: 'Shift+S' },
        { action: t('cheatsheet.actions.toolTag'), keys: 'T' },
      ],
    },
    {
      id: 'nav3d',
      label: t('cheatsheet.sections.nav3d'),
      entries: [
        { action: t('cheatsheet.actions.orbit'), keys: 'LMB drag · Alt+LMB' },
        { action: t('cheatsheet.actions.pan'), keys: 'RMB drag · Shift+LMB · MMB drag' },
        { action: t('cheatsheet.actions.zoomInOut'), keys: 'Scroll wheel · Pinch' },
        { action: t('cheatsheet.actions.zoomStep'), keys: '⌘= / ⌘-' },
        { action: t('cheatsheet.actions.fitAll'), keys: 'F' },
        { action: t('cheatsheet.actions.fitSelection'), keys: '⌘F / Ctrl+F' },
        { action: t('cheatsheet.actions.resetView'), keys: 'H · Home' },
        { action: t('cheatsheet.actions.enterWalk'), keys: 'Click Walk button (bottom-left)' },
      ],
    },
    {
      id: 'walk',
      label: t('cheatsheet.sections.walk'),
      entries: [
        { action: t('cheatsheet.actions.moveForwardBack'), keys: 'W / S · ↑ / ↓' },
        { action: t('cheatsheet.actions.strafeLeftRight'), keys: 'A / D · ← / →' },
        { action: t('cheatsheet.actions.ascendDescend'), keys: 'E / Q' },
        { action: t('cheatsheet.actions.run'), keys: 'Shift (hold)' },
        { action: t('cheatsheet.actions.lookAround'), keys: 'Mouse (pointer locked)' },
        { action: t('cheatsheet.actions.jumpFloorAbove'), keys: 'PageUp' },
        { action: t('cheatsheet.actions.jumpFloorBelow'), keys: 'PageDown' },
        { action: t('cheatsheet.actions.exitWalk'), keys: 'Esc' },
      ],
    },
    {
      id: 'nav2d',
      label: t('cheatsheet.sections.nav2d'),
      entries: [
        {
          action: t('cheatsheet.actions.pan'),
          keys: 'LMB drag (empty space) · RMB drag · Space+LMB · MMB',
        },
        { action: t('cheatsheet.actions.zoomInOut'), keys: 'Scroll wheel · Pinch' },
        { action: t('cheatsheet.actions.zoomPresets'), keys: 'Click scale bar (bottom-left)' },
        {
          action: t('cheatsheet.actions.fitToView'),
          keys: 'Shift+F · scale bar → Fit to view',
        },
      ],
    },
    {
      id: 'history',
      label: t('cheatsheet.sections.history'),
      entries: [
        { action: t('cheatsheet.actions.undo'), keys: '⌘Z' },
        { action: t('cheatsheet.actions.redo'), keys: '⇧⌘Z' },
      ],
    },
    {
      id: 'shell',
      label: t('cheatsheet.sections.shell'),
      entries: [
        { action: t('cheatsheet.actions.toggleLeftRail'), keys: '[' },
        { action: t('cheatsheet.actions.toggleRightRail'), keys: ']' },
      ],
    },
  ];
}

export function flattenCheatsheet(t: TFunction): CheatsheetEntry[] {
  return getCheatsheetData(t).flatMap((s) => s.entries);
}

export function filterCheatsheet(query: string, t: TFunction): CheatsheetSection[] {
  const data = getCheatsheetData(t);
  const q = query.trim().toLowerCase();
  if (!q) return data;
  const out: CheatsheetSection[] = [];
  for (const s of data) {
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
