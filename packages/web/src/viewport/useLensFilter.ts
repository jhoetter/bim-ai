import type { Element, LensMode, ViewLensMode } from '@bim-ai/core';

const LENS_MODE_TO_DISCIPLINE: Record<string, string> = {
  architecture: 'arch',
  structure: 'struct',
  mep: 'mep',
};

const STRUCTURE_FOREGROUND_KINDS = new Set([
  'column',
  'beam',
  'grid_line',
  'level',
  'reference_plane',
]);

const STRUCTURAL_ROLES = new Set([
  'load_bearing',
  'bearing_wall',
  'shear_wall',
  'slab',
  'beam',
  'column',
  'foundation',
  'brace',
]);

function isStructureLensForeground(elem: Element): boolean {
  if (STRUCTURE_FOREGROUND_KINDS.has(elem.kind)) return true;
  const record = elem as Record<string, unknown>;
  if (record.loadBearing === true) return true;
  const role = typeof record.structuralRole === 'string' ? record.structuralRole : '';
  if (STRUCTURAL_ROLES.has(role)) return true;
  if (elem.kind === 'floor') return record.structuralRole !== 'non_load_bearing';
  return false;
}

/**
 * DSC-V3-02 — resolve the discipline-lens pass from a UI LensMode value.
 *
 * Unlike `resolveLensFilter` (which reads from the saved view element's
 * `defaultLens`), this function takes the ephemeral dropdown selection
 * from the StatusBar and returns the same classifier function shape.
 */
export function lensFilterFromMode(mode: LensMode): (elem: Element) => 'foreground' | 'ghost' {
  if (mode === 'all' || mode === 'energy' || mode === 'coordination' || mode === 'sustainability') {
    return () => 'foreground';
  }
  const expected = LENS_MODE_TO_DISCIPLINE[mode];
  if (mode === 'structure') {
    return (elem: Element): 'foreground' | 'ghost' =>
      isStructureLensForeground(elem) ? 'foreground' : 'ghost';
  }
  return (elem: Element): 'foreground' | 'ghost' => {
    const disc =
      ('discipline' in elem ? (elem.discipline as string | null | undefined) : null) ?? 'arch';
    return disc === expected ? 'foreground' : 'ghost';
  };
}

const LENS_TO_DISCIPLINE: Record<string, string> = {
  show_arch: 'arch',
  show_struct: 'struct',
  show_mep: 'mep',
};

/**
 * DSC-V3-02 — resolve the discipline-lens pass for a view.
 *
 * Given the active view element (plan_view or view), returns a classifier
 * function: 'foreground' if the element matches the view's defaultLens,
 * 'ghost' otherwise. show_all → everything foreground.
 *
 * Elements with no discipline field default to 'arch'.
 */
export function resolveLensFilter(
  viewElem: { defaultLens?: ViewLensMode } | null | undefined,
): (elem: Element) => 'foreground' | 'ghost' {
  const lens: ViewLensMode = viewElem?.defaultLens ?? 'show_all';

  if (lens === 'show_all') {
    return () => 'foreground';
  }

  const expected = LENS_TO_DISCIPLINE[lens];

  return (elem: Element): 'foreground' | 'ghost' => {
    if (lens === 'show_struct') {
      return isStructureLensForeground(elem) ? 'foreground' : 'ghost';
    }
    const disc =
      ('discipline' in elem ? (elem.discipline as string | null | undefined) : null) ?? 'arch';
    return disc === expected ? 'foreground' : 'ghost';
  };
}
