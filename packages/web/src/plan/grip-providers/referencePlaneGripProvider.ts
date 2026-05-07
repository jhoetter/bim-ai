/**
 * EDT-01 — reference plane grip provider (KRN-05 project-scope variant).
 *
 * Endpoint grips at `startMm` / `endMm`. The family-editor variant of
 * `reference_plane` is keyed off `familyEditorId` and lives in a
 * different document space — we discriminate by presence of
 * `startMm` and skip family-editor refplanes here.
 */
import type { Element } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type ReferencePlane = Extract<Element, { kind: 'reference_plane' }>;

interface KrnRefPlane {
  kind: 'reference_plane';
  id: string;
  startMm: { xMm: number; yMm: number };
  endMm: { xMm: number; yMm: number };
}

function isKrnRefPlane(rp: ReferencePlane): rp is ReferencePlane & KrnRefPlane {
  return 'startMm' in rp && 'endMm' in rp;
}

export const referencePlaneGripProvider: ElementGripProvider<ReferencePlane> = {
  grips(rp: ReferencePlane, _context: PlanContext): GripDescriptor[] {
    if (!isKrnRefPlane(rp)) return [];

    const startGrip: GripDescriptor = {
      id: `${rp.id}:start`,
      positionMm: rp.startMm,
      shape: 'square',
      axis: 'free',
      hint: 'Drag reference plane start',
      onDrag: () => ({ kind: 'unknown', id: rp.id }),
      onCommit: (delta): GripCommand => ({
        type: 'updateElementProperty',
        elementId: rp.id,
        key: 'startMm',
        value: JSON.stringify({
          xMm: rp.startMm.xMm + delta.xMm,
          yMm: rp.startMm.yMm + delta.yMm,
        }),
      }),
      onNumericOverride: (absoluteMm): GripCommand => {
        const dirX = rp.startMm.xMm - rp.endMm.xMm;
        const dirY = rp.startMm.yMm - rp.endMm.yMm;
        const len = Math.hypot(dirX, dirY) || 1;
        return {
          type: 'updateElementProperty',
          elementId: rp.id,
          key: 'startMm',
          value: JSON.stringify({
            xMm: rp.endMm.xMm + (dirX / len) * absoluteMm,
            yMm: rp.endMm.yMm + (dirY / len) * absoluteMm,
          }),
        };
      },
    };

    const endGrip: GripDescriptor = {
      id: `${rp.id}:end`,
      positionMm: rp.endMm,
      shape: 'square',
      axis: 'free',
      hint: 'Drag reference plane end',
      onDrag: () => ({ kind: 'unknown', id: rp.id }),
      onCommit: (delta): GripCommand => ({
        type: 'updateElementProperty',
        elementId: rp.id,
        key: 'endMm',
        value: JSON.stringify({
          xMm: rp.endMm.xMm + delta.xMm,
          yMm: rp.endMm.yMm + delta.yMm,
        }),
      }),
      onNumericOverride: (absoluteMm): GripCommand => {
        const dirX = rp.endMm.xMm - rp.startMm.xMm;
        const dirY = rp.endMm.yMm - rp.startMm.yMm;
        const len = Math.hypot(dirX, dirY) || 1;
        return {
          type: 'updateElementProperty',
          elementId: rp.id,
          key: 'endMm',
          value: JSON.stringify({
            xMm: rp.startMm.xMm + (dirX / len) * absoluteMm,
            yMm: rp.startMm.yMm + (dirY / len) * absoluteMm,
          }),
        };
      },
    };

    return [startGrip, endGrip];
  },
};
