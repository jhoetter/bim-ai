import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import {
  buildPlaceholderDetailTitle,
  detailCalloutUnresolvedReason,
  readViewportRoleFromRaw,
} from './sheetDetailCalloutReadout';

describe('readViewportRoleFromRaw', () => {
  it('normalizes detail callout aliases', () => {
    expect(readViewportRoleFromRaw({ viewportRole: 'Detail-Callout' })).toBe('detail_callout');
    expect(readViewportRoleFromRaw({ viewport_role: 'detail_callout' })).toBe('detail_callout');
    expect(readViewportRoleFromRaw({})).toBe('standard');
  });
});

describe('detailCalloutUnresolvedReason', () => {
  it('returns unresolved_plan_view when plan id missing', () => {
    const elementsById = {} as Record<string, Element>;
    expect(detailCalloutUnresolvedReason(elementsById, 'plan:missing')).toBe(
      'unresolved_plan_view',
    );
  });

  it('returns empty when plan resolves', () => {
    const elementsById = {
      pv: { kind: 'plan_view', id: 'pv', name: 'EG', levelId: 'lvl' },
    } as Record<string, Element>;
    expect(detailCalloutUnresolvedReason(elementsById, 'plan:pv')).toBe('');
  });
});

describe('buildPlaceholderDetailTitle', () => {
  it('matches python placeholder shapes', () => {
    expect(buildPlaceholderDetailTitle('3', 'EG', '')).toBe('Detail 3 — EG');
    expect(buildPlaceholderDetailTitle('3', undefined, 'unresolved_plan_view')).toBe(
      'Detail 3 — unresolved',
    );
    expect(buildPlaceholderDetailTitle('', 'EG', '')).toBe('Detail — EG');
  });
});
