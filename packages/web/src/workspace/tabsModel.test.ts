import { describe, it, expect } from 'vitest';
import type { Element } from '@bim-ai/core';
import {
  EMPTY_TABS,
  activateOrOpenKind,
  activateTab,
  closeTab,
  cycleActive,
  openTab,
  reorderTab,
  snapshotViewport,
  tabFromElement,
} from './tabsModel';

describe('tabsModel — spec §11.3', () => {
  it('opens a new tab and makes it active', () => {
    const next = openTab(EMPTY_TABS, { kind: 'plan', targetId: 'lvl-0', label: 'Plan · L0' });
    expect(next.tabs).toHaveLength(1);
    expect(next.activeId).toBe('plan:lvl-0');
    expect(next.tabs[0]?.label).toBe('Plan · L0');
  });

  it('reusing an open kind+target activates the existing tab', () => {
    const a = openTab(EMPTY_TABS, { kind: 'plan', targetId: 'lvl-0', label: 'Plan · L0' });
    const b = openTab(a, { kind: '3d', targetId: 'vp-1', label: '3D · vp1' });
    const c = openTab(b, { kind: 'plan', targetId: 'lvl-0', label: 'Plan · L0' });
    expect(c.tabs).toHaveLength(2);
    expect(c.activeId).toBe('plan:lvl-0');
  });

  it('closing the active tab activates the previous one', () => {
    let s = openTab(EMPTY_TABS, { kind: 'plan', targetId: 'l0', label: 'L0' });
    s = openTab(s, { kind: '3d', targetId: 'v1', label: 'V1' });
    s = openTab(s, { kind: 'sheet', targetId: 's1', label: 'S1' });
    expect(s.activeId).toBe('sheet:s1');
    s = closeTab(s, 'sheet:s1');
    expect(s.activeId).toBe('3d:v1');
    expect(s.tabs).toHaveLength(2);
  });

  it('closing an inactive tab leaves activeId untouched', () => {
    let s = openTab(EMPTY_TABS, { kind: 'plan', targetId: 'l0', label: 'L0' });
    s = openTab(s, { kind: '3d', targetId: 'v1', label: 'V1' });
    expect(s.activeId).toBe('3d:v1');
    s = closeTab(s, 'plan:l0');
    expect(s.activeId).toBe('3d:v1');
    expect(s.tabs).toHaveLength(1);
  });

  it('closing the last tab clears activeId', () => {
    let s = openTab(EMPTY_TABS, { kind: 'plan', targetId: 'l0', label: 'L0' });
    s = closeTab(s, 'plan:l0');
    expect(s.tabs).toHaveLength(0);
    expect(s.activeId).toBeNull();
  });

  it('cycleActive wraps in both directions', () => {
    let s = openTab(EMPTY_TABS, { kind: 'plan', targetId: 'l0', label: 'L0' });
    s = openTab(s, { kind: '3d', targetId: 'v1', label: 'V1' });
    s = openTab(s, { kind: 'sheet', targetId: 's1', label: 'S1' });
    s = activateTab(s, 'plan:l0');
    s = cycleActive(s, 'forward');
    expect(s.activeId).toBe('3d:v1');
    s = cycleActive(s, 'forward');
    s = cycleActive(s, 'forward');
    // wraps back to the first
    expect(s.activeId).toBe('plan:l0');
    s = cycleActive(s, 'backward');
    expect(s.activeId).toBe('sheet:s1');
  });

  it('activateOrOpenKind activates an existing tab of that kind', () => {
    let s = openTab(EMPTY_TABS, { kind: 'plan', targetId: 'l0', label: 'L0' });
    s = openTab(s, { kind: '3d', targetId: 'v1', label: 'V1' });
    s = activateOrOpenKind(s, 'plan', { targetId: 'l9', label: 'Plan · L9' });
    expect(s.activeId).toBe('plan:l0');
    expect(s.tabs).toHaveLength(2);
  });

  it('activateOrOpenKind opens a new tab when none of that kind exists', () => {
    let s = openTab(EMPTY_TABS, { kind: 'plan', targetId: 'l0', label: 'L0' });
    s = activateOrOpenKind(s, 'sheet', { targetId: 's7', label: 'Sheet · A-101' });
    expect(s.activeId).toBe('sheet:s7');
    expect(s.tabs).toHaveLength(2);
  });

  it('tabFromElement maps each viewable element kind to a tab descriptor', () => {
    const level: Element = {
      kind: 'level',
      id: 'lvl-0',
      name: 'Level 0',
      elevationMm: 0,
    } as Extract<Element, { kind: 'level' }>;
    expect(tabFromElement(level)).toEqual({
      kind: 'plan',
      targetId: 'lvl-0',
      label: 'Level plan · Level 0',
    });

    const vp: Element = {
      kind: 'viewpoint',
      id: 'vp-iso',
      name: 'Iso',
    } as unknown as Element;
    expect(tabFromElement(vp)).toEqual({ kind: '3d', targetId: 'vp-iso', label: '3D · Iso' });

    const section: Element = {
      kind: 'section_cut',
      id: 'sec-aa',
      name: 'A–A',
      lineStartMm: { xMm: 0, yMm: 0 },
      lineEndMm: { xMm: 1, yMm: 0 },
      cropDepthMm: 1000,
    } as Extract<Element, { kind: 'section_cut' }>;
    expect(tabFromElement(section)).toEqual({
      kind: 'section',
      targetId: 'sec-aa',
      label: 'Section · A–A',
    });

    const sheet: Element = {
      kind: 'sheet',
      id: 'sht-101',
      name: 'A-101',
      paperWidthMm: 100,
      paperHeightMm: 100,
      viewportsMm: [],
    } as Extract<Element, { kind: 'sheet' }>;
    expect(tabFromElement(sheet)).toEqual({
      kind: 'sheet',
      targetId: 'sht-101',
      label: 'Sheet · A-101',
    });
  });

  it('reorderTab moves a tab from one index to another and preserves activeId', () => {
    let s = openTab(EMPTY_TABS, { kind: 'plan', targetId: 'l0', label: 'L0' });
    s = openTab(s, { kind: '3d', targetId: 'v1', label: 'V1' });
    s = openTab(s, { kind: 'sheet', targetId: 's1', label: 'S1' });
    expect(s.activeId).toBe('sheet:s1');
    s = reorderTab(s, 2, 0);
    expect(s.tabs.map((t) => t.id)).toEqual(['sheet:s1', 'plan:l0', '3d:v1']);
    expect(s.activeId).toBe('sheet:s1');
  });

  it('reorderTab clamps out-of-range indices', () => {
    let s = openTab(EMPTY_TABS, { kind: 'plan', targetId: 'l0', label: 'L0' });
    s = openTab(s, { kind: '3d', targetId: 'v1', label: 'V1' });
    s = reorderTab(s, 99, -5);
    expect(s.tabs.map((t) => t.id)).toEqual(['3d:v1', 'plan:l0']);
  });

  it('snapshotViewport stores per-tab camera state and is a no-op for unknown ids (T-07)', () => {
    let s = openTab(EMPTY_TABS, { kind: '3d', targetId: 'vp1', label: 'V1' });
    s = snapshotViewport(s, '3d:vp1', {
      orbitCameraPoseMm: {
        eyeMm: { xMm: 1, yMm: 2, zMm: 3 },
        targetMm: { xMm: 0, yMm: 0, zMm: 0 },
      },
    });
    expect(s.tabs[0]?.viewportState?.orbitCameraPoseMm?.eyeMm).toEqual({
      xMm: 1,
      yMm: 2,
      zMm: 3,
    });
    const noOp = snapshotViewport(s, 'no-such-id', { planCamera: { halfMm: 5000 } });
    expect(noOp).toBe(s);
  });

  it('snapshotViewport stores planCamera for plan tabs (T-07 follow-up)', () => {
    let s = openTab(EMPTY_TABS, { kind: 'plan', targetId: 'lvl-0', label: 'Plan · L0' });
    s = snapshotViewport(s, 'plan:lvl-0', {
      planCamera: { centerMm: { xMm: 1500, yMm: -800 }, halfMm: 12000 },
    });
    expect(s.tabs[0]?.viewportState?.planCamera).toEqual({
      centerMm: { xMm: 1500, yMm: -800 },
      halfMm: 12000,
    });
  });

  it('snapshotViewport merges planCamera without clobbering orbitCamera', () => {
    let s = openTab(EMPTY_TABS, { kind: 'plan', targetId: 'lvl-0', label: 'Plan · L0' });
    s = snapshotViewport(s, 'plan:lvl-0', {
      orbitCameraPoseMm: {
        eyeMm: { xMm: 10, yMm: 5, zMm: 10 },
        targetMm: { xMm: 0, yMm: 0, zMm: 0 },
      },
    });
    s = snapshotViewport(s, 'plan:lvl-0', {
      ...s.tabs[0]!.viewportState,
      planCamera: { centerMm: { xMm: 500, yMm: 200 }, halfMm: 8000 },
    });
    expect(s.tabs[0]?.viewportState?.orbitCameraPoseMm?.eyeMm?.xMm).toBe(10);
    expect(s.tabs[0]?.viewportState?.planCamera?.centerMm?.xMm).toBe(500);
  });

  it('reorderTab is a no-op when from === to', () => {
    let s = openTab(EMPTY_TABS, { kind: 'plan', targetId: 'l0', label: 'L0' });
    s = openTab(s, { kind: '3d', targetId: 'v1', label: 'V1' });
    const next = reorderTab(s, 0, 0);
    expect(next).toBe(s);
  });

  it('tabFromElement returns null for non-viewable kinds', () => {
    const wall: Element = {
      kind: 'wall',
      id: 'w-1',
    } as unknown as Element;
    expect(tabFromElement(wall)).toBeNull();
  });
});
