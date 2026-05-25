// Issue #102 — pin that facade_bay (Erker) elements survive coercion with
// every required field intact across snake_case and camelCase wire formats.

import { describe, expect, it } from 'vitest';

import { coerceElement } from './storeCoercion';

describe('issue #102 — facade_bay coercion contract', () => {
  it('coerces snake_case and camelCase facade_bay payloads identically', () => {
    const snake = coerceElement('bay-snake', {
      kind: 'facade_bay',
      host_wall_id: 'wall-1',
      start_along_wall_mm: 1500,
      end_along_wall_mm: 4500,
      projection_mm: 1000,
      shape: 'rectangular',
      level_id: 'lvl-1',
      material_key: 'erker-cladding',
    });
    const camel = coerceElement('bay-camel', {
      kind: 'facade_bay',
      hostWallId: 'wall-1',
      startAlongWallMm: 1500,
      endAlongWallMm: 4500,
      projectionMm: 1000,
      shape: 'rectangular',
      levelId: 'lvl-1',
      materialKey: 'erker-cladding',
    });

    expect(snake).not.toBeNull();
    expect(camel).not.toBeNull();
    if (!snake || snake.kind !== 'facade_bay') throw new Error('snake coercion bad');
    if (!camel || camel.kind !== 'facade_bay') throw new Error('camel coercion bad');

    expect(snake.hostWallId).toBe('wall-1');
    expect(camel.hostWallId).toBe('wall-1');
    expect(snake.startAlongWallMm).toBe(1500);
    expect(camel.startAlongWallMm).toBe(1500);
    expect(snake.endAlongWallMm).toBe(4500);
    expect(camel.endAlongWallMm).toBe(4500);
    expect(snake.projectionMm).toBe(1000);
    expect(camel.projectionMm).toBe(1000);
    expect(snake.shape).toBe('rectangular');
    expect(camel.shape).toBe('rectangular');
    expect(snake.levelId).toBe('lvl-1');
    expect(camel.levelId).toBe('lvl-1');
    expect(snake.materialKey).toBe('erker-cladding');
    expect(camel.materialKey).toBe('erker-cladding');
  });

  it('preserves the kind discriminator so the renderer dispatch can match', () => {
    const el = coerceElement('bay-kind', {
      kind: 'facade_bay',
      hostWallId: 'wall-x',
      startAlongWallMm: 0,
      endAlongWallMm: 2000,
      projectionMm: 800,
    });
    expect(el?.kind).toBe('facade_bay');
  });

  it('preserves chamferAngleDeg for chamfered bays', () => {
    const el = coerceElement('bay-cham', {
      kind: 'facade_bay',
      hostWallId: 'wall-x',
      startAlongWallMm: 0,
      endAlongWallMm: 2000,
      projectionMm: 900,
      shape: 'chamfered',
      chamferAngleDeg: 60,
    });
    if (!el || el.kind !== 'facade_bay') throw new Error('chamfered coercion bad');
    expect(el.shape).toBe('chamfered');
    expect(el.chamferAngleDeg).toBe(60);
  });

  it('falls back to rectangular shape for unknown shape strings', () => {
    const el = coerceElement('bay-unknown', {
      kind: 'facade_bay',
      hostWallId: 'wall-x',
      startAlongWallMm: 0,
      endAlongWallMm: 2000,
      projectionMm: 900,
      shape: 'weird-shape',
    });
    if (!el || el.kind !== 'facade_bay') throw new Error('unknown shape coercion bad');
    expect(el.shape).toBe('rectangular');
  });

  it('keeps the bay valid with only the required fields', () => {
    const el = coerceElement('bay-min', {
      kind: 'facade_bay',
      hostWallId: 'wall-x',
      startAlongWallMm: 0,
      endAlongWallMm: 1000,
      projectionMm: 800,
    });
    expect(el).not.toBeNull();
    if (!el || el.kind !== 'facade_bay') throw new Error('minimal coercion bad');
    expect(el.hostWallId).toBe('wall-x');
    expect(el.projectionMm).toBe(800);
    // Default shape inferred by coercion when shape key is absent.
    expect(el.shape).toBe('rectangular');
  });
});
