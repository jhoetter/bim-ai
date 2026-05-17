import { describe, expect, it } from 'vitest';
import { extractLevelData, buildLevelLineSvg } from './sectionLevelLines';

const elementsById: any = {
  l1: { id: 'l1', kind: 'level', name: 'EG', elevationMm: 0 },
  l2: { id: 'l2', kind: 'level', name: 'OG1', elevationMm: 3200 },
  l3: { id: 'l3', kind: 'level', name: 'OG2', elevationMm: 6400 },
  w1: { id: 'w1', kind: 'wall', levelId: 'l1' },
};

describe('sectionLevelLines — §6.1.6', () => {
  it('extracts levels from elementsById sorted by elevation', () => {
    const levels = extractLevelData(elementsById);
    expect(levels).toHaveLength(3);
    expect(levels[0].name).toBe('EG');
    expect(levels[2].elevationMm).toBe(6400);
  });

  it('excludes non-level elements', () => {
    const levels = extractLevelData(elementsById);
    expect(levels.every((l) => typeof l.elevationMm === 'number')).toBe(true);
  });

  it('returns empty array for no levels', () => {
    const levels = extractLevelData({ w1: { id: 'w1', kind: 'wall' } as any });
    expect(levels).toHaveLength(0);
  });

  it('buildLevelLineSvg produces line and text elements', () => {
    const levels = [
      { name: 'EG', elevationMm: 0 },
      { name: 'OG1', elevationMm: 3200 },
    ];
    const svg = buildLevelLineSvg(levels, 800, 0, 600, 0.1);
    expect(svg).toContain('<line');
    expect(svg).toContain('<text');
    expect(svg).toContain('EG');
    expect(svg).toContain('OG1');
  });

  it('buildLevelLineSvg uses dashed stroke', () => {
    const levels = [{ name: 'EG', elevationMm: 0 }];
    const svg = buildLevelLineSvg(levels, 800, 0, 600, 0.1);
    expect(svg).toContain('stroke-dasharray');
  });

  it('labels include elevation in meters', () => {
    const levels = [{ name: 'OG1', elevationMm: 3200 }];
    const svg = buildLevelLineSvg(levels, 800, 0, 600, 0.1);
    expect(svg).toContain('+3.20');
  });
});
