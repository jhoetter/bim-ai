import { describe, expect, it } from 'vitest';
import {
  beginCellEdit,
  cycleSort,
  moveViewport,
  resizeViewport,
  SCHEDULE_DEFAULTS,
  SECTION_ELEVATION_DEFAULTS,
  setFilter,
  SHEET_DEFAULTS,
  toggleColumnVisibility,
  type SheetViewport,
  withActiveSection,
  withFarClip,
  withViewTemplate,
} from './modeSurfaces';

describe('Section / Elevation surface — spec §20.4', () => {
  it('starts with no active section and 9 m far clip', () => {
    expect(SECTION_ELEVATION_DEFAULTS.activeSectionId).toBeNull();
    expect(SECTION_ELEVATION_DEFAULTS.farClipMm).toBe(9000);
  });

  it('withActiveSection sets the section id', () => {
    const next = withActiveSection(SECTION_ELEVATION_DEFAULTS, 'seed-sec-aa');
    expect(next.activeSectionId).toBe('seed-sec-aa');
  });

  it('withFarClip clamps negatives to 0', () => {
    expect(withFarClip(SECTION_ELEVATION_DEFAULTS, -1).farClipMm).toBe(0);
    expect(withFarClip(SECTION_ELEVATION_DEFAULTS, 4500).farClipMm).toBe(4500);
  });

  it('withViewTemplate accepts id or null', () => {
    expect(withViewTemplate(SECTION_ELEVATION_DEFAULTS, 'seed-vt-arch-1to100').viewTemplateId).toBe(
      'seed-vt-arch-1to100',
    );
    expect(
      withViewTemplate({ ...SECTION_ELEVATION_DEFAULTS, viewTemplateId: 'x' }, null).viewTemplateId,
    ).toBeNull();
  });
});

describe('Sheet surface — spec §20.5', () => {
  const baseVp: SheetViewport = {
    id: 'vp-1',
    label: 'Ground plan',
    viewRef: 'plan:seed-plan-eg',
    xMm: 1500,
    yMm: 1500,
    widthMm: 38000,
    heightMm: 25000,
  };

  it('SHEET_DEFAULTS exposes a 50 mm snap tolerance', () => {
    expect(SHEET_DEFAULTS.snapToleranceMm).toBe(50);
    expect(SHEET_DEFAULTS.activeSheetId).toBeNull();
  });

  it('moveViewport translates by deltas and snaps to a 50 mm gauge', () => {
    const moved = moveViewport(baseVp, 25, 60);
    // 1500 + 25 = 1525 → within 50 of 1500 → snap to 1500
    expect(moved.xMm).toBe(1500);
    // 1500 + 60 = 1560 → within 40 of 1550 → snap toward upper gauge (1550)
    expect(moved.yMm).toBe(1550);
  });

  it('resizeViewport clamps to a 200 mm minimum', () => {
    const small = resizeViewport(baseVp, -90000, -90000);
    expect(small.widthMm).toBe(200);
    expect(small.heightMm).toBe(200);
  });

  it('resizeViewport adds positive deltas', () => {
    const big = resizeViewport(baseVp, 1000, 500);
    expect(big.widthMm).toBe(39000);
    expect(big.heightMm).toBe(25500);
  });
});

describe('Schedule surface — spec §20.6', () => {
  it('defaults to idle (no active schedule, no editing cell)', () => {
    expect(SCHEDULE_DEFAULTS.activeScheduleId).toBeNull();
    expect(SCHEDULE_DEFAULTS.editingCell).toBeNull();
    expect(SCHEDULE_DEFAULTS.sort).toBeNull();
  });

  it('beginCellEdit sets and clears the edit target', () => {
    const editing = beginCellEdit(SCHEDULE_DEFAULTS, {
      rowId: 'row-1',
      columnKey: 'mark',
    });
    expect(editing.editingCell).toEqual({ rowId: 'row-1', columnKey: 'mark' });
    const cleared = beginCellEdit(editing, null);
    expect(cleared.editingCell).toBeNull();
  });

  it('toggleColumnVisibility flips the column boolean', () => {
    const seeded = {
      ...SCHEDULE_DEFAULTS,
      columns: [
        { key: 'mark', label: 'Mark', visible: true },
        { key: 'width', label: 'Width', visible: false },
      ],
    };
    const next = toggleColumnVisibility(seeded, 'width');
    expect(next.columns.find((c) => c.key === 'width')!.visible).toBe(true);
  });

  it('cycleSort flows none → asc → desc → none on the same column', () => {
    let state = SCHEDULE_DEFAULTS;
    state = cycleSort(state, 'mark');
    expect(state.sort).toEqual({ columnKey: 'mark', descending: false });
    state = cycleSort(state, 'mark');
    expect(state.sort).toEqual({ columnKey: 'mark', descending: true });
    state = cycleSort(state, 'mark');
    expect(state.sort).toBeNull();
  });

  it('setFilter updates the filter expression', () => {
    expect(setFilter(SCHEDULE_DEFAULTS, 'kind=window').filterExpression).toBe('kind=window');
  });
});
