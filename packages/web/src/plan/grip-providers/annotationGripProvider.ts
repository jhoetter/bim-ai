/**
 * ANN-01/ANN-16 — grip providers for view-local annotation elements.
 *
 * text_note: single position grip to drag the whole label.
 * leader_text: anchor grip + text-block grip (move independently).
 */
import type { Element } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type TextNote = Extract<Element, { kind: 'text_note' }>;
export type LeaderText = Extract<Element, { kind: 'leader_text' }>;

export const textNoteGripProvider: ElementGripProvider<TextNote> = {
  grips(el: TextNote, _ctx: PlanContext): GripDescriptor[] {
    const positionGrip: GripDescriptor = {
      id: `${el.id}:position`,
      positionMm: el.positionMm,
      shape: 'square',
      axis: 'free',
      hint: 'Drag to move text',
      onDrag: () => ({ kind: 'unknown', id: el.id }),
      onCommit: (delta): GripCommand => ({
        type: 'updateElementProperty',
        elementId: el.id,
        key: 'positionMm',
        value: JSON.stringify({
          xMm: el.positionMm.xMm + delta.xMm,
          yMm: el.positionMm.yMm + delta.yMm,
        }),
      }),
      onNumericOverride: (absoluteMm): GripCommand => ({
        type: 'updateElementProperty',
        elementId: el.id,
        key: 'positionMm',
        value: JSON.stringify({ xMm: absoluteMm, yMm: el.positionMm.yMm }),
      }),
    };
    return [positionGrip];
  },
};

export const leaderTextGripProvider: ElementGripProvider<LeaderText> = {
  grips(el: LeaderText, _ctx: PlanContext): GripDescriptor[] {
    const anchorGrip: GripDescriptor = {
      id: `${el.id}:anchor`,
      positionMm: el.anchorMm,
      shape: 'circle',
      axis: 'free',
      hint: 'Drag to move leader anchor',
      onDrag: () => ({ kind: 'unknown', id: el.id }),
      onCommit: (delta): GripCommand => ({
        type: 'updateElementProperty',
        elementId: el.id,
        key: 'anchorMm',
        value: JSON.stringify({
          xMm: el.anchorMm.xMm + delta.xMm,
          yMm: el.anchorMm.yMm + delta.yMm,
        }),
      }),
      onNumericOverride: (absoluteMm): GripCommand => ({
        type: 'updateElementProperty',
        elementId: el.id,
        key: 'anchorMm',
        value: JSON.stringify({ xMm: absoluteMm, yMm: el.anchorMm.yMm }),
      }),
    };
    const textGrip: GripDescriptor = {
      id: `${el.id}:text`,
      positionMm: el.textMm,
      shape: 'square',
      axis: 'free',
      hint: 'Drag to move text block',
      onDrag: () => ({ kind: 'unknown', id: el.id }),
      onCommit: (delta): GripCommand => ({
        type: 'updateElementProperty',
        elementId: el.id,
        key: 'textMm',
        value: JSON.stringify({
          xMm: el.textMm.xMm + delta.xMm,
          yMm: el.textMm.yMm + delta.yMm,
        }),
      }),
      onNumericOverride: (absoluteMm): GripCommand => ({
        type: 'updateElementProperty',
        elementId: el.id,
        key: 'textMm',
        value: JSON.stringify({ xMm: absoluteMm, yMm: el.textMm.yMm }),
      }),
    };
    return [anchorGrip, textGrip];
  },
};
