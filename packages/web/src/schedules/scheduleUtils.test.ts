import { describe, expect, it } from 'vitest';

import {
  doorRowsFromServer,
  flattenSchedulePayloadRows,
  fmtRoomScheduleOptM2,
  formatScheduleCell,
  levelFilterFieldForTab,
  registryScheduleTab,
  roomRowsFromServer,
  scheduleGroupingKeyChoices,
  scheduleSortKeyChoices,
  tabToPresetCategory,
  winRowsFromServer,
} from './scheduleUtils';

describe('formatScheduleCell', () => {
  it('formats null as em-dash', () => expect(formatScheduleCell(null)).toBe('—'));
  it('formats undefined as em-dash', () => expect(formatScheduleCell(undefined)).toBe('—'));
  it('formats empty string as em-dash', () => expect(formatScheduleCell('')).toBe('—'));
  it('formats integer without decimals', () => expect(formatScheduleCell(42)).toBe('42'));
  it('formats float to 3 decimal places', () => expect(formatScheduleCell(1.5)).toBe('1.500'));
  it('formats zero as 0', () => expect(formatScheduleCell(0)).toBe('0'));
  it('formats strings as-is', () => expect(formatScheduleCell('hello')).toBe('hello'));
});

describe('fmtRoomScheduleOptM2', () => {
  it('formats null as em-dash', () => expect(fmtRoomScheduleOptM2(null)).toBe('—'));
  it('formats undefined as em-dash', () => expect(fmtRoomScheduleOptM2(undefined)).toBe('—'));
  it('formats NaN as em-dash', () => expect(fmtRoomScheduleOptM2(NaN)).toBe('—'));
  it('formats a number to 3 decimal places', () =>
    expect(fmtRoomScheduleOptM2(25.5)).toBe('25.500'));
});

