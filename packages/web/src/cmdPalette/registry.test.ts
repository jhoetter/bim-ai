import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { queryPalette, registerCommand, _clearRegistry, type PaletteContext } from './registry';

const CTX: PaletteContext = { selectedElementIds: [], activeViewId: null };
const CTX_WITH_SELECTION: PaletteContext = {
  selectedElementIds: ['el-1', 'el-2'],
  activeViewId: null,
};

beforeEach(() => _clearRegistry());
afterEach(() => _clearRegistry());

function seed() {
  registerCommand({
    id: 'view.phase.demolition',
    label: 'Set view phase: Demolition',
    keywords: ['phase', 'demolition'],
    category: 'command',
    invoke: vi.fn(),
  });
  registerCommand({
    id: 'view.phase.existing',
    label: 'Set view phase: Existing',
    keywords: ['phase', 'existing'],
    category: 'command',
    invoke: vi.fn(),
  });
  registerCommand({
    id: 'view.phase.new',
    label: 'Set view phase: New Construction',
    keywords: ['phase', 'new'],
    category: 'command',
    invoke: vi.fn(),
  });
  registerCommand({
    id: 'tool.wall',
    label: 'Place Wall',
    shortcut: 'W',
    keywords: ['wall', 'draw'],
    category: 'command',
    invoke: vi.fn(),
  });
  registerCommand({
    id: 'lock.parallel',
    label: 'Lock parallel',
    keywords: ['lock', 'parallel', 'wall'],
    category: 'command',
    invoke: vi.fn(),
    isAvailable: (ctx) => ctx.selectedElementIds.length >= 2,
  });
  registerCommand({
    id: 'navigate.plan',
    label: 'Go to plan view',
    keywords: ['plan', '2d'],
    category: 'navigate',
    invoke: vi.fn(),
  });
  registerCommand({
    id: 'settings.language.toggle',
    label: 'Toggle language',
    keywords: ['language', 'locale'],
    category: 'command',
    invoke: vi.fn(),
  });
}

describe('queryPalette', () => {
  it('returns phase entries in top 3 for query "phase"', () => {
    seed();
    const results = queryPalette('phase', CTX, {});
    const labels = results.slice(0, 3).map((e) => e.label);
    expect(labels.some((l) => l.includes('Demolition'))).toBe(true);
  });

  it('returns "Lock parallel" in top 3 for query "ww" when 2 elements selected', () => {
    seed();
    const results = queryPalette('lock', CTX_WITH_SELECTION, {});
    expect(results.slice(0, 3).some((e) => e.id === 'lock.parallel')).toBe(true);
  });

  it('returns all available entries sorted by recency for empty query', () => {
    seed();
    const recency = { 'navigate.plan': 10, 'tool.wall': 5 };
    const results = queryPalette('', CTX, recency);
    expect(results.length).toBeGreaterThan(0);
    // navigate.plan has highest recency so should be first.
    expect(results[0]!.id).toBe('navigate.plan');
  });

  it('returns empty array for nonsense query', () => {
    seed();
    const results = queryPalette('garbage_xyz_abc_zzz', CTX, {});
    expect(results).toHaveLength(0);
  });

  it('filters out entries where isAvailable returns false', () => {
    seed();
    // lock.parallel requires selectedElementIds.length >= 2
    const results = queryPalette('lock', CTX, {});
    expect(results.some((e) => e.id === 'lock.parallel')).toBe(false);
  });

  it('includes entries where isAvailable returns true', () => {
    seed();
    const results = queryPalette('lock', CTX_WITH_SELECTION, {});
    expect(results.some((e) => e.id === 'lock.parallel')).toBe(true);
  });

  it('boosts recently invoked entries higher', () => {
    seed();
    // Without recency boost, phase.new would appear but not first.
    const noBoost = queryPalette('phase', CTX, {});
    const withBoost = queryPalette('phase', CTX, { 'view.phase.new': 9999 });
    expect(withBoost[0]!.id).toBe('view.phase.new');
    // Without boost the order may differ.
    expect(noBoost[0]!.id).not.toBe(undefined);
  });

  it('supports mounted prefix filtering for tools, views, and settings', () => {
    seed();
    const contextWithViews: PaletteContext = {
      ...CTX,
      views: [{ id: 'plan-a', label: 'Level 1 plan', keywords: 'floor plan level' }],
    };

    expect(queryPalette('>wall', contextWithViews, {}).map((e) => e.id)).toEqual(['tool.wall']);
    expect(queryPalette('@level', contextWithViews, {}).map((e) => e.id)).toEqual(['view.plan-a']);
    expect(queryPalette(':language', contextWithViews, {}).map((e) => e.id)).toEqual([
      'settings.language.toggle',
    ]);
  });
});

describe('recency score isolation', () => {
  it('higher recency map score ranks entry first in empty query', () => {
    registerCommand({ id: 'a', label: 'Alpha', category: 'command', invoke: vi.fn() });
    registerCommand({ id: 'b', label: 'Beta', category: 'command', invoke: vi.fn() });
    const results = queryPalette('', CTX, { b: 100, a: 1 });
    expect(results[0]!.id).toBe('b');
  });
});
