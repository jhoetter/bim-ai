import { describe, expect, it } from 'vitest';
import { stackDimensions } from './stackDimensions';

function makeDim(id: string, isVertical: boolean, offsetMm: number): any {
  return { kind: 'permanent_dimension', id, isVertical, offsetMm };
}

describe('stackDimensions — §4.2.6', () => {
  it('returns empty map for empty input', () => {
    expect(stackDimensions([])).toEqual(new Map());
  });

  it('assigns first dim to spacing offset', () => {
    const dims = [makeDim('d1', false, 10)];
    const result = stackDimensions(dims, 7);
    expect(result.get('d1')).toBe(7);
  });

  it('assigns two dims at 7mm and 14mm', () => {
    const dims = [makeDim('d1', false, 5), makeDim('d2', false, 15)];
    const result = stackDimensions(dims, 7);
    const offsets = [...result.values()].sort((a, b) => a - b);
    expect(offsets).toEqual([7, 14]);
  });

  it('stacks vertical and horizontal dims independently', () => {
    const dims = [makeDim('v1', true, 5), makeDim('v2', true, 10), makeDim('h1', false, 5)];
    const result = stackDimensions(dims, 7);
    const vertOffsets = [result.get('v1'), result.get('v2')].sort((a, b) => a! - b!);
    expect(vertOffsets).toEqual([7, 14]);
    expect(result.get('h1')).toBe(7);
  });

  it('uses custom spacing', () => {
    const dims = [makeDim('d1', false, 5), makeDim('d2', false, 8)];
    const result = stackDimensions(dims, 10);
    const offsets = [...result.values()].sort((a, b) => a - b);
    expect(offsets).toEqual([10, 20]);
  });

  it('StackDimensionsCmd has correct shape', () => {
    const cmd = { type: 'stackDimensions' as const, spacingMm: 8 };
    expect(cmd.type).toBe('stackDimensions');
    expect(cmd.spacingMm).toBe(8);
  });
});
