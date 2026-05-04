import type { PerspectiveId, Violation } from '@bim-ai/core';

function disc(v: Violation): string {
  return (v.discipline ?? 'general').toLowerCase();
}

/** Perspective-based advisory filter — backend tags discipline when available */
export function filterViolationsForPerspective(rows: Violation[], pid: PerspectiveId): Violation[] {
  if (pid === 'agent') return rows;

  return rows.filter((v) => {
    const d = disc(v);

    switch (pid) {
      case 'architecture':
        return d === 'general' || d === 'architecture';

      case 'structure':
        return d === 'general' || d === 'structure';

      case 'mep':
        return d === 'general' || d === 'mep';

      case 'construction':
        return d === 'general' || d === 'construction';

      case 'coordination':
        return d === 'general' || d === 'coordination' || v.severity === 'error';

      default:
        return true;
    }
  });
}
