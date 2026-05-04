import { describe, expect, it } from 'vitest';

import { deterministicSchemeColorHex, sha256Utf8 } from './roomSchemeColor';

/** Matches `hashlib.sha256(seed.encode()).hexdigest()` (Python). */
describe('roomSchemeColor', () => {
  it('matches Python _deterministic_scheme_color_hex for sample seeds', () => {
    expect(deterministicSchemeColorHex('OFF')).toBe('#38cca6');
    expect(deterministicSchemeColorHex('rm-b')).toBe('#cb1e5e');
  });

  it('full digest matches Python for OFF', () => {
    expect(sha256Utf8('OFF')).toBe(
      '38cca6bea010af8adaf4be7d270456fa9adef8c0252db91f2767c607d077319b',
    );
  });
});
