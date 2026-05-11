import type { Violation } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import {
  humanizeRuleId,
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

  it('recommends constructability context for emitted rule ids', () => {
    expect(recommendedContextForRuleId('physical_hard_clash')).toMatch(/clash view/i);
    expect(recommendedContextForRuleId('physical_duplicate_geometry')).toMatch(
      /duplicate geometry|coincident/i,
    );
    expect(recommendedContextForRuleId('furniture_wall_hard_clash')).toMatch(/furniture/i);
    expect(recommendedContextForRuleId('stair_wall_hard_clash')).toMatch(/stair/i);
    expect(recommendedContextForRuleId('constructability_proxy_unsupported')).toMatch(
      /typed wall|proxy geometry/i,
    );
    expect(recommendedContextForRuleId('wall_load_bearing_unknown_primary_envelope')).toMatch(
      /load-bearing status/i,
    );
    expect(recommendedContextForRuleId('large_opening_in_load_bearing_wall_unresolved')).toMatch(
      /lintel|header|engineering approval/i,
    );
    expect(recommendedContextForRuleId('beam_without_support')).toMatch(/support/i);
    expect(recommendedContextForRuleId('column_without_foundation_or_support')).toMatch(
      /foundation|load path/i,
    );
    expect(recommendedContextForRuleId('door_operation_clearance_conflict')).toMatch(
      /operation zone|clearance/i,
    );
    expect(recommendedContextForRuleId('pipe_wall_penetration_without_opening')).toMatch(
      /sleeve\/opening|pipe/i,
    );
    expect(recommendedContextForRuleId('duct_wall_penetration_without_opening')).toMatch(
      /sleeve\/opening|duct/i,
    );
    expect(recommendedContextForRuleId('pipe_floor_penetration_without_opening')).toMatch(
      /slab sleeve|floor/i,
    );
    expect(recommendedContextForRuleId('duct_ceiling_penetration_without_opening')).toMatch(
      /ceiling route|plenum/i,
    );
  });

  it('humanizes constructability rule titles with domain wording', () => {
    expect(humanizeRuleId('constructability_proxy_unsupported')).toBe(
      'Unsupported Constructability Proxy',
    );
    expect(humanizeRuleId('physical_duplicate_geometry')).toBe('Physical Duplicate Geometry');
    expect(humanizeRuleId('wall_load_bearing_unknown_primary_envelope')).toBe(
      'Primary Envelope Wall Missing Load-Bearing Status',
    );
    expect(humanizeRuleId('pipe_wall_penetration_without_opening')).toBe(
      'Pipe Wall Penetration Without Opening',
    );
    expect(humanizeRuleId('duct_floor_penetration_without_opening')).toBe(
      'Duct Floor Penetration Without Opening',
    );
    expect(humanizeRuleId('pipe_ceiling_penetration_without_opening')).toBe(
      'Pipe Ceiling Penetration Without Opening',
    );
    expect(humanizeRuleId('custom_rule_id')).toBe('Custom Rule Id');
  });

  it('sorts violations deterministically', () => {
    const sorted = sortViolationsDeterministic([
      {
        ruleId: 'z',
        severity: 'info',
        message: 'm',
      },
      {
        ruleId: 'door_operation_clearance_conflict',
        severity: 'warning',
        message: 'z message',
      },
      {
        ruleId: 'beam_without_support',
        severity: 'warning',
        message: 'a message',
      },
      {
        ruleId: 'a',
        severity: 'error',
        message: 'm2',
      },
    ] satisfies Violation[]);
    expect(sorted[0]!.severity).toBe('error');
    expect(sorted.map((v) => v.ruleId)).toEqual([
      'a',
      'beam_without_support',
      'door_operation_clearance_conflict',
      'z',
    ]);
  });
});
