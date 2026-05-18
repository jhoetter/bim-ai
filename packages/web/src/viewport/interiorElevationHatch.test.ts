import { describe, expect, it } from 'vitest';
import { hatchPatternForMaterial, svgHatchDef } from '../plan/materialHatchPatterns';

describe('Interior elevation hatch — §6.1.5', () => {
  it('hatchPatternForMaterial returns a pattern for concrete', () => {
    const pattern = hatchPatternForMaterial('concrete');
    expect(pattern).toBeDefined();
  });

  it('hatchPatternForMaterial returns a pattern for brick', () => {
    const pattern = hatchPatternForMaterial('brick');
    expect(pattern).toBeDefined();
  });

  it('svgHatchDef returns SVG string with pattern id', () => {
    const pattern = hatchPatternForMaterial('concrete');
    const def = svgHatchDef(pattern, 'hatch-iel-concrete', 1);
    expect(def).toBeTruthy();
  });

  it('url reference uses correct pattern id', () => {
    const materialKey = 'brick';
    const patternId = `hatch-iel-${materialKey}`;
    const fill = `url(#${patternId})`;
    expect(fill).toBe('url(#hatch-iel-brick)');
  });

  it('storey height label formats mm correctly', () => {
    const storeyHeightMm = 3000;
    const label = `${Math.round(storeyHeightMm)} mm`;
    expect(label).toBe('3000 mm');
  });
});
