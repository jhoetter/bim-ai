import { describe, it, expect } from 'vitest';
import { applyPhaseFilter, isElementVisibleUnderPhaseFilter } from './phaseFilter';

describe('SKB-23 phase filter', () => {
  it('null filter renders every element', () => {
    expect(isElementVisibleUnderPhaseFilter(null, { phaseId: 'massing' })).toBe(true);
    expect(isElementVisibleUnderPhaseFilter(null, { phaseId: null })).toBe(true);
    expect(isElementVisibleUnderPhaseFilter(null, {})).toBe(true);
  });

  it('renders elements whose phaseId is in the filter list', () => {
    const f = { phases: ['massing', 'skeleton'], includeUntagged: false };
    expect(isElementVisibleUnderPhaseFilter(f, { phaseId: 'massing' })).toBe(true);
    expect(isElementVisibleUnderPhaseFilter(f, { phaseId: 'skeleton' })).toBe(true);
    expect(isElementVisibleUnderPhaseFilter(f, { phaseId: 'envelope' })).toBe(false);
  });

  it('untagged element honours includeUntagged flag', () => {
    const allow = { phases: ['massing'], includeUntagged: true };
    const block = { phases: ['massing'], includeUntagged: false };
    expect(isElementVisibleUnderPhaseFilter(allow, { phaseId: null })).toBe(true);
    expect(isElementVisibleUnderPhaseFilter(allow, {})).toBe(true);
    expect(isElementVisibleUnderPhaseFilter(block, { phaseId: null })).toBe(false);
    expect(isElementVisibleUnderPhaseFilter(block, {})).toBe(false);
  });

  it('null element renders only when filter is null', () => {
    expect(isElementVisibleUnderPhaseFilter(null, null)).toBe(true);
    const f = { phases: ['massing'], includeUntagged: true };
    expect(isElementVisibleUnderPhaseFilter(f, null)).toBe(false);
  });

  it('applyPhaseFilter is identity when filter is null', () => {
    const elements = [{ phaseId: 'massing' }, { phaseId: 'envelope' }];
    expect(applyPhaseFilter(null, elements)).toBe(elements);
  });

  it('applyPhaseFilter narrows to selected phases', () => {
    const f = { phases: ['envelope'], includeUntagged: false };
    const elements = [
      { id: 'a', phaseId: 'massing' },
      { id: 'b', phaseId: 'envelope' },
      { id: 'c' as string, phaseId: null as string | null },
    ];
    const out = applyPhaseFilter(f, elements);
    expect(out.map((e) => e.id)).toEqual(['b']);
  });

  it('applyPhaseFilter preserves order', () => {
    const f = { phases: ['envelope', 'detail'], includeUntagged: true };
    const elements = [
      { id: '1', phaseId: 'massing' },
      { id: '2', phaseId: 'envelope' },
      { id: '3', phaseId: null as string | null },
      { id: '4', phaseId: 'detail' },
      { id: '5', phaseId: 'documentation' },
    ];
    const out = applyPhaseFilter(f, elements);
    expect(out.map((e) => e.id)).toEqual(['2', '3', '4']);
  });
});
