// Issue #113 — pin that `structural_facade_grid` (Huf-Haus Pfosten-Riegel)
// elements survive coercion with every required field intact across
// snake_case and camelCase wire formats.

import { describe, expect, it } from 'vitest';

import { coerceElement } from './storeCoercion';

describe('issue #113 — structural_facade_grid coercion contract', () => {
  it('coerces snake_case and camelCase payloads identically', () => {
    const snake = coerceElement('grid-snake', {
      kind: 'structural_facade_grid',
      host_wall_id: 'wall-south',
      post_spacing_mm: 1500,
      beam_heights: [1500, 2400],
      diagonal_strut_pattern: 'single',
      member_thickness_mm: 80,
      proud_offset_mm: 30,
      timber_material_key: 'dark_oak',
      infill_material_key: 'glass_clear',
      level_id: 'lvl-1',
    });
    const camel = coerceElement('grid-camel', {
      kind: 'structural_facade_grid',
      hostWallId: 'wall-south',
      postSpacingMm: 1500,
      beamHeights: [1500, 2400],
      diagonalStrutPattern: 'single',
      memberThicknessMm: 80,
      proudOffsetMm: 30,
      timberMaterialKey: 'dark_oak',
      infillMaterialKey: 'glass_clear',
      levelId: 'lvl-1',
    });

    expect(snake).not.toBeNull();
    expect(camel).not.toBeNull();
    if (!snake || snake.kind !== 'structural_facade_grid') {
      throw new Error('snake coercion bad');
    }
    if (!camel || camel.kind !== 'structural_facade_grid') {
      throw new Error('camel coercion bad');
    }

    expect(snake.hostWallId).toBe('wall-south');
    expect(camel.hostWallId).toBe('wall-south');
    expect(snake.postSpacingMm).toBe(1500);
    expect(camel.postSpacingMm).toBe(1500);
    expect(snake.beamHeights).toEqual([1500, 2400]);
    expect(camel.beamHeights).toEqual([1500, 2400]);
    expect(snake.diagonalStrutPattern).toBe('single');
    expect(camel.diagonalStrutPattern).toBe('single');
    expect(snake.memberThicknessMm).toBe(80);
    expect(camel.memberThicknessMm).toBe(80);
    expect(snake.proudOffsetMm).toBe(30);
    expect(camel.proudOffsetMm).toBe(30);
    expect(snake.timberMaterialKey).toBe('dark_oak');
    expect(camel.timberMaterialKey).toBe('dark_oak');
    expect(snake.infillMaterialKey).toBe('glass_clear');
    expect(camel.infillMaterialKey).toBe('glass_clear');
    expect(snake.levelId).toBe('lvl-1');
    expect(camel.levelId).toBe('lvl-1');
  });

  it('preserves the kind discriminator so the renderer dispatch can match', () => {
    const el = coerceElement('grid-kind', {
      kind: 'structural_facade_grid',
      hostWallId: 'wall-x',
      postSpacingMm: 1500,
      beamHeights: [1500],
      diagonalStrutPattern: 'cross',
    });
    expect(el?.kind).toBe('structural_facade_grid');
  });

  it('falls back to single strut pattern for unknown strings', () => {
    const el = coerceElement('grid-unknown', {
      kind: 'structural_facade_grid',
      hostWallId: 'wall-x',
      postSpacingMm: 1500,
      beamHeights: [],
      diagonalStrutPattern: 'totally-bogus',
    });
    if (!el || el.kind !== 'structural_facade_grid') {
      throw new Error('unknown pattern coercion bad');
    }
    expect(el.diagonalStrutPattern).toBe('single');
  });

  it('keeps the grid valid with only the required fields', () => {
    const el = coerceElement('grid-min', {
      kind: 'structural_facade_grid',
      hostWallId: 'wall-x',
      postSpacingMm: 1500,
      beamHeights: [],
      diagonalStrutPattern: 'none',
    });
    expect(el).not.toBeNull();
    if (!el || el.kind !== 'structural_facade_grid') {
      throw new Error('minimal coercion bad');
    }
    expect(el.hostWallId).toBe('wall-x');
    expect(el.postSpacingMm).toBe(1500);
    expect(el.beamHeights).toEqual([]);
    expect(el.diagonalStrutPattern).toBe('none');
  });

  it('drops non-finite / negative beam heights from the list', () => {
    const el = coerceElement('grid-bad-beams', {
      kind: 'structural_facade_grid',
      hostWallId: 'wall-x',
      postSpacingMm: 1500,
      beamHeights: [1500, 'oops', NaN, -500, 2400],
      diagonalStrutPattern: 'single',
    });
    if (!el || el.kind !== 'structural_facade_grid') {
      throw new Error('beam filter coercion bad');
    }
    expect(el.beamHeights).toEqual([1500, 2400]);
  });
});
