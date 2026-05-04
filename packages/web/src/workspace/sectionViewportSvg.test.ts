import { describe, expect, it } from 'vitest';

import { formatSectionElevationSpanMmLabel } from './sectionViewportDoc';

describe('Section viewport documentation helpers', () => {
  it('formats elevation span metres with two decimals', () => {
    expect(formatSectionElevationSpanMmLabel(0, 3200)).toBe('Δz 3.20 m');
    expect(formatSectionElevationSpanMmLabel(300, 9700)).toBe('Δz 9.40 m');
  });

  it('uses absolute separation when min and max reversed', () => {
    expect(formatSectionElevationSpanMmLabel(9700, 300)).toBe('Δz 9.40 m');
  });
});
