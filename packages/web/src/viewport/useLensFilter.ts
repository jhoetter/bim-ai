import type { Element, LensMode, ViewLensMode } from '@bim-ai/core';

const LENS_MODE_TO_DISCIPLINE: Record<string, string> = {
  architecture: 'arch',
  structure: 'struct',
  mep: 'mep',
};

const FIRE_SAFETY_KIND_SET = new Set<string>([
  'room',
  'wall',
  'floor',
  'ceiling',
  'door',
  'stair',
  'wall_opening',
  'slab_opening',
  'roof_opening',
  'pipe',
  'duct',
  'fixture',
]);

const FIRE_SAFETY_PROP_KEYS = new Set<string>([
  'fireSafety',
  'fireCompartmentId',
  'smokeCompartmentId',
  'fireResistanceRating',
  'fireRating',
  'smokeControlRating',
  'selfClosingRequired',
  'escapeRouteId',
  'travelDistanceM',
  'exitWidthMm',
  'doorSwingCompliant',
  'firestopStatus',
  'penetrationStatus',
]);

function fireSafetyProps(elem: Element): Record<string, unknown> {
  const raw = (elem as { props?: unknown }).props;
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

export function elementPassesFireSafetyLens(elem: Element): boolean {
  if (FIRE_SAFETY_KIND_SET.has(elem.kind)) return true;
  const props = fireSafetyProps(elem);
  return Object.keys(props).some((key) => FIRE_SAFETY_PROP_KEYS.has(key));
}

/**
 * DSC-V3-02 — resolve the discipline-lens pass from a UI LensMode value.
 *
 * Unlike `resolveLensFilter` (which reads from the saved view element's
 * `defaultLens`), this function takes the ephemeral dropdown selection
 * from the StatusBar and returns the same classifier function shape.
 */
export function lensFilterFromMode(mode: LensMode): (elem: Element) => 'foreground' | 'ghost' {
  if (mode === 'all' || mode === 'energy' || mode === 'coordination') {
    return () => 'foreground';
  }
  if (mode === 'fire-safety') {
    return (elem: Element): 'foreground' | 'ghost' =>
      elementPassesFireSafetyLens(elem) ? 'foreground' : 'ghost';
  }
  if (mode === 'construction') {
    return (elem: Element): 'foreground' | 'ghost' =>
      isConstructionLensElement(elem) ? 'foreground' : 'ghost';
  }
  const expected = LENS_MODE_TO_DISCIPLINE[mode];
  return (elem: Element): 'foreground' | 'ghost' => {
    const disc =
      ('discipline' in elem ? (elem.discipline as string | null | undefined) : null) ?? 'arch';
    return disc === expected ? 'foreground' : 'ghost';
  };
}

function isConstructionLensElement(elem: Element): boolean {
  if (
    elem.kind === 'construction_package' ||
    elem.kind === 'construction_logistics' ||
    elem.kind === 'construction_qa_checklist' ||
    elem.kind === 'issue'
  ) {
    return true;
  }
  if ('phaseCreated' in elem || 'phaseDemolished' in elem) {
    return Boolean(elem.phaseCreated || elem.phaseDemolished);
  }
  if ('props' in elem && elem.props && typeof elem.props === 'object') {
    return Boolean((elem.props as Record<string, unknown>).construction);
  }
  return false;
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

  if (lens === 'show_fire_safety') {
    return (elem: Element): 'foreground' | 'ghost' =>
      elementPassesFireSafetyLens(elem) ? 'foreground' : 'ghost';
  }

  const expected = LENS_TO_DISCIPLINE[lens];

  return (elem: Element): 'foreground' | 'ghost' => {
    const disc =
      ('discipline' in elem ? (elem.discipline as string | null | undefined) : null) ?? 'arch';
    return disc === expected ? 'foreground' : 'ghost';
  };
}
