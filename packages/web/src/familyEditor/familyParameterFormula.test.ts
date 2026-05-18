import { describe, expect, it } from 'vitest';
import { evaluateFamilyParameterFormula } from '../plan/familyParameterEval';

describe('Family parameter formula evaluation — §15.1.2', () => {
  it('evaluates simple division formula', () => {
    const result = evaluateFamilyParameterFormula('Width / 2', { Width: 900 });
    expect(result).toBe(450);
  });

  it('evaluates multiplication formula', () => {
    const result = evaluateFamilyParameterFormula('Height * 0.6', { Height: 3000 });
    expect(result).toBeCloseTo(1800);
  });

  it('evaluates formula with two params', () => {
    const result = evaluateFamilyParameterFormula('Width + Depth', { Width: 600, Depth: 400 });
    expect(result).toBe(1000);
  });

  it('returns NaN for unknown param reference', () => {
    const result = evaluateFamilyParameterFormula('Unknown / 2', { Width: 900 });
    expect(isNaN(result)).toBe(true);
  });

  it('returns NaN for invalid formula', () => {
    const result = evaluateFamilyParameterFormula('Width; alert(1)', { Width: 900 });
    expect(isNaN(result)).toBe(true);
  });

  it('evaluates numeric literal formula', () => {
    const result = evaluateFamilyParameterFormula('100 + 50', {});
    expect(result).toBe(150);
  });
});
