// Issue #64 — MF-render-7: pin that balcony elements survive coercion with
// every required field intact. Without this guard, a regression in the
// coercion path could silently drop `wallId`/`elevationMm` and the mesh
// builder would render nothing.

import { describe, expect, it } from 'vitest';

import { coerceElement } from './storeCoercion';

describe('issue #64 — balcony coercion contract', () => {
  it('coerces snake_case + camelCase balcony payloads identically', () => {
    const snake = coerceElement('balcony-snake', {
      kind: 'balcony',
      wall_id: 'wall-1',
      elevation_mm: 3000,
      projection_mm: 1500,
      slab_thickness_mm: 220,
      balustrade_height_mm: 1100,
    });
    const camel = coerceElement('balcony-camel', {
      kind: 'balcony',
      wallId: 'wall-1',
      elevationMm: 3000,
      projectionMm: 1500,
      slabThicknessMm: 220,
      balustradeHeightMm: 1100,
    });

    expect(snake).not.toBeNull();
    expect(camel).not.toBeNull();
    if (!snake || snake.kind !== 'balcony') throw new Error('snake coercion bad');
    if (!camel || camel.kind !== 'balcony') throw new Error('camel coercion bad');

    expect(snake.wallId).toBe('wall-1');
    expect(camel.wallId).toBe('wall-1');
    expect(snake.elevationMm).toBe(3000);
    expect(camel.elevationMm).toBe(3000);
    expect(snake.projectionMm).toBe(1500);
    expect(camel.projectionMm).toBe(1500);
    expect(snake.slabThicknessMm).toBe(220);
    expect(camel.slabThicknessMm).toBe(220);
    expect(snake.balustradeHeightMm).toBe(1100);
    expect(camel.balustradeHeightMm).toBe(1100);
  });

  it('preserves the kind discriminator so the renderer dispatch matches', () => {
    const el = coerceElement('balcony-x', {
      kind: 'balcony',
      wallId: 'wall-x',
      elevationMm: 2800,
    });
    expect(el?.kind).toBe('balcony');
  });

  it('keeps minimal balcony payload (only wallId + elevationMm)', () => {
    const el = coerceElement('balcony-minimal', {
      kind: 'balcony',
      wallId: 'wall-y',
      elevationMm: 0,
    });
    expect(el).not.toBeNull();
    if (!el || el.kind !== 'balcony') throw new Error('minimal coercion bad');
    expect(el.wallId).toBe('wall-y');
    expect(el.elevationMm).toBe(0);
  });
});
