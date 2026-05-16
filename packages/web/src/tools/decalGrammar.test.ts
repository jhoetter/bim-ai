import { describe, it, expect } from 'vitest';
import { initialDecalState, reduceDecal, type DecalState, type DecalEvent } from './toolGrammar';

const POS = { xMm: 1000, yMm: 2000, zMm: 3000 };
const NORMAL = { x: 0, y: 1, z: 0 };

describe('reduceDecal', () => {
  it('starts in idle phase', () => {
    const state = initialDecalState();
    expect(state.phase).toBe('idle');
    expect(state.positionMm).toBeNull();
    expect(state.normalVec).toBeNull();
  });

  it('face-click in idle → picking-image with correct positionMm and normalVec', () => {
    const state = initialDecalState();
    const ev: DecalEvent = { kind: 'face-click', positionMm: POS, normalVec: NORMAL };
    const { state: next, effect } = reduceDecal(state, ev);
    expect(next.phase).toBe('picking-image');
    expect(next.positionMm).toEqual(POS);
    expect(next.normalVec).toEqual(NORMAL);
    expect(effect.stillActive).toBe(true);
    expect(effect.createDecal).toBeUndefined();
  });

  it('image-chosen in picking-image → createDecal effect with normalVec', () => {
    const picking: DecalState = { phase: 'picking-image', positionMm: POS, normalVec: NORMAL };
    const ev: DecalEvent = { kind: 'image-chosen', imageSrc: '/img/logo.png' };
    const { state: next, effect } = reduceDecal(picking, ev);
    expect(next.phase).toBe('idle');
    expect(effect.createDecal).toBeDefined();
    expect(effect.createDecal?.normalVec).toEqual(NORMAL);
    expect(effect.createDecal?.positionMm).toEqual(POS);
    expect(effect.createDecal?.imageSrc).toBe('/img/logo.png');
    expect(effect.createDecal?.widthMm).toBe(1000);
    expect(effect.createDecal?.heightMm).toBe(1000);
  });

  it('cancel in picking-image → idle, stillActive false', () => {
    const picking: DecalState = { phase: 'picking-image', positionMm: POS, normalVec: NORMAL };
    const { state: next, effect } = reduceDecal(picking, { kind: 'cancel' });
    expect(next.phase).toBe('idle');
    expect(effect.stillActive).toBe(false);
  });

  it('face-click in picking-image is a no-op', () => {
    const picking: DecalState = { phase: 'picking-image', positionMm: POS, normalVec: NORMAL };
    const ev: DecalEvent = {
      kind: 'face-click',
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      normalVec: { x: 1, y: 0, z: 0 },
    };
    const { state: next } = reduceDecal(picking, ev);
    expect(next.phase).toBe('picking-image');
    expect(next.positionMm).toEqual(POS);
  });

  it('deactivate resets to idle', () => {
    const picking: DecalState = { phase: 'picking-image', positionMm: POS, normalVec: NORMAL };
    const { state: next, effect } = reduceDecal(picking, { kind: 'deactivate' });
    expect(next.phase).toBe('idle');
    expect(effect.stillActive).toBe(false);
  });
});
