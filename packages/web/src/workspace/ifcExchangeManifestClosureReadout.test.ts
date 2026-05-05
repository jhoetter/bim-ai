import { describe, expect, it } from 'vitest';

import {
  formatIfcExchangeManifestClosureLines,
  ifcExchangeManifestClosureHasDrift,
} from './ifcExchangeManifestClosureReadout';

describe('formatIfcExchangeManifestClosureLines', () => {
  it('returns empty array for nullish input', () => {
    expect(formatIfcExchangeManifestClosureLines(null)).toEqual([]);
    expect(formatIfcExchangeManifestClosureLines(undefined)).toEqual([]);
    expect(formatIfcExchangeManifestClosureLines(null)).toEqual([]);
  });

  it('renders all-aligned tokens correctly', () => {
    const lines = formatIfcExchangeManifestClosureLines({
      schemaVersion: 0,
      authoritativeProductsAlignmentToken: 'aligned',
      unsupportedClassAlignmentToken: 'aligned',
      idsPointerCoverageAlignmentToken: 'aligned',
      ifcExchangeManifestClosureDigestSha256: 'a'.repeat(64),
    });
    expect(lines.some((l) => l.includes('Authoritative products: aligned'))).toBe(true);
    expect(lines.some((l) => l.includes('Unsupported classes: aligned'))).toBe(true);
    expect(lines.some((l) => l.includes('IDS pointer coverage: aligned'))).toBe(true);
    expect(lines.some((l) => l.includes('Closure digest (tail):'))).toBe(true);
  });

  it('renders offline tokens with human-readable label', () => {
    const lines = formatIfcExchangeManifestClosureLines({
      authoritativeProductsAlignmentToken: 'unavailable_offline',
      unsupportedClassAlignmentToken: 'unavailable_offline',
      idsPointerCoverageAlignmentToken: 'unavailable_offline',
    });
    expect(lines.filter((l) => l.includes('unavailable (offline)')).length).toBe(3);
  });

  it('renders drift token labels', () => {
    const lines = formatIfcExchangeManifestClosureLines({
      authoritativeProductsAlignmentToken: 'replay_missing_products',
      unsupportedClassAlignmentToken: 'class_set_drift',
      idsPointerCoverageAlignmentToken: 'coverage_drift',
    });
    expect(lines.some((l) => l.includes('replay missing products'))).toBe(true);
    expect(lines.some((l) => l.includes('unsupported class set mismatch'))).toBe(true);
    expect(lines.some((l) => l.includes('IDS pointer coverage incomplete'))).toBe(true);
  });

  it('renders preview_missing_products token', () => {
    const lines = formatIfcExchangeManifestClosureLines({
      authoritativeProductsAlignmentToken: 'preview_missing_products',
      unsupportedClassAlignmentToken: 'aligned',
      idsPointerCoverageAlignmentToken: 'aligned',
    });
    expect(lines.some((l) => l.includes('preview missing products'))).toBe(true);
  });

  it('omits digest line when digest is absent or malformed', () => {
    const lines = formatIfcExchangeManifestClosureLines({
      authoritativeProductsAlignmentToken: 'aligned',
      unsupportedClassAlignmentToken: 'aligned',
      idsPointerCoverageAlignmentToken: 'aligned',
    });
    expect(lines.some((l) => l.includes('Closure digest'))).toBe(false);
  });

  it('shows last 12 chars of digest', () => {
    const digest = '0'.repeat(52) + 'abcdef012345';
    const lines = formatIfcExchangeManifestClosureLines({
      authoritativeProductsAlignmentToken: 'aligned',
      unsupportedClassAlignmentToken: 'aligned',
      idsPointerCoverageAlignmentToken: 'aligned',
      ifcExchangeManifestClosureDigestSha256: digest,
    });
    expect(lines.some((l) => l.includes('abcdef012345'))).toBe(true);
  });
});

describe('ifcExchangeManifestClosureHasDrift', () => {
  it('returns false for null/undefined', () => {
    expect(ifcExchangeManifestClosureHasDrift(null)).toBe(false);
    expect(ifcExchangeManifestClosureHasDrift(undefined)).toBe(false);
  });

  it('returns false when all tokens are aligned', () => {
    expect(
      ifcExchangeManifestClosureHasDrift({
        authoritativeProductsAlignmentToken: 'aligned',
        unsupportedClassAlignmentToken: 'aligned',
        idsPointerCoverageAlignmentToken: 'aligned',
      }),
    ).toBe(false);
  });

  it('returns false when all tokens are unavailable_offline', () => {
    expect(
      ifcExchangeManifestClosureHasDrift({
        authoritativeProductsAlignmentToken: 'unavailable_offline',
        unsupportedClassAlignmentToken: 'unavailable_offline',
        idsPointerCoverageAlignmentToken: 'unavailable_offline',
      }),
    ).toBe(false);
  });

  it('returns true when authoritativeProductsAlignmentToken is drift', () => {
    expect(
      ifcExchangeManifestClosureHasDrift({
        authoritativeProductsAlignmentToken: 'replay_missing_products',
        unsupportedClassAlignmentToken: 'aligned',
        idsPointerCoverageAlignmentToken: 'aligned',
      }),
    ).toBe(true);
  });

  it('returns true when unsupportedClassAlignmentToken is drift', () => {
    expect(
      ifcExchangeManifestClosureHasDrift({
        authoritativeProductsAlignmentToken: 'aligned',
        unsupportedClassAlignmentToken: 'class_set_drift',
        idsPointerCoverageAlignmentToken: 'aligned',
      }),
    ).toBe(true);
  });

  it('returns true when idsPointerCoverageAlignmentToken is drift', () => {
    expect(
      ifcExchangeManifestClosureHasDrift({
        authoritativeProductsAlignmentToken: 'aligned',
        unsupportedClassAlignmentToken: 'aligned',
        idsPointerCoverageAlignmentToken: 'coverage_drift',
      }),
    ).toBe(true);
  });
});
