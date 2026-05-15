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

const COST_QUANTITY_KIND_SET = new Set<string>(['wall', 'floor', 'roof', 'door', 'window', 'room']);

const COST_QUANTITY_PROP_KEYS = new Set<string>([
  'cost',
  'costQuantity',
  'costClassification',
  'cost_classification',
  'costGroup',
  'cost_group',
  'din276Group',
  'workPackage',
  'work_package',
  'trade',
  'unit',
  'unitRate',
  'unit_rate',
  'costSource',
  'rateSource',
  'scenarioId',
]);

function elementProps(elem: Element): Record<string, unknown> {
  const raw = (elem as { props?: unknown }).props;
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

export function elementPassesFireSafetyLens(elem: Element): boolean {
  if (FIRE_SAFETY_KIND_SET.has(elem.kind as string)) return true;
  const props = elementProps(elem);
  return Object.keys(props).some((key) => FIRE_SAFETY_PROP_KEYS.has(key));
}

function costQuantityProps(elem: Element): Record<string, unknown> {
  const props = elementProps(elem);
  const merged: Record<string, unknown> = { ...props };
  for (const key of ['cost', 'costQuantity', 'costClassification', 'cost_classification']) {
    const nested = props[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      Object.assign(merged, nested as Record<string, unknown>);
    }
  }
  return merged;
}

export function elementPassesCostQuantityLens(elem: Element): boolean {
  if (COST_QUANTITY_KIND_SET.has(elem.kind as string)) return true;
  const props = costQuantityProps(elem);
  return Object.keys(props).some((key) => COST_QUANTITY_PROP_KEYS.has(key));
}

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
  if (mode === 'fire-safety') {
    return (elem: Element): 'foreground' | 'ghost' =>
      elementPassesFireSafetyLens(elem) ? 'foreground' : 'ghost';
  }
  if (mode === 'construction') {
    return (elem: Element): 'foreground' | 'ghost' =>
      isConstructionLensElement(elem) ? 'foreground' : 'ghost';
  }
  if (mode === 'cost-quantity') {
    return (elem: Element): 'foreground' | 'ghost' =>
      elementPassesCostQuantityLens(elem) ? 'foreground' : 'ghost';
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

function isConstructionLensElement(elem: Element): boolean {
  const kind = elem.kind as string;
  if (
    kind === 'construction_package' ||
    kind === 'construction_logistics' ||
    kind === 'construction_qa_checklist' ||
    kind === 'issue'
  ) {
    return true;
  }
  const record = elem as Record<string, unknown>;
  if ('phaseCreated' in record || 'phaseDemolished' in record) {
    return Boolean(record.phaseCreated || record.phaseDemolished);
  }
  return Boolean(elementProps(elem).construction);
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

  if (lens === 'show_cost_quantity') {
    return (elem: Element): 'foreground' | 'ghost' =>
      elementPassesCostQuantityLens(elem) ? 'foreground' : 'ghost';
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
