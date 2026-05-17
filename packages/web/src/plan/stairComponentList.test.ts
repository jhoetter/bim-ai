import { describe, expect, it } from 'vitest';
import { getStairComponents } from './stairComponentList';

const elementsById: any = {
  s1: { id: 's1', kind: 'stair', levelId: 'L1' },
  sr1: {
    id: 'sr1',
    kind: 'stair_run',
    parentStairId: 's1',
    riserCount: 10,
    runWidthMm: 1200,
    startMm: { xMm: 0, yMm: 0 },
    endMm: { xMm: 0, yMm: 3000 },
  },
  sr2: {
    id: 'sr2',
    kind: 'stair_run',
    parentStairId: 's1',
    riserCount: 8,
    runWidthMm: 1000,
    startMm: { xMm: 0, yMm: 3500 },
    endMm: { xMm: 0, yMm: 6000 },
  },
  sl1: {
    id: 'sl1',
    kind: 'stair_landing',
    parentStairId: 's1',
    depthMm: 1200,
    widthMm: 1200,
    positionMm: { xMm: 0, yMm: 3000 },
  },
  sr3: {
    id: 'sr3',
    kind: 'stair_run',
    parentStairId: 's2',
    riserCount: 5,
    runWidthMm: 900,
    startMm: { xMm: 0, yMm: 0 },
    endMm: { xMm: 0, yMm: 1500 },
  },
};

describe('getStairComponents — §8.6.2', () => {
  it('returns runs belonging to stairId', () => {
    const { runs } = getStairComponents('s1', elementsById);
    expect(runs).toHaveLength(2);
    expect(runs.map((r) => r.id)).toContain('sr1');
    expect(runs.map((r) => r.id)).toContain('sr2');
  });

  it('returns landings belonging to stairId', () => {
    const { landings } = getStairComponents('s1', elementsById);
    expect(landings).toHaveLength(1);
    expect(landings[0].id).toBe('sl1');
  });

  it('excludes components from other stairs', () => {
    const { runs } = getStairComponents('s1', elementsById);
    expect(runs.map((r) => r.id)).not.toContain('sr3');
  });

  it('returns empty arrays for stair with no components', () => {
    const { runs, landings } = getStairComponents('nonexistent', elementsById);
    expect(runs).toHaveLength(0);
    expect(landings).toHaveLength(0);
  });

  it('handles empty elementsById', () => {
    const { runs, landings } = getStairComponents('s1', {});
    expect(runs).toHaveLength(0);
    expect(landings).toHaveLength(0);
  });
});
