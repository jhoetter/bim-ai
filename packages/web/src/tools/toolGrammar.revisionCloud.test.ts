import { describe, it, expect } from 'vitest';
import { initialRevisionCloudState, reduceRevisionCloud } from './toolGrammar';

const PT = (x: number, y: number) => ({ xMm: x, yMm: y });

describe('reduceRevisionCloud', () => {
  it('starts with no points', () => {
    expect(initialRevisionCloudState().pointsMm).toHaveLength(0);
  });

  it('3 clicks + commit emits createRevisionCloud with those 3 points', () => {
    let s = initialRevisionCloudState();
    ({ state: s } = reduceRevisionCloud(s, { kind: 'click', pointMm: PT(0, 0) }));
    ({ state: s } = reduceRevisionCloud(s, { kind: 'click', pointMm: PT(1000, 0) }));
    ({ state: s } = reduceRevisionCloud(s, { kind: 'click', pointMm: PT(1000, 1000) }));
    const { state: final, effect } = reduceRevisionCloud(s, { kind: 'commit' });
    expect(effect.commitPointsMm).toHaveLength(3);
    expect(effect.commitPointsMm![0]).toEqual(PT(0, 0));
    expect(effect.commitPointsMm![2]).toEqual(PT(1000, 1000));
    expect(final.pointsMm).toHaveLength(0);
  });

  it('commit with fewer than 2 points produces no effect and resets state', () => {
    let s = initialRevisionCloudState();
    ({ state: s } = reduceRevisionCloud(s, { kind: 'click', pointMm: PT(0, 0) }));
    const { state: final, effect } = reduceRevisionCloud(s, { kind: 'commit' });
    expect(effect.commitPointsMm).toBeUndefined();
    expect(final.pointsMm).toHaveLength(0);
  });

  it('cancel after adding points resets to idle with no effect', () => {
    let s = initialRevisionCloudState();
    ({ state: s } = reduceRevisionCloud(s, { kind: 'click', pointMm: PT(0, 0) }));
    ({ state: s } = reduceRevisionCloud(s, { kind: 'click', pointMm: PT(2000, 0) }));
    const { state: final, effect } = reduceRevisionCloud(s, { kind: 'cancel' });
    expect(effect.commitPointsMm).toBeUndefined();
    expect(final.pointsMm).toHaveLength(0);
  });

  it('duplicate click within 1mm tolerance is ignored', () => {
    let s = initialRevisionCloudState();
    ({ state: s } = reduceRevisionCloud(s, { kind: 'click', pointMm: PT(0, 0) }));
    ({ state: s } = reduceRevisionCloud(s, { kind: 'click', pointMm: PT(0.5, 0.5) }));
    expect(s.pointsMm).toHaveLength(1);
  });
});
