import { describe, expect, it } from 'vitest';

import { parseAgentReviewActionsV1 } from './agentReviewActions';

describe('parseAgentReviewActionsV1', () => {
  it('parses agentReviewActions_v1 rows', () => {
    const rows = parseAgentReviewActionsV1({
      format: 'agentReviewActions_v1',
      actions: [
        {
          actionId: 'b',
          kind: 'reviewTopic',
          guidance: 'Second',
          target: { topicKind: 'bcf' },
        },
        {
          actionId: '',
          kind: 'reviewTopic',
          guidance: 'skip',
          target: {},
        },
        {
          actionId: 'a',
          kind: 'focusDeterministicEvidenceRow',
          guidance: 'First',
          target: { deterministicRowKind: 'sheet', sheetId: 'sh1' },
        },
      ],
    });
    expect(rows.map((r) => r.actionId)).toEqual(['b', 'a']);
    expect(rows[1]?.target.sheetId).toBe('sh1');
  });

  it('returns empty for unknown shapes', () => {
    expect(parseAgentReviewActionsV1(null)).toEqual([]);
    expect(parseAgentReviewActionsV1({ format: 'other' })).toEqual([]);
  });
});
