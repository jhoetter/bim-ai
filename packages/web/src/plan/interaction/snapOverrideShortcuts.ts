import type { ToggleableSnapKind } from '../snapSettings';

export type SnapOverrideKeyState = { key: 's'; time: number } | null;

export type SnapOverrideShortcutInput = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
};

export type SnapOverrideShortcutResult = {
  nextState: SnapOverrideKeyState;
  override: ToggleableSnapKind | null;
};

const SNAP_OVERRIDE_BY_KEY: Readonly<Record<string, ToggleableSnapKind>> = {
  i: 'intersection',
  e: 'endpoint',
  m: 'midpoint',
  n: 'nearest',
  c: 'center',
  p: 'perpendicular',
  x: 'extension',
  w: 'workplane',
};

export function resolveSnapOverrideShortcut(
  input: SnapOverrideShortcutInput,
  lastState: SnapOverrideKeyState,
  now = Date.now(),
): SnapOverrideShortcutResult {
  if (input.metaKey || input.ctrlKey || input.altKey) {
    return { nextState: lastState, override: null };
  }

  const key = input.key.toLowerCase();
  if (lastState?.key === 's' && now - lastState.time <= 500) {
    return { nextState: null, override: SNAP_OVERRIDE_BY_KEY[key] ?? null };
  }
  if (key === 's') {
    return { nextState: { key: 's', time: now }, override: null };
  }
  return { nextState: null, override: null };
}