describe('flattenSchedulePayloadRows', () => {
  it('returns flat rows array when present', () => {
    const data = { rows: [{ id: 'a' }, { id: 'b' }] };
    expect(flattenSchedulePayloadRows(data)).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('flattens grouped sections when rows absent', () => {
    const data = {
      groupedSections: {
        'Level 1': [{ id: 'a' }],
        'Level 2': [{ id: 'b' }, { id: 'c' }],
      },
    };
    const result = flattenSchedulePayloadRows(data);
    expect(result).toHaveLength(3);
  });

  it('prefers flat rows over groupedSections', () => {
    const data = {
      rows: [{ id: 'a' }],
      groupedSections: { g: [{ id: 'b' }] },
    };
    expect(flattenSchedulePayloadRows(data)).toEqual([{ id: 'a' }]);
  });

  it('returns empty array when data has neither', () => {
    expect(flattenSchedulePayloadRows({})).toEqual([]);
  });
});

describe('levelFilterFieldForTab', () => {
  it('returns levelId for rooms', () => expect(levelFilterFieldForTab('rooms')).toBe('levelId'));
  it('returns levelId for doors', () => expect(levelFilterFieldForTab('doors')).toBe('levelId'));
  it('returns levelId for windows', () =>
    expect(levelFilterFieldForTab('windows')).toBe('levelId'));
  it('returns levelId for finishes', () =>
    expect(levelFilterFieldForTab('finishes')).toBe('levelId'));
  it('returns levelId for floors', () => expect(levelFilterFieldForTab('floors')).toBe('levelId'));
  it('returns levelId for plans', () => expect(levelFilterFieldForTab('plans')).toBe('levelId'));
  it('returns levelId for views', () => expect(levelFilterFieldForTab('views')).toBe('levelId'));
  it('returns levelId for assemblies', () =>
    expect(levelFilterFieldForTab('assemblies')).toBe('levelId'));
  it('returns referenceLevelId for roofs', () =>
    expect(levelFilterFieldForTab('roofs')).toBe('referenceLevelId'));
  it('returns baseLevelId for stairs', () =>
    expect(levelFilterFieldForTab('stairs')).toBe('baseLevelId'));
  it('returns null for sheets', () => expect(levelFilterFieldForTab('sheets')).toBeNull());
});

describe('scheduleSortKeyChoices', () => {
  const ALL_TABS = [
    'rooms',
    'doors',
    'windows',
    'finishes',
    'floors',
    'roofs',
    'stairs',
    'plans',
    'views',
    'sheets',
    'assemblies',
  ] as const;

  it('returns non-empty array for every tab', () => {
    for (const tab of ALL_TABS) {
      expect(scheduleSortKeyChoices(tab).length).toBeGreaterThan(0);
    }
  });

  it('includes name in every tab', () => {
    for (const tab of ALL_TABS) {
      expect(scheduleSortKeyChoices(tab)).toContain('name');
    }
  });

  it('doors include widthMm', () => expect(scheduleSortKeyChoices('doors')).toContain('widthMm'));
  it('windows include heightMm', () =>
    expect(scheduleSortKeyChoices('windows')).toContain('heightMm'));
  it('rooms include areaM2', () => expect(scheduleSortKeyChoices('rooms')).toContain('areaM2'));
  it('finishes include finishSet', () =>
    expect(scheduleSortKeyChoices('finishes')).toContain('finishSet'));
  it('views include viewKind', () => expect(scheduleSortKeyChoices('views')).toContain('viewKind'));
});

describe('scheduleGroupingKeyChoices', () => {
  it('returns levelId grouping for rooms', () => {
    expect(scheduleGroupingKeyChoices('rooms')).toContain('levelId');
  });

  it('returns levelId and familyTypeId for doors', () => {
    const keys = scheduleGroupingKeyChoices('doors');
    expect(keys).toContain('levelId');
    expect(keys).toContain('familyTypeId');
  });

  it('returns non-empty array for every tab', () => {
    const tabs = [
      'rooms',
      'doors',
      'windows',
      'finishes',
      'floors',
      'roofs',
      'stairs',
      'plans',
      'views',
      'sheets',
      'assemblies',
    ] as const;
    for (const tab of tabs) {
      expect(scheduleGroupingKeyChoices(tab).length).toBeGreaterThan(0);
    }
  });
});

describe('tabToPresetCategory', () => {
  it('maps rooms to room', () => expect(tabToPresetCategory('rooms')).toBe('room'));
  it('maps doors to door', () => expect(tabToPresetCategory('doors')).toBe('door'));
  it('maps windows to window', () => expect(tabToPresetCategory('windows')).toBe('window'));
  it('maps finishes to finish', () => expect(tabToPresetCategory('finishes')).toBe('finish'));
  it('maps assemblies to material_assembly', () =>
    expect(tabToPresetCategory('assemblies')).toBe('material_assembly'));
  it('returns null for floors', () => expect(tabToPresetCategory('floors')).toBeNull());
  it('returns null for roofs', () => expect(tabToPresetCategory('roofs')).toBeNull());
  it('returns null for stairs', () => expect(tabToPresetCategory('stairs')).toBeNull());
  it('returns null for sheets', () => expect(tabToPresetCategory('sheets')).toBeNull());
  it('returns null for plans', () => expect(tabToPresetCategory('plans')).toBeNull());
  it('returns null for views', () => expect(tabToPresetCategory('views')).toBeNull());
});

describe('registryScheduleTab', () => {
  it('returns true for registry tabs', () => {
    for (const tab of [
      'finishes',
      'floors',
      'roofs',
      'stairs',
      'plans',
      'views',
      'sheets',
      'assemblies',
    ] as const) {
      expect(registryScheduleTab(tab)).toBe(true);
    }
  });

  it('returns false for non-registry tabs', () => {
    for (const tab of ['rooms', 'doors', 'windows'] as const) {
      expect(registryScheduleTab(tab)).toBe(false);
    }
  });
});

describe('roomRowsFromServer', () => {
  it('maps rows with all fields', () => {
    const rows = [
      {
        elementId: 'r1',
        name: 'Office',
        level: 'L1',
        areaM2: 20.5,
        perimeterM: 18.4,
        targetAreaM2: 22,
        areaDeltaM2: -1.5,
      },
    ];
    const result = roomRowsFromServer(rows);
    expect(result[0]).toMatchObject({
      id: 'r1',
      name: 'Office',
      level: 'L1',
      areaM2: 20.5,
      perM: 18.4,
      targetAreaM2: 22,
      areaDeltaM2: -1.5,
    });
  });

  it('falls back to index-based id when elementId is absent', () => {
    const result = roomRowsFromServer([{ name: 'Room' }]);
    expect(result[0]?.id).toBe('srv-room-0');
  });

  it('sets targetAreaM2 to null when not numeric', () => {
    const result = roomRowsFromServer([{ elementId: 'r1', targetAreaM2: '' }]);
    expect(result[0]?.targetAreaM2).toBeNull();
  });
});

describe('doorRowsFromServer', () => {
  it('maps rows correctly', () => {
    const rows = [
      {
        elementId: 'd1',
        name: 'Door 1',
        level: 'L1',
        widthMm: 900,
        familyTypeId: 'builtin:door:single:900x2100',
      },
    ];
    const result = doorRowsFromServer(rows);
    expect(result[0]).toMatchObject({ id: 'd1', name: 'Door 1', widthMm: 900 });
  });

  it('falls back to index-based id', () => {
    expect(doorRowsFromServer([{ name: 'Door' }])[0]?.id).toBe('srv-door-0');
  });
});

describe('winRowsFromServer', () => {
  it('maps rows correctly', () => {
    const rows = [
      { elementId: 'w1', name: 'Win 1', level: 'L1', widthMm: 1200, heightMm: 1500, sillMm: 900 },
    ];
    const result = winRowsFromServer(rows);
    expect(result[0]).toMatchObject({ id: 'w1', widthMm: 1200, heightMm: 1500, sillMm: 900 });
  });

  it('falls back to index-based id', () => {
    expect(winRowsFromServer([{ name: 'Win' }])[0]?.id).toBe('srv-win-0');
  });
});
