import { describe, expect, it } from 'vitest';
import { evaluateFormula, evaluateFormulaOrThrow, validateFormula } from './expressionEvaluator';

describe('evaluateFormula — arithmetic', () => {
  it('handles + - * / and parens', () => {
    expect(evaluateFormula('2400 + 200')).toBe(2600);
    expect(evaluateFormula('(100 + 50) * 2')).toBe(300);
    expect(evaluateFormula('1500 / 2')).toBe(750);
    expect(evaluateFormula('10 - 3')).toBe(7);
  });

  it('handles power and unary minus', () => {
    expect(evaluateFormula('2 ** 8')).toBe(256);
    expect(evaluateFormula('-5 + 10')).toBe(5);
    expect(evaluateFormula('--7')).toBe(7);
  });

  it('handles infix mod and mod() function', () => {
    expect(evaluateFormula('17 mod 5')).toBe(2);
    expect(evaluateFormula('mod(17, 5)')).toBe(2);
    expect(evaluateFormula('17 % 5')).toBe(2);
  });
});

describe('evaluateFormula — functions', () => {
  it('rounddown / roundup / round', () => {
    expect(evaluateFormula('rounddown(3.7)')).toBe(3);
    expect(evaluateFormula('roundup(3.2)')).toBe(4);
    expect(evaluateFormula('round(3.5)')).toBe(4);
    expect(evaluateFormula('round(3.4)')).toBe(3);
  });

  it('min / max / abs / sqrt', () => {
    expect(evaluateFormula('min(5, 2, 8)')).toBe(2);
    expect(evaluateFormula('max(5, 2, 8)')).toBe(8);
    expect(evaluateFormula('abs(-7)')).toBe(7);
    expect(evaluateFormula('sqrt(81)')).toBe(9);
  });

  it('if returns the then-branch when cond truthy', () => {
    expect(evaluateFormula('if(1, 100, 200)')).toBe(100);
    expect(evaluateFormula('if(0, 100, 200)')).toBe(200);
  });
});

describe('evaluateFormula — boolean coercion (Revit-compatible)', () => {
  it('comparison ops return 1 / 0', () => {
    expect(evaluateFormula('5 < 10')).toBe(1);
    expect(evaluateFormula('5 > 10')).toBe(0);
    expect(evaluateFormula('5 <= 5')).toBe(1);
    expect(evaluateFormula('5 >= 6')).toBe(0);
    expect(evaluateFormula('5 = 5')).toBe(1);
    expect(evaluateFormula('5 <> 6')).toBe(1);
  });

  it('not / and / or', () => {
    expect(evaluateFormula('not(0)')).toBe(1);
    expect(evaluateFormula('not(1)')).toBe(0);
    expect(evaluateFormula('and(1, 1)')).toBe(1);
    expect(evaluateFormula('and(1, 0)')).toBe(0);
    expect(evaluateFormula('or(0, 0)')).toBe(0);
    expect(evaluateFormula('or(0, 1)')).toBe(1);
  });

  it('true / false constants behave as 1 / 0', () => {
    expect(evaluateFormula('if(true, 1, 2)')).toBe(1);
    expect(evaluateFormula('if(false, 1, 2)')).toBe(2);
  });
});

describe('evaluateFormula — parameter references', () => {
  it('reads named parameters', () => {
    expect(evaluateFormula('Width / 2', { Width: 1600 })).toBe(800);
    expect(evaluateFormula('Width + Frame', { Width: 1500, Frame: 100 })).toBe(1600);
  });

  it('returns null on unknown identifier', () => {
    expect(evaluateFormula('Unknown + 1')).toBeNull();
  });
});

describe('evaluateFormula — chair-array formula (FAM-04 acceptance)', () => {
  // Chair Count = if(Width < 1400, 1, rounddown((Width - 200) / (320 + 80)))
  const formula = 'if(Width < 1400, 1, rounddown((Width - 200) / (320 + 80)))';
  it.each([
    [1200, 1],
    [1400, 3],
    [1800, 4],
    [2200, 5],
    [2800, 6],
  ])('Width=%i → %i chairs', (width, expected) => {
    expect(evaluateFormula(formula, { Width: width })).toBe(expected);
  });

  it('matches the spec sweep 1200→2800 produces strictly non-decreasing counts', () => {
    let prev = -Infinity;
    for (let w = 1200; w <= 2800; w += 200) {
      const value = evaluateFormula(formula, { Width: w });
      expect(value).not.toBeNull();
      expect(value as number).toBeGreaterThanOrEqual(prev);
      prev = value as number;
    }
  });
});

describe('evaluateFormula — security', () => {
  it('rejects access to globals via identifiers', () => {
    expect(evaluateFormula('alert(1)')).toBeNull();
    expect(evaluateFormula('process.env')).toBeNull();
    expect(evaluateFormula('window.location')).toBeNull();
    expect(evaluateFormula('this.constructor')).toBeNull();
  });

  it('rejects empty / whitespace input', () => {
    expect(evaluateFormula('')).toBeNull();
    expect(evaluateFormula('   ')).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(evaluateFormula('1 +')).toBeNull();
    expect(evaluateFormula('(1 + 2')).toBeNull();
    expect(evaluateFormula('if(1, 2)')).toBeNull(); // wrong arity
  });
});

describe('evaluateFormulaOrThrow + validateFormula', () => {
  it('evaluateFormulaOrThrow throws on bad input', () => {
    expect(() => evaluateFormulaOrThrow('1 +')).toThrow();
    expect(evaluateFormulaOrThrow('1 + 2')).toBe(3);
  });

  it('validateFormula returns null on success', () => {
    expect(validateFormula('Width + 1', ['Width'])).toBeNull();
  });

  it('validateFormula returns the error string on failure', () => {
    const err = validateFormula('Width +', ['Width']);
    expect(err).toBeTruthy();
    expect(typeof err).toBe('string');
  });

  it('validateFormula reports unknown identifiers', () => {
    const err = validateFormula('Mystery + 1', []);
    expect(err).toContain('Mystery');
  });
});
