import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AgentBriefAcceptanceReadoutV1Table,
  formatAgentBriefAcceptanceReadoutLines,
  parseAgentBriefAcceptanceReadoutV1,
  type AgentBriefAcceptanceReadoutWire,
} from './agentBriefAcceptanceReadout';

const fixture = (): AgentBriefAcceptanceReadoutWire => ({
  format: 'agentBriefAcceptanceReadout_v1',
  schemaVersion: 1,
  rows: [
    {
      gateId: 'assumptions_linked_resolved',
      label: 'Assumptions linked and resolved',
      status: 'not_applicable',
      failureReasonCode: 'no_failure',
      requiredAction: '',
      sourceCommandIds: [],
      affectedWorkpackages: ['WP-F01'],
      expectedEvidenceArtifacts: [],
      validationCommandLabels: [],
    },
    {
      gateId: 'deviations_acknowledged',
      label: 'Deviations acknowledged',
      status: 'not_applicable',
      failureReasonCode: 'no_failure',
      requiredAction: '',
      sourceCommandIds: [],
      affectedWorkpackages: ['WP-F01'],
      expectedEvidenceArtifacts: [],
      validationCommandLabels: [],
    },
    {
      gateId: 'validation_commands_present',
      label: 'Validation commands present',
      status: 'pass',
      failureReasonCode: 'no_failure',
      requiredAction: '',
      sourceCommandIds: [],
      affectedWorkpackages: ['WP-F01'],
      expectedEvidenceArtifacts: [],
      validationCommandLabels: ['pytest_agent_brief_command_protocol'],
    },
    {
      gateId: 'tracker_rows_touched',
      label: 'Tracker rows touched',
      status: 'pass',
      failureReasonCode: 'no_failure',
      requiredAction: '',
      sourceCommandIds: [],
      affectedWorkpackages: ['WP-F01'],
      expectedEvidenceArtifacts: [],
      validationCommandLabels: [],
    },
    {
      gateId: 'evidence_artifacts_expected',
      label: 'Evidence artifacts expected',
      status: 'pass',
      failureReasonCode: 'no_failure',
      requiredAction: '',
      sourceCommandIds: [],
      affectedWorkpackages: ['WP-F01'],
      expectedEvidenceArtifacts: ['a.png'],
      validationCommandLabels: [],
    },
    {
      gateId: 'failure_reason_codes',
      label: 'Failure reason codes',
      status: 'pass',
      failureReasonCode: 'no_failure',
      requiredAction: '',
      sourceCommandIds: [],
      affectedWorkpackages: ['WP-F01'],
      expectedEvidenceArtifacts: [],
      validationCommandLabels: [],
    },
  ],
});

describe('parseAgentBriefAcceptanceReadoutV1', () => {
  it('parses fixture', () => {
    const p = parseAgentBriefAcceptanceReadoutV1(fixture());
    expect(p).not.toBeNull();
    expect(p!.rows.map((r) => r.gateId)).toEqual([
      'assumptions_linked_resolved',
      'deviations_acknowledged',
      'validation_commands_present',
      'tracker_rows_touched',
      'evidence_artifacts_expected',
      'failure_reason_codes',
    ]);
  });

  it('returns null on bad rows', () => {
    expect(
      parseAgentBriefAcceptanceReadoutV1({
        format: 'agentBriefAcceptanceReadout_v1',
        schemaVersion: 1,
        rows: [{ gateId: 'x' }],
      }),
    ).toBeNull();
  });
});

describe('formatAgentBriefAcceptanceReadoutLines', () => {
  it('includes sorted command ids in lines', () => {
    const r = fixture();
    r.rows[0]!.sourceCommandIds = ['b', 'a'];
    const lines = formatAgentBriefAcceptanceReadoutLines(r);
    expect(lines.some((l) => l.includes('sourceCommandIds: a, b'))).toBe(true);
  });

  it('returns placeholder when null', () => {
    expect(formatAgentBriefAcceptanceReadoutLines(null)).toEqual(['(no acceptance readout)']);
  });
});

describe('AgentBriefAcceptanceReadoutV1Table', () => {
  it('renders wrapper test ids per gate row', () => {
    render(
      <div data-testid="agent-brief-acceptance-readout">
        <AgentBriefAcceptanceReadoutV1Table title="Evidence" readout={fixture()} />
      </div>,
    );
    expect(screen.getByTestId('agent-brief-acceptance-readout')).toBeTruthy();
    expect(
      screen.getByTestId('agent-brief-acceptance-row-assumptions_linked_resolved'),
    ).toBeTruthy();
    expect(screen.getByTestId('agent-brief-acceptance-row-failure_reason_codes')).toBeTruthy();
    expect(
      screen.getByTestId('agent-brief-acceptance-row-evidence_artifacts_expected').textContent,
    ).toMatch(/a\.png/);
  });
});
