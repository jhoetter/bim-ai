/**
 * EDT-01 — column grip provider.
 *
 * Position grip at the column's footprint centre. A separate rotation
 * handle is emitted for non-square columns (b ≠ h); square columns
 * have rotational symmetry so the rotation handle would be a no-op.
 *
 * Drag-commits use `updateElementProperty` with JSON-encoded values
 * (consistent with the floor `boundaryMm` pattern) so the engine path
 * doesn't need a bespoke MoveColumn command.
 */
import type { Element } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type Column = Extract<Element, { kind: 'column' }>;

const ROTATION_HANDLE_OFFSET_MM = 200;

export const columnGripProvider: ElementGripProvider<Column> = {
  grips(column: Column, _context: PlanContext): GripDescriptor[] {
    const grips: GripDescriptor[] = [];
    const positionGrip: GripDescriptor = {
      id: `${column.id}:position`,
      positionMm: column.positionMm,
      shape: 'square',
      axis: 'free',
      hint: 'Drag to move column',
      onDrag: () => ({ kind: 'unknown', id: column.id }),
      onCommit: (delta): GripCommand => ({
        type: 'updateElementProperty',
        elementId: column.id,
        key: 'positionMm',
        value: JSON.stringify({
          xMm: column.positionMm.xMm + delta.xMm,
          yMm: column.positionMm.yMm + delta.yMm,
        }),
      }),
      onNumericOverride: (absoluteMm): GripCommand => ({
        // Numeric override on a 2D position is interpreted as the new
        // X coordinate; Y is left unchanged. The grammar polish (EDT-06)
        // can swap this for an axis-aware Tab cycle later.
        type: 'updateElementProperty',
        elementId: column.id,
        key: 'positionMm',
        value: JSON.stringify({ xMm: absoluteMm, yMm: column.positionMm.yMm }),
      }),
    };
    grips.push(positionGrip);

    // Non-square columns get a rotation handle offset normal to the
    // long axis of the footprint. We pick the handle along +X by
    // default; the canvas rotates it by `rotationDeg` for display.
    if (column.bMm !== column.hMm) {
      const rotation = column.rotationDeg ?? 0;
      const rad = (rotation * Math.PI) / 180;
      const handleX = column.positionMm.xMm + Math.cos(rad) * ROTATION_HANDLE_OFFSET_MM;
      const handleY = column.positionMm.yMm + Math.sin(rad) * ROTATION_HANDLE_OFFSET_MM;
      const rotationGrip: GripDescriptor = {
        id: `${column.id}:rotation`,
        positionMm: { xMm: handleX, yMm: handleY },
        shape: 'arrow',
        axis: 'free',
        hint: 'Drag to rotate column',
        onDrag: () => ({ kind: 'unknown', id: column.id }),
        onCommit: (delta): GripCommand => {
          const dx = handleX - column.positionMm.xMm + delta.xMm;
          const dy = handleY - column.positionMm.yMm + delta.yMm;
          const nextDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
          return {
            type: 'updateElementProperty',
            elementId: column.id,
            key: 'rotationDeg',
            value: nextDeg,
          };
        },
        onNumericOverride: (absoluteMm): GripCommand => ({
          // For the rotation grip the typed value is angle in degrees.
          type: 'updateElementProperty',
          elementId: column.id,
          key: 'rotationDeg',
          value: absoluteMm,
        }),
      };
      grips.push(rotationGrip);
    }

    return grips;
  },
};
