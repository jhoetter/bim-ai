import type { Element } from '@bim-ai/core';

export type ClearanceViolation = {
  elementId: string;
  kind: 'door' | 'window' | 'stair';
  clearanceMm: number;
  requiredMm: number;
  positionMm: { xMm: number; yMm: number };
  message: string;
};

/**
 * Checks all doors, windows, and stairs on a level for head-height clearance.
 * Returns violations where actual clearance < requiredMm.
 */
export function checkHeadHeightClearances(
  levelId: string,
  elementsById: Record<string, Element | undefined>,
  requiredDoorMm = 2100,
  requiredStairMm = 2000,
): ClearanceViolation[] {
  const violations: ClearanceViolation[] = [];

  for (const el of Object.values(elementsById)) {
    if (!el) continue;

    if (el.kind === 'door') {
      if (el.levelId !== levelId) continue;
      const headH = (el.overrideParams?.['heightMm'] as number | undefined) ?? 2100;
      if (headH < requiredDoorMm) {
        const pos = (el as unknown as { positionMm?: { xMm: number; yMm: number } }).positionMm ?? {
          xMm: 0,
          yMm: 0,
        };
        violations.push({
          elementId: el.id,
          kind: 'door',
          clearanceMm: headH,
          requiredMm: requiredDoorMm,
          positionMm: pos,
          message: `Door head height ${headH}mm < required ${requiredDoorMm}mm`,
        });
      }
    } else if (el.kind === 'window') {
      if (el.levelId !== levelId) continue;
      const headH = el.sillHeightMm + el.heightMm;
      if (headH < requiredDoorMm) {
        const pos = (el as unknown as { positionMm?: { xMm: number; yMm: number } }).positionMm ?? {
          xMm: 0,
          yMm: 0,
        };
        violations.push({
          elementId: el.id,
          kind: 'window',
          clearanceMm: headH,
          requiredMm: requiredDoorMm,
          positionMm: pos,
          message: `Window head height ${headH}mm < required ${requiredDoorMm}mm`,
        });
      }
    } else if (el.kind === 'stair') {
      if (el.baseLevelId !== levelId) continue;
      const stairH =
        el.totalHeightMm ?? (el.riserCount ?? 16) * (el.riserHeightMm ?? el.riserMm ?? 175);
      if (stairH < requiredStairMm) {
        const midMm = {
          xMm: (el.runStartMm.xMm + el.runEndMm.xMm) / 2,
          yMm: (el.runStartMm.yMm + el.runEndMm.yMm) / 2,
        };
        violations.push({
          elementId: el.id,
          kind: 'stair',
          clearanceMm: stairH,
          requiredMm: requiredStairMm,
          positionMm: midMm,
          message: `Stair head height ${stairH}mm < required ${requiredStairMm}mm`,
        });
      }
    }
  }

  return violations;
}
