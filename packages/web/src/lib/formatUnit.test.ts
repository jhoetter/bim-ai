import { describe, it, expect } from 'vitest';
import { formatLength, formatArea } from './formatUnit';
import type { ProjectUnits } from './formatUnit';

const defaultUnits: ProjectUnits = {
  lengthUnit: 'mm',
  areaUnit: 'm2',
  decimalSymbol: '.',
};

describe('formatLength', () => {
  it('formats mm correctly', () => {
    const units: ProjectUnits = { ...defaultUnits, lengthUnit: 'mm' };
    expect(formatLength(3500, units)).toBe('3500 mm');
  });

  it('formats m with decimal point', () => {
    const units: ProjectUnits = { ...defaultUnits, lengthUnit: 'm', decimalSymbol: '.' };
    expect(formatLength(3500, units)).toBe('3.50 m');
  });

  it('formats m with decimal comma', () => {
    const units: ProjectUnits = { ...defaultUnits, lengthUnit: 'm', decimalSymbol: ',' };
    expect(formatLength(3500, units)).toBe('3,50 m');
  });

  it('formats ft-in: exactly 1 foot (304.8 mm)', () => {
    const units: ProjectUnits = { ...defaultUnits, lengthUnit: 'ft-in' };
    expect(formatLength(304.8, units)).toBe(`1'-0"`);
  });

  it('formats ft-in: 1 foot + half inch (317.5 mm)', () => {
    // 317.5 mm = 1 foot + 0.5 inch = 1'-0 1/2"
    const units: ProjectUnits = { ...defaultUnits, lengthUnit: 'ft-in' };
    expect(formatLength(317.5, units)).toBe(`1'-0 1/2"`);
  });

  it('formats cm correctly', () => {
    const units: ProjectUnits = { ...defaultUnits, lengthUnit: 'cm' };
    expect(formatLength(3500, units)).toBe('350.0 cm');
  });

  it('formats ft correctly', () => {
    const units: ProjectUnits = { ...defaultUnits, lengthUnit: 'ft' };
    // 3500 / 304.8 ≈ 11.48
    const result = formatLength(3500, units);
    expect(result).toBe('11.48 ft');
  });

  it('formats in correctly', () => {
    const units: ProjectUnits = { ...defaultUnits, lengthUnit: 'in' };
    // 3500 / 25.4 ≈ 137.8
    const result = formatLength(3500, units);
    expect(result).toBe('137.8 in');
  });
});

describe('formatArea', () => {
  it('formats m2 correctly', () => {
    const units: ProjectUnits = { ...defaultUnits, areaUnit: 'm2' };
    expect(formatArea(1_000_000, units)).toBe('1.00 m²');
  });

  it('formats ft2 correctly', () => {
    const units: ProjectUnits = { ...defaultUnits, areaUnit: 'ft2' };
    // 1_000_000 mm² = 1 m² ≈ 10.764 ft²
    const result = formatArea(1_000_000, units);
    expect(result).toBe('10.76 ft²');
  });
});
