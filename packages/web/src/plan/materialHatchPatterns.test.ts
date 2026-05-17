import { describe, expect, it } from 'vitest';

import { hatchPatternForMaterial, svgHatchDef } from './materialHatchPatterns';

describe('materialHatchPatterns — §6.1.6', () => {
  it('concrete materialKey returns concrete pattern', () => {
    expect(hatchPatternForMaterial('concrete')).toBe('concrete');
    expect(hatchPatternForMaterial('Concrete Structure')).toBe('concrete');
    expect(hatchPatternForMaterial('Beton C25')).toBe('concrete');
  });

  it('Holz (German wood) maps to wood', () => {
    expect(hatchPatternForMaterial('Holz')).toBe('wood');
    expect(hatchPatternForMaterial('wood panel')).toBe('wood');
    expect(hatchPatternForMaterial('timber frame')).toBe('wood');
  });

  it('unknown material returns solid', () => {
    expect(hatchPatternForMaterial('unknown-material-xyz')).toBe('solid');
    expect(hatchPatternForMaterial('')).toBe('solid');
    expect(hatchPatternForMaterial(null)).toBe('solid');
    expect(hatchPatternForMaterial(undefined)).toBe('solid');
  });

  it('svgHatchDef returns a string containing the pattern id', () => {
    const result = svgHatchDef('concrete', 'my-pattern-id');
    expect(result).toContain('id="my-pattern-id"');
    expect(typeof result).toBe('string');
  });

  it('svgHatchDef concrete has two crossing lines', () => {
    const result = svgHatchDef('concrete', 'test-concrete');
    const lineMatches = result.match(/<line /g);
    expect(lineMatches).not.toBeNull();
    expect(lineMatches!.length).toBe(2);
  });

  it('svgHatchDef insulation has polyline', () => {
    const result = svgHatchDef('insulation', 'test-insulation');
    expect(result).toContain('<polyline');
  });

  it('brick pattern returns rect and lines', () => {
    const result = svgHatchDef('brick', 'test-brick');
    expect(result).toContain('<rect');
    expect(result).toContain('id="test-brick"');
  });

  it('glass pattern returns circle element', () => {
    const result = svgHatchDef('glass', 'test-glass');
    expect(result).toContain('<circle');
  });

  it('metal pattern returns diagonal line', () => {
    const result = svgHatchDef('metal', 'test-metal');
    expect(result).toContain('<line');
    expect(result).toContain('#666');
  });

  it('earth pattern includes horizontal line and dot', () => {
    const result = svgHatchDef('earth', 'test-earth');
    expect(result).toContain('<line');
    expect(result).toContain('<circle');
  });

  it('solid/default returns a fallback rect pattern', () => {
    const result = svgHatchDef('solid', 'test-solid');
    expect(result).toContain('id="test-solid"');
    expect(result).toContain('<rect');
  });

  it('svgHatchDef respects scale parameter', () => {
    const result1 = svgHatchDef('concrete', 'p1', 1);
    const result2 = svgHatchDef('concrete', 'p2', 2);
    expect(result2).toContain('width="16"');
    expect(result1).toContain('width="8"');
  });

  it('brick materialKey variants map to brick', () => {
    expect(hatchPatternForMaterial('brick wall')).toBe('brick');
    expect(hatchPatternForMaterial('Ziegel')).toBe('brick');
    expect(hatchPatternForMaterial('Mauerwerk')).toBe('brick');
  });

  it('insulation variants map to insulation', () => {
    expect(hatchPatternForMaterial('insulation board')).toBe('insulation');
    expect(hatchPatternForMaterial('Dämmung')).toBe('insulation');
    expect(hatchPatternForMaterial('styrofoam')).toBe('insulation');
  });

  it('steel/metal variants map to metal', () => {
    expect(hatchPatternForMaterial('steel beam')).toBe('metal');
    expect(hatchPatternForMaterial('Stahl S355')).toBe('metal');
    expect(hatchPatternForMaterial('metal sheet')).toBe('metal');
  });

  it('earth/soil variants map to earth', () => {
    expect(hatchPatternForMaterial('earth fill')).toBe('earth');
    expect(hatchPatternForMaterial('Boden')).toBe('earth');
    expect(hatchPatternForMaterial('soil layer')).toBe('earth');
  });

  it('glass variants map to glass', () => {
    expect(hatchPatternForMaterial('glass panel')).toBe('glass');
    expect(hatchPatternForMaterial('Glas')).toBe('glass');
  });
});
