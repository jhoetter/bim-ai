/**
 * View-aware modify command availability (WP-NEXT-47).
 *
 * Returns which modify verbs are enabled for a given selection in a given
 * view mode. The matrix mirrors Revit's contextual Modify ribbon behaviour:
 * - Plan: all modify verbs available for structural / annotative elements.
 * - 3D: geometry verbs available; annotation verbs hidden.
 * - Section: limited set (move, copy, rotate, delete, pin).
 * - Sheet: viewport-specific modify only.
 * - Schedule: row operations only.
 */

export type ModifyVerb =
  | 'move'
  | 'copy'
  | 'rotate'
  | 'mirror'
  | 'align'
  | 'offset'
  | 'trim-extend'
  | 'split'
  | 'join'
  | 'unjoin'
  | 'attach'
  | 'detach'
  | 'pin'
  | 'unpin'
  | 'delete'
  | 'array'
  | 'scale';

export type ViewMode = 'plan' | '3d' | 'section' | 'sheet' | 'schedule';

export interface ModifyAvailability {
  verb: ModifyVerb;
  enabled: boolean;
  reason?: string;
}

const GEOMETRY_VERBS: ModifyVerb[] = [
  'move',
  'copy',
  'rotate',
  'mirror',
  'align',
  'offset',
  'trim-extend',
  'split',
  'join',
  'unjoin',
  'attach',
  'detach',
  'pin',
  'unpin',
  'delete',
  'array',
  'scale',
];

const SECTION_VERBS: ModifyVerb[] = ['move', 'copy', 'rotate', 'delete', 'pin', 'unpin'];

/** Element kinds that support wall-specific verbs (trim/extend, offset, attach/detach). */
const WALL_KINDS = new Set(['wall']);
/** Element kinds that support join geometry. */
const SOLID_KINDS = new Set(['wall', 'floor', 'roof', 'ceiling', 'column', 'beam']);

function supportsVerb(
  verb: ModifyVerb,
  selectedKinds: string[],
  viewMode: ViewMode,
): { enabled: boolean; reason?: string } {
  if (viewMode === 'schedule') {
    return { enabled: false, reason: 'Modify geometry is not available in Schedule view.' };
  }
  if (viewMode === 'sheet') {
    const sheetVerbs: ModifyVerb[] = ['move', 'copy', 'delete', 'scale'];
    if (!sheetVerbs.includes(verb)) {
      return {
        enabled: false,
        reason: 'Only Move, Copy, Delete, and Scale are available for viewports on sheets.',
      };
    }
    return { enabled: true };
  }
  if (viewMode === 'section') {
    if (!SECTION_VERBS.includes(verb)) {
      return {
        enabled: false,
        reason: 'Only Move, Copy, Rotate, Delete, Pin, and Unpin are available in Section view.',
      };
    }
    return { enabled: true };
  }

  // plan + 3D
  if (viewMode === '3d' && (verb === 'offset' || verb === 'trim-extend' || verb === 'split')) {
    return { enabled: false, reason: `${verb} is not available in 3D view — switch to Plan.` };
  }

  if (verb === 'attach' || verb === 'detach') {
    const allWalls = selectedKinds.every((k) => WALL_KINDS.has(k));
    if (!allWalls) {
      return { enabled: false, reason: 'Attach/Detach applies only to wall elements.' };
    }
    return { enabled: true };
  }

  if (verb === 'join' || verb === 'unjoin') {
    const allSolid = selectedKinds.every((k) => SOLID_KINDS.has(k));
    if (!allSolid) {
      return {
        enabled: false,
        reason:
          'Join/Unjoin applies only to solid geometry (wall, floor, roof, ceiling, column, beam).',
      };
    }
    return { enabled: true };
  }

  if (verb === 'align') {
    if (selectedKinds.length < 2) {
      return { enabled: false, reason: 'Align requires at least two selected elements.' };
    }
    return { enabled: true };
  }

  if (verb === 'mirror') {
    if (selectedKinds.length === 0) {
      return { enabled: false, reason: 'Mirror requires at least one selected element.' };
    }
    return { enabled: true };
  }

  return { enabled: true };
}

/**
 * Returns the full modify availability matrix for the given selection and view mode.
 * `selectedKinds` is the list of element kind values for the current selection
 * (e.g. ['wall', 'wall'] for two walls, [] for no selection).
 */
export function getModifyAvailability(
  selectedKinds: string[],
  viewMode: ViewMode,
): ModifyAvailability[] {
  if (selectedKinds.length === 0) {
    return GEOMETRY_VERBS.map((verb) => ({
      verb,
      enabled: false,
      reason: 'No element selected.',
    }));
  }
  return GEOMETRY_VERBS.map((verb) => {
    const { enabled, reason } = supportsVerb(verb, selectedKinds, viewMode);
    return { verb, enabled, reason };
  });
}

/** Helper — returns only enabled verbs for a given selection + mode. */
export function getEnabledVerbs(selectedKinds: string[], viewMode: ViewMode): ModifyVerb[] {
  return getModifyAvailability(selectedKinds, viewMode)
    .filter((a) => a.enabled)
    .map((a) => a.verb);
}
