import { describe, it, expect } from 'vitest';
import type { Element } from '@bim-ai/core';

import { textNoteGripProvider, leaderTextGripProvider } from './annotationGripProvider';

const textNote: Extract<Element, { kind: 'text_note' }> = {
  kind: 'text_note',
  id: 'tn-1',
  hostViewId: 'pv-1',
  positionMm: { xMm: 1000, yMm: 2000 },
  text: 'Hello',
  fontSizeMm: 200,
};

const leaderText: Extract<Element, { kind: 'leader_text' }> = {
  kind: 'leader_text',
  id: 'lt-1',
  hostViewId: 'pv-1',
  anchorMm: { xMm: 0, yMm: 0 },
  elbowMm: { xMm: 300, yMm: 0 },
  textMm: { xMm: 600, yMm: 0 },
  content: 'Wall type A',
};

describe('textNoteGripProvider', () => {
  it('emits one position grip at the text note position', () => {
    const grips = textNoteGripProvider.grips(textNote, {});
    expect(grips).toHaveLength(1);
    expect(grips[0]!.id).toBe('tn-1:position');
    expect(grips[0]!.positionMm).toEqual({ xMm: 1000, yMm: 2000 });
    expect(grips[0]!.shape).toBe('square');
    expect(grips[0]!.axis).toBe('free');
  });

  it('onCommit produces updateElementProperty for positionMm with delta applied', () => {
    const [grip] = textNoteGripProvider.grips(textNote, {});
    const cmd = grip!.onCommit({ xMm: 100, yMm: -50 });
    expect(cmd.type).toBe('updateElementProperty');
    expect(cmd.elementId).toBe('tn-1');
    expect(cmd.key).toBe('positionMm');
    const parsed = JSON.parse(cmd.value as string) as { xMm: number; yMm: number };
    expect(parsed).toEqual({ xMm: 1100, yMm: 1950 });
  });

  it('onNumericOverride sets X coordinate leaving Y unchanged', () => {
    const [grip] = textNoteGripProvider.grips(textNote, {});
    const cmd = grip!.onNumericOverride(5000);
    const parsed = JSON.parse(cmd.value as string) as { xMm: number; yMm: number };
    expect(parsed.xMm).toBe(5000);
    expect(parsed.yMm).toBe(2000);
  });
});

describe('leaderTextGripProvider', () => {
  it('emits two grips: anchor (circle) and text-block (square)', () => {
    const grips = leaderTextGripProvider.grips(leaderText, {});
    expect(grips).toHaveLength(2);
    const anchorGrip = grips.find((g) => g.id === 'lt-1:anchor');
    const textGrip = grips.find((g) => g.id === 'lt-1:text');
    expect(anchorGrip).toBeDefined();
    expect(textGrip).toBeDefined();
    expect(anchorGrip!.shape).toBe('circle');
    expect(textGrip!.shape).toBe('square');
  });

  it('anchor grip onCommit moves anchorMm by delta', () => {
    const grips = leaderTextGripProvider.grips(leaderText, {});
    const anchorGrip = grips.find((g) => g.id === 'lt-1:anchor')!;
    const cmd = anchorGrip.onCommit({ xMm: 50, yMm: 100 });
    expect(cmd.key).toBe('anchorMm');
    const parsed = JSON.parse(cmd.value as string) as { xMm: number; yMm: number };
    expect(parsed).toEqual({ xMm: 50, yMm: 100 });
  });

  it('text grip onCommit moves textMm by delta independently of anchor', () => {
    const grips = leaderTextGripProvider.grips(leaderText, {});
    const textGrip = grips.find((g) => g.id === 'lt-1:text')!;
    const cmd = textGrip.onCommit({ xMm: -200, yMm: 50 });
    expect(cmd.key).toBe('textMm');
    const parsed = JSON.parse(cmd.value as string) as { xMm: number; yMm: number };
    expect(parsed).toEqual({ xMm: 400, yMm: 50 });
  });
});
