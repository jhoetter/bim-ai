import { describe, expect, it } from 'vitest';

import { roomFinishScheduleEvidenceReadoutParts } from './roomFinishScheduleEvidenceReadout';

describe('roomFinishScheduleEvidenceReadoutParts', () => {
  it('returns empty for unknown payloads', () => {
    expect(roomFinishScheduleEvidenceReadoutParts(null)).toEqual([]);
    expect(roomFinishScheduleEvidenceReadoutParts({ format: 'other' })).toEqual([]);
  });

  it('formats digest prefix and summary', () => {
    const dig = 'a'.repeat(64);
    const parts = roomFinishScheduleEvidenceReadoutParts({
      format: 'roomFinishScheduleEvidence_v1',
      rowDigestSha256: dig,
      summary: {
        complete: 2,
        not_required: 1,
        missing: 0,
        peer_suggested: 3,
      },
    });
    expect(parts[0]).toBe(`digest ${'a'.repeat(16)}…`);
    expect(parts).toContain('complete 2');
    expect(parts).toContain('notRequired 1');
    expect(parts).toContain('missing 0');
    expect(parts).toContain('peerSuggested 3');
  });
});
