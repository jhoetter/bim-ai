import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ConstructabilityReport } from '../lib/api';
import {
  ConstructabilityReportPanel,
  constructabilityReportJsonExport,
  groupConstructabilityFindings,
} from './ConstructabilityReportPanel';

const report: ConstructabilityReport = {
  format: 'constructabilityReport_v1',
  modelId: 'model-1',
  revision: 7,
  profile: 'construction_readiness',
  summary: {
    findingCount: 2,
    issueCount: 1,
    suppressedFindingCount: 1,
    severityCounts: { warning: 2 },
    ruleCounts: { furniture_wall_hard_clash: 1, room_without_egress_path: 1 },
    statusCounts: { active: 1 },
  },
  domainIntegrityScope_v1: {
    sourceScopes: {
      structure_mep_lite: {
        certification: 'not_certified_structural_engineering',
        engineeringDisclaimer:
          'These are deterministic structure-lite and MEP-lite constructability integrity checks. They do not perform certified structural engineering, code compliance, sizing, load calculation, or life-safety review.',
      },
    },
  },
  findings: [
    {
      ruleId: 'room_without_egress_path',
      severity: 'warning',
      message: 'Room has no egress path.',
      elementIds: ['room-1'],
      discipline: 'architecture',
      recommendation: 'Connect the room through doors to an exit door.',
      rootCauseGroupId: 'egress:room-1',
      suppressibility: 'non_suppressible',
      audienceText: { ui: 'Room needs a valid egress path.' },
    },
    {
      ruleId: 'furniture_wall_hard_clash',
      severity: 'warning',
      message: 'Shelf intersects wall.',
      elementIds: ['shelf-1', 'wall-1'],
      discipline: 'coordination',
      recommendation: 'Move the object clear of the wall.',
      priorityRank: 120,
      rootCauseGroupId: 'physical_coordination:shelf-1::wall-1',
      suppressibility: 'ignorable',
    },
  ],
  issues: [
    {
      fingerprint: 'fp-1',
      ruleId: 'room_without_egress_path',
      elementIds: ['room-1'],
      status: 'active',
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe('ConstructabilityReportPanel', () => {
  it('groups findings deterministically', () => {
    const groups = groupConstructabilityFindings(report.findings, 'discipline');

    expect(groups.map((group) => group.label)).toEqual(['architecture (1)', 'coordination (1)']);
    expect(groups[0].findings[0].ruleId).toBe('room_without_egress_path');
  });

  it('renders summary, grouping, isolation, refresh, and export controls', () => {
    const onRefresh = vi.fn();
    const onIsolate = vi.fn();
    const onExportJson = vi.fn();
    const onExportBcf = vi.fn();

    render(
      <ConstructabilityReportPanel
        report={report}
        onRefresh={onRefresh}
        onIsolateElementIds={onIsolate}
        onExportJson={onExportJson}
        onExportBcf={onExportBcf}
      />,
    );

    expect(screen.getByText('construction_readiness')).toBeTruthy();
    expect(screen.getByText('not_certified_structural_engineering')).toBeTruthy();
    expect(screen.getByText(/do not perform certified structural engineering/)).toBeTruthy();
    expect(screen.getByText('warning (2)')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Group/), { target: { value: 'rule' } });
    expect(screen.getByText('furniture_wall_hard_clash (1)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Group/), { target: { value: 'rootCause' } });
    expect(screen.getByText('physical_coordination:shelf-1::wall-1 (1)')).toBeTruthy();
    expect(screen.getByText('ignorable')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Group/), { target: { value: 'rule' } });

    fireEvent.click(screen.getAllByText('Isolate')[0]);
    expect(onIsolate).toHaveBeenCalledWith(['shelf-1', 'wall-1']);

    fireEvent.click(screen.getByText('Refresh'));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('JSON'));
    expect(onExportJson).toHaveBeenCalledWith(constructabilityReportJsonExport(report));

    fireEvent.click(screen.getByText('BCF'));
    expect(onExportBcf).toHaveBeenCalledWith(report);
  });

  it('renders an actionable empty state', () => {
    render(<ConstructabilityReportPanel report={null} loading />);

    expect(screen.getByText('Loading constructability report.')).toBeTruthy();
    expect((screen.getByText('JSON') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('BCF') as HTMLButtonElement).disabled).toBe(true);
  });
});
