import { describe, expect, it } from 'vitest';

import {
  formatAgentGeneratedBundleQaChecklistReadout,
  parseAgentGeneratedBundleQaChecklistV1,
} from './agentGeneratedBundleQaChecklist';

const fixture = () => ({
  format: 'agentGeneratedBundleQaChecklist_v1' as const,
  schemaVersion: 1,
  rows: [
    {
      id: 'model_command_coverage',
      label: 'Model command coverage',
      status: 'fail' as const,
      detail: 'No proposed commands in preview (proposedCommandCount=0).',
    },
    {
      id: 'validation_advisor_status',
      label: 'Validation / advisor status',
      status: 'pass' as const,
      detail: 'No blocking or error violations; no brief unresolved blockers.',
    },
  ],
});

describe('parseAgentGeneratedBundleQaChecklistV1', () => {
  it('parses fixture', () => {
    const parsed = parseAgentGeneratedBundleQaChecklistV1(fixture());
    expect(parsed).not.toBeNull();
    expect(parsed!.rows.map((x) => x.id)).toEqual([
      'model_command_coverage',
      'validation_advisor_status',
    ]);
  });

  it('returns null when row invalid', () => {
    expect(
      parseAgentGeneratedBundleQaChecklistV1({
        format: 'agentGeneratedBundleQaChecklist_v1',
        schemaVersion: 1,
        rows: [{ id: '', label: '', status: 'pass', detail: '' }],
      }),
    ).toBeNull();
  });
});

describe('formatAgentGeneratedBundleQaChecklistReadout', () => {
  it('formats fixture readout lines', () => {
    expect(formatAgentGeneratedBundleQaChecklistReadout(fixture())).toMatchInlineSnapshot(`
      [
        "format: agentGeneratedBundleQaChecklist_v1",
        "schemaVersion: 1",
        "rows:",
        "  model_command_coverage (FAIL) — Model command coverage: No proposed commands in preview (proposedCommandCount=0).",
        "  validation_advisor_status (PASS) — Validation / advisor status: No blocking or error violations; no brief unresolved blockers.",
      ]
    `);
  });
});
