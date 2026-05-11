import { describe, expect, it } from 'vitest';

import { paletteToolAllowlistForPerspective } from './planToolsByPerspective';

describe('paletteToolAllowlistForPerspective', () => {
  it('applies perspective filtering only to plan execution surfaces', () => {
    expect(paletteToolAllowlistForPerspective('plan', 'structure')?.has('door')).toBe(false);
    expect(paletteToolAllowlistForPerspective('plan-3d', 'structure')?.has('door')).toBe(false);
    expect(paletteToolAllowlistForPerspective('3d', 'structure')).toBeUndefined();
    expect(paletteToolAllowlistForPerspective('section', 'structure')).toBeUndefined();
  });

  it('does not hide 3D-capable palette tools through the legacy plan filter', () => {
    expect(paletteToolAllowlistForPerspective('3d', 'architecture')).toBeUndefined();
  });
});
