/**
 * EDT-01 — section line grip provider.
 *
 * Two endpoint grips at the section_cut's line start / end. Drag
 * commits an `updateElementProperty` on `lineStartMm` /
 * `lineEndMm`; numeric override interprets the value as a distance
 * from the unmoved endpoint along the current section line.
 */
import type { Element } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type SectionCut = Extract<Element, { kind: 'section_cut' }>;

export const sectionCutGripProvider: ElementGripProvider<SectionCut> = {
  grips(section: SectionCut, _context: PlanContext): GripDescriptor[] {
    const startGrip: GripDescriptor = {
      id: `${section.id}:start`,
      positionMm: section.lineStartMm,
      shape: 'square',
      axis: 'free',
      hint: 'Drag section line start',
      onDrag: () => ({ kind: 'unknown', id: section.id }),
      onCommit: (delta): GripCommand => ({
        type: 'updateElementProperty',
        elementId: section.id,
        key: 'lineStartMm',
        value: JSON.stringify({
          xMm: section.lineStartMm.xMm + delta.xMm,
          yMm: section.lineStartMm.yMm + delta.yMm,
        }),
      }),
      onNumericOverride: (absoluteMm): GripCommand => {
        const dirX = section.lineStartMm.xMm - section.lineEndMm.xMm;
        const dirY = section.lineStartMm.yMm - section.lineEndMm.yMm;
        const len = Math.hypot(dirX, dirY) || 1;
        return {
          type: 'updateElementProperty',
          elementId: section.id,
          key: 'lineStartMm',
          value: JSON.stringify({
            xMm: section.lineEndMm.xMm + (dirX / len) * absoluteMm,
            yMm: section.lineEndMm.yMm + (dirY / len) * absoluteMm,
          }),
        };
      },
    };

    const endGrip: GripDescriptor = {
      id: `${section.id}:end`,
      positionMm: section.lineEndMm,
      shape: 'square',
      axis: 'free',
      hint: 'Drag section line end',
      onDrag: () => ({ kind: 'unknown', id: section.id }),
      onCommit: (delta): GripCommand => ({
        type: 'updateElementProperty',
        elementId: section.id,
        key: 'lineEndMm',
        value: JSON.stringify({
          xMm: section.lineEndMm.xMm + delta.xMm,
          yMm: section.lineEndMm.yMm + delta.yMm,
        }),
      }),
      onNumericOverride: (absoluteMm): GripCommand => {
        const dirX = section.lineEndMm.xMm - section.lineStartMm.xMm;
        const dirY = section.lineEndMm.yMm - section.lineStartMm.yMm;
        const len = Math.hypot(dirX, dirY) || 1;
        return {
          type: 'updateElementProperty',
          elementId: section.id,
          key: 'lineEndMm',
          value: JSON.stringify({
            xMm: section.lineStartMm.xMm + (dirX / len) * absoluteMm,
            yMm: section.lineStartMm.yMm + (dirY / len) * absoluteMm,
          }),
        };
      },
    };

    return [startGrip, endGrip];
  },
};
