import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  EvidenceBaselineLifecycleReadoutV1Table,
  parseEvidenceBaselineLifecycleReadoutV1,
  type EvidenceBaselineLifecycleReadoutWire,
} from './evidenceBaselineLifecycleReadout';

const fixture = (): EvidenceBaselineLifecycleReadoutWire => ({
  format: 'evidenceBaselineLifecycleReadout_v1',
  expectedBaselineIds: ['a.png'],
  ingestTargetCount: 1,
  rollupDigestCorrelationStatus: 'aligned',
  rollupSuggestedNextAction: 'accept_baseline',
  rollupCiGateHint: 'performance_gate_gateClosed=true;blocker_codes_echo=none',
  fixLoopBlockerCodes: [],
  gateClosed: true,
  rows: [
    {
      baselinePngBasename: 'a.png',
      expectedDiffBasename: 'a-diff.png',
      committedFixtureStatus: 'present',
      digestCorrelationStatus: 'aligned',
      suggestedNextAction: 'accept_baseline',
      ciGateHint: 'performance_gate_gateClosed=true;blocker_codes_echo=none',
    },
  ],
});

describe('parseEvidenceBaselineLifecycleReadoutV1', () => {
  it('parses fixture', () => {
    const p = parseEvidenceBaselineLifecycleReadoutV1(fixture());
    expect(p).not.toBeNull();
    expect(p!.ingestTargetCount).toBe(1);
    expect(p!.rows[0]?.baselinePngBasename).toBe('a.png');
  });

  it('returns null on bad rows', () => {
    expect(
      parseEvidenceBaselineLifecycleReadoutV1({
        format: 'evidenceBaselineLifecycleReadout_v1',
        expectedBaselineIds: [],
        ingestTargetCount: 0,
        rollupDigestCorrelationStatus: 'not_applicable',
        rollupSuggestedNextAction: 'noop',
        rollupCiGateHint: 'x',
        fixLoopBlockerCodes: [],
        gateClosed: true,
        rows: [{}],
      }),
    ).toBeNull();
  });
});

describe('EvidenceBaselineLifecycleReadoutV1Table', () => {
  it('renders table and test id', () => {
    render(<EvidenceBaselineLifecycleReadoutV1Table readout={fixture()} />);
    expect(screen.getByTestId('evidence-baseline-lifecycle-readout')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /baseline/i })).toBeTruthy();
    expect(screen.getByText('a.png')).toBeTruthy();
    expect(screen.getAllByText(/accept_baseline/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty-target placeholder row', () => {
    const empty: EvidenceBaselineLifecycleReadoutWire = {
      ...fixture(),
      ingestTargetCount: 0,
      expectedBaselineIds: [],
      rows: [],
      rollupDigestCorrelationStatus: 'not_applicable',
      rollupSuggestedNextAction: 'noop_no_baseline_targets',
    };
    render(<EvidenceBaselineLifecycleReadoutV1Table readout={empty} />);
    expect(screen.getByText(/No ingest checklist targets/)).toBeTruthy();
  });

  it('renders stagedUploadEligibilityNote when present', () => {
    const withNote: EvidenceBaselineLifecycleReadoutWire = {
      ...fixture(),
      stagedUploadEligibilityNote:
        'Staged upload is not performed by this API. No baselines are committed automatically.',
    };
    render(<EvidenceBaselineLifecycleReadoutV1Table readout={withNote} />);
    expect(screen.getByText(/Staged upload is not performed/)).toBeTruthy();
  });
});

describe('parseEvidenceBaselineLifecycleReadoutV1 — staged upload note', () => {
  it('passes through stagedUploadEligibilityNote when present', () => {
    const raw = {
      ...fixture(),
      stagedUploadEligibilityNote: 'Staged upload is not performed by this API.',
    };
    const p = parseEvidenceBaselineLifecycleReadoutV1(raw);
    expect(p).not.toBeNull();
    expect(p!.stagedUploadEligibilityNote).toBe('Staged upload is not performed by this API.');
  });

  it('stagedUploadEligibilityNote is undefined when absent', () => {
    const p = parseEvidenceBaselineLifecycleReadoutV1(fixture());
    expect(p).not.toBeNull();
    expect(p!.stagedUploadEligibilityNote).toBeUndefined();
  });
});
