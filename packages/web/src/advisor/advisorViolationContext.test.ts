import type { Violation } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import {
  recommendedContextForRuleId,
  sortViolationsDeterministic,
  summarizeQuickFixCommand,
} from './advisorViolationContext';

describe('advisorViolationContext', () => {
  it('recommends sheet context for schedule placement advisory', () => {
    expect(recommendedContextForRuleId('schedule_sheet_viewport_missing')).toMatch(/sheet/i);
    expect(recommendedContextForRuleId('sheet_missing_titleblock')).toMatch(/title block/i);
  });

  it('summarizes upsertSheetViewports with first viewRef', () => {
    const lines = summarizeQuickFixCommand({
      type: 'upsertSheetViewports',
      sheetId: 's-1',
      viewportsMm: [{ viewRef: 'schedule:sch-a', viewportId: 'vp-1', widthMm: 100 }],
    });
    expect(lines).toContain('type: upsertSheetViewports');
    expect(lines).toContain('sheetId: s-1');
    expect(lines.some((l) => l.includes('schedule:sch-a'))).toBe(true);
  });

  it('summarizes updateElementProperty', () => {
    const lines = summarizeQuickFixCommand({
      type: 'updateElementProperty',
      elementId: 'sh1',
      key: 'titleBlock',
      value: 'A1',
    });
    expect(lines.some((l) => l.includes('property:'))).toBe(true);
    expect(lines).toContain('elementId: sh1');
  });

  it('recommends schedule opening QA context for new rules', () => {
    expect(recommendedContextForRuleId('schedule_opening_identifier_missing')).toMatch(
      /mark|name/i,
    );
    expect(recommendedContextForRuleId('schedule_opening_orphan_host')).toMatch(/wall/i);
    expect(recommendedContextForRuleId('schedule_opening_family_type_incomplete')).toMatch(
      /familyTypeId/i,
    );
    expect(recommendedContextForRuleId('schedule_opening_host_wall_type_incomplete')).toMatch(
      /wallTypeId/i,
    );
  });

  it('sorts violations deterministically', () => {
    const sorted = sortViolationsDeterministic([
      {
        ruleId: 'z',
        severity: 'info',
        message: 'm',
      },
      {
        ruleId: 'a',
        severity: 'error',
        message: 'm2',
      },
    ] satisfies Violation[]);
    expect(sorted[0]!.severity).toBe('error');
    expect(sorted[1]!.ruleId).toBe('z');
  });
});
