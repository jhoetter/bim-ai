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
});
