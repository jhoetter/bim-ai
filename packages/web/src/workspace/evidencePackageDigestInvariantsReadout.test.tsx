import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

import {
  EvidencePackageDigestInvariantsReadout,
  parseEvidencePackageDigestInvariantsV1,
  type EvidencePackageDigestInvariantsWire,
} from './evidencePackageDigestInvariantsReadout';

const fixture = (): EvidencePackageDigestInvariantsWire => ({
  format: 'evidencePackageDigestInvariants_v1',
  digestIncludedTopLevelKeys: ['format', 'modelId', 'revision'],
  digestExcludedTopLevelKeys: [
    {
      key: 'generatedAt',
      rationale: 'Unstable timestamp',
      enforcementNote: 'Excluded automatically.',
    },
    {
      key: 'semanticDigestSha256',
      rationale: 'Self-referential digest',
      enforcementNote: 'Excluded automatically.',
    },
  ],
  unknownTopLevelKeys: [],
  advisoryFindings: [],
  evidencePackageDigestInvariantsDigestSha256:
    'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
});

const fixtureWithUnknown = (): EvidencePackageDigestInvariantsWire => ({
  ...fixture(),
  unknownTopLevelKeys: ['newKey_v99'],
  advisoryFindings: [
    {
      ruleId: 'evidence_package_unknown_top_level_key',
      severity: 'warning',
      keyName: 'newKey_v99',
      message: "Top-level key 'newKey_v99' is not registered.",
    },
  ],
});

describe('parseEvidencePackageDigestInvariantsV1', () => {
  it('parses valid fixture', () => {
    const result = parseEvidencePackageDigestInvariantsV1(fixture());
    expect(result).not.toBeNull();
    expect(result!.digestIncludedTopLevelKeys).toEqual(['format', 'modelId', 'revision']);
    expect(result!.digestExcludedTopLevelKeys).toHaveLength(2);
    expect(result!.unknownTopLevelKeys).toEqual([]);
    expect(result!.advisoryFindings).toEqual([]);
    expect(result!.evidencePackageDigestInvariantsDigestSha256).toHaveLength(64);
  });

  it('returns null on wrong format', () => {
    expect(parseEvidencePackageDigestInvariantsV1({ format: 'other' })).toBeNull();
  });

  it('returns null on missing digestIncludedTopLevelKeys', () => {
    const bad = { ...fixture(), digestIncludedTopLevelKeys: undefined };
    expect(parseEvidencePackageDigestInvariantsV1(bad)).toBeNull();
  });

  it('returns null on malformed excluded row', () => {
    const bad = { ...fixture(), digestExcludedTopLevelKeys: [{ noKey: true }] };
    expect(parseEvidencePackageDigestInvariantsV1(bad)).toBeNull();
  });

  it('parses fixture with unknown keys', () => {
    const result = parseEvidencePackageDigestInvariantsV1(fixtureWithUnknown());
    expect(result).not.toBeNull();
    expect(result!.unknownTopLevelKeys).toEqual(['newKey_v99']);
    expect(result!.advisoryFindings[0]?.ruleId).toBe('evidence_package_unknown_top_level_key');
    expect(result!.advisoryFindings[0]?.keyName).toBe('newKey_v99');
  });
});

describe('EvidencePackageDigestInvariantsReadout', () => {
  it('renders testid and key counts', () => {
    render(<EvidencePackageDigestInvariantsReadout invariants={fixture()} />);
    expect(screen.getByTestId('evidence-package-digest-invariants-readout')).toBeTruthy();
    expect(screen.getByText(/included keys/)).toBeTruthy();
    expect(screen.getByText(/invariants digest/)).toBeTruthy();
  });

  it('shows included count, excluded count, zero unknowns', () => {
    render(<EvidencePackageDigestInvariantsReadout invariants={fixture()} />);
    const text = screen.getByTestId('evidence-package-digest-invariants-readout').textContent ?? '';
    expect(text).toContain('3'); // includedCount
    expect(text).toContain('2'); // excludedCount
    expect(text).toContain('0'); // unknownCount
  });

  it('shows advisory section when unknown keys present', () => {
    render(<EvidencePackageDigestInvariantsReadout invariants={fixtureWithUnknown()} />);
    expect(screen.getByText(/unknown top-level keys/i)).toBeTruthy();
    expect(screen.getByText('newKey_v99')).toBeTruthy();
  });

  it('does not render advisory section when no unknown keys', () => {
    render(<EvidencePackageDigestInvariantsReadout invariants={fixture()} />);
    expect(screen.queryByText(/unknown top-level keys/i)).toBeNull();
  });

  it('renders null when invariants is null', () => {
    const { container } = render(<EvidencePackageDigestInvariantsReadout invariants={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('digest tail appears in rendered output', () => {
    render(<EvidencePackageDigestInvariantsReadout invariants={fixture()} />);
    const tail = fixture().evidencePackageDigestInvariantsDigestSha256.slice(-12);
    expect(screen.getByText(`…${tail}`)).toBeTruthy();
  });

  it('excluded keys appear in correct order', () => {
    const inv = parseEvidencePackageDigestInvariantsV1(fixture())!;
    expect(inv.digestExcludedTopLevelKeys[0]?.key).toBe('generatedAt');
    expect(inv.digestExcludedTopLevelKeys[1]?.key).toBe('semanticDigestSha256');
  });
});
