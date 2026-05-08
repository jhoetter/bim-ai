import type { Element, ViewLensMode } from '@bim-ai/core';

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
    const disc =
      ('discipline' in elem ? (elem.discipline as string | null | undefined) : null) ?? 'arch';
    return disc === expected ? 'foreground' : 'ghost';
  };
}
