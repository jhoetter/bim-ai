/**
 * CHR-V3-08 — ToolModifierBar data model.
 *
 * `ToolModifierDescriptor` is the contract each authoring tool registers to
 * declare which modifier chips appear in the 36 px secondary contextual bar.
 * The bar's layout is identical across all tools; only the descriptors differ.
 *
 * Modifier vocabulary (spec §UX table):
 *   toggle       — on/off flag; may be sticky per session via toolPrefs
 *   cycle        — cycles through a named value set (e.g. wall location line,
 *                  door swing side); current value stored in toolPrefs when
 *                  sticky === true
 *   always-armed — permanently active; shown as an informational chip only
 *                  (Numeric input, Tab-cycle)
 */

import type { ToolId } from './toolRegistry';
import type { WallLocationLine } from './toolGrammar';
import { WALL_LOCATION_LINE_ORDER } from './toolGrammar';

// ─── Descriptor shapes ────────────────────────────────────────────────────────

export interface ToggleModifierDescriptor {
  kind: 'toggle';
  id: string;
  label: string;
  shortcut?: string;
  defaultOn: boolean;
  /** Persist across tool switches for the session (zustand toolPrefs). */
  sticky: boolean;
}

export interface CycleModifierDescriptor {
  kind: 'cycle';
  id: string;
  label: string;
  shortcut?: string;
  values: readonly string[];
  valueLabels: Record<string, string>;
  defaultValue: string;
  /** Persist across tool switches for the session (zustand toolPrefs). */
  sticky: boolean;
}

export interface AlwaysArmedModifierDescriptor {
  kind: 'always-armed';
  id: string;
  label: string;
  shortcut?: string;
}

export type ToolModifierDescriptor =
  | ToggleModifierDescriptor
  | CycleModifierDescriptor
  | AlwaysArmedModifierDescriptor;

// ─── Per-tool registrations ───────────────────────────────────────────────────

const WALL_LOCATION_LABELS: Record<WallLocationLine, string> = {
  'wall-centerline': 'Centerline',
  'finish-face-exterior': 'Finish: Ext.',
  'finish-face-interior': 'Finish: Int.',
  'core-centerline': 'Core CL',
  'core-face-exterior': 'Core: Ext.',
  'core-face-interior': 'Core: Int.',
};

const WALL_MODIFIERS: ToolModifierDescriptor[] = [
  {
    kind: 'cycle',
    id: 'location-line',
    label: 'Align',
    shortcut: 'S',
    values: WALL_LOCATION_LINE_ORDER,
    valueLabels: WALL_LOCATION_LABELS,
    defaultValue: 'wall-centerline',
    sticky: true,
  },
  {
    kind: 'toggle',
    id: 'loop',
    label: 'Loop',
    shortcut: 'L',
    defaultOn: false,
    sticky: true,
  },
  {
    kind: 'toggle',
    id: 'multiple',
    label: 'Multiple',
    defaultOn: false,
    sticky: true,
  },
  {
    kind: 'toggle',
    id: 'tag-on-place',
    label: 'Tag on Place',
    defaultOn: false,
    sticky: true,
  },
  {
    kind: 'always-armed',
    id: 'numeric',
    label: 'Numeric',
    shortcut: '0–9',
  },
  {
    kind: 'always-armed',
    id: 'tab-cycle',
    label: 'Tab',
    shortcut: '⇥',
  },
];

const DOOR_MODIFIERS: ToolModifierDescriptor[] = [
  {
    kind: 'cycle',
    id: 'swing-side',
    label: 'Swing',
    shortcut: 'Space',
    values: ['left', 'right'],
    valueLabels: { left: 'Left', right: 'Right' },
    defaultValue: 'left',
    sticky: true,
  },
  {
    kind: 'toggle',
    id: 'multiple',
    label: 'Multiple',
    defaultOn: true,
    sticky: true,
  },
  {
    kind: 'toggle',
    id: 'tag-on-place',
    label: 'Tag on Place',
    defaultOn: false,
    sticky: true,
  },
];

const WINDOW_MODIFIERS: ToolModifierDescriptor[] = [
  {
    kind: 'toggle',
    id: 'multiple',
    label: 'Multiple',
    defaultOn: true,
    sticky: true,
  },
  {
    kind: 'toggle',
    id: 'tag-on-place',
    label: 'Tag on Place',
    defaultOn: false,
    sticky: true,
  },
];

const COLUMN_MODIFIERS: ToolModifierDescriptor[] = [
  {
    kind: 'toggle',
    id: 'multiple',
    label: 'Multiple',
    defaultOn: true,
    sticky: true,
  },
];

const BEAM_MODIFIERS: ToolModifierDescriptor[] = [
  {
    kind: 'toggle',
    id: 'loop',
    label: 'Loop',
    shortcut: 'L',
    defaultOn: false,
    sticky: true,
  },
  {
    kind: 'always-armed',
    id: 'numeric',
    label: 'Numeric',
    shortcut: '0–9',
  },
];

const DIMENSION_MODIFIERS: ToolModifierDescriptor[] = [
  {
    kind: 'toggle',
    id: 'loop',
    label: 'Loop',
    shortcut: 'L',
    defaultOn: false,
    sticky: true,
  },
  {
    kind: 'always-armed',
    id: 'numeric',
    label: 'Numeric',
    shortcut: '0–9',
  },
];

const SECTION_MODIFIERS: ToolModifierDescriptor[] = [
  {
    kind: 'toggle',
    id: 'loop',
    label: 'Loop',
    shortcut: 'L',
    defaultOn: false,
    sticky: true,
  },
];

const STAIR_MODIFIERS: ToolModifierDescriptor[] = [
  {
    kind: 'toggle',
    id: 'multiple',
    label: 'Multiple',
    defaultOn: false,
    sticky: true,
  },
];

const RAILING_MODIFIERS: ToolModifierDescriptor[] = [
  {
    kind: 'toggle',
    id: 'loop',
    label: 'Loop',
    shortcut: 'L',
    defaultOn: false,
    sticky: true,
  },
];

const ROOF_MODIFIERS: ToolModifierDescriptor[] = [
  {
    kind: 'toggle',
    id: 'multiple',
    label: 'Multiple',
    defaultOn: false,
    sticky: true,
  },
];

/**
 * Per-tool modifier registrations. Tools absent from this map show no
 * modifier bar (bar disappears rather than rendering empty).
 */
export const TOOL_MODIFIER_DESCRIPTORS: Partial<Record<ToolId, ToolModifierDescriptor[]>> = {
  wall: WALL_MODIFIERS,
  door: DOOR_MODIFIERS,
  window: WINDOW_MODIFIERS,
  column: COLUMN_MODIFIERS,
  beam: BEAM_MODIFIERS,
  dimension: DIMENSION_MODIFIERS,
  section: SECTION_MODIFIERS,
  stair: STAIR_MODIFIERS,
  railing: RAILING_MODIFIERS,
  roof: ROOF_MODIFIERS,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getToolModifierDescriptors(toolId: ToolId | null): ToolModifierDescriptor[] {
  if (!toolId) return [];
  return TOOL_MODIFIER_DESCRIPTORS[toolId] ?? [];
}

/** Returns the next cycle value, wrapping around. */
export function nextCycleValue(descriptor: CycleModifierDescriptor, current: string): string {
  const idx = descriptor.values.indexOf(current);
  if (idx < 0) return descriptor.values[0] ?? current;
  return descriptor.values[(idx + 1) % descriptor.values.length] ?? current;
}
