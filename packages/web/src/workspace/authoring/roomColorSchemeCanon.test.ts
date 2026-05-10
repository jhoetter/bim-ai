import { describe, expect, it } from 'vitest';

import type { RoomColorSchemeRow } from '@bim-ai/core';

import {
  buildUpsertRoomColorSchemeCmdPayload,
  canonicalRoomSchemeRows,
  normalizeSchemeColorHex,
  rowHasProgrammeOrDepartment,
} from './roomColorSchemeCanon';

describe('normalizeSchemeColorHex', () => {
  it('uppercases RGB and accepts mixed case input', () => {
    expect(normalizeSchemeColorHex('#abCDEF')).toBe('#ABCDEF');
  });

  it('returns null when pattern does not match', () => {
    expect(normalizeSchemeColorHex('#abc')).toBeNull();
    expect(normalizeSchemeColorHex('ABCDEF')).toBeNull();
    expect(normalizeSchemeColorHex('')).toBeNull();
  });
});

describe('rowHasProgrammeOrDepartment', () => {
  it('requires at least one non-empty trimmed field', () => {
    expect(rowHasProgrammeOrDepartment({ programmeCode: '  X ' })).toBe(true);
    expect(rowHasProgrammeOrDepartment({ department: 'Dept' })).toBe(true);
    expect(rowHasProgrammeOrDepartment({ programmeCode: '', department: '' })).toBe(false);
  });
});

describe('canonicalRoomSchemeRows', () => {
  it('dedupes on lower programme × department and sorts', () => {
    const rows = canonicalRoomSchemeRows([
      { programmeCode: 'Z', department: '', schemeColorHex: '#111111' },
      { programmeCode: 'LAB', schemeColorHex: '#222222' },
      { programmeCode: 'lab', department: '', schemeColorHex: '#333333' },
      { programmeCode: '', department: 'Surgery', schemeColorHex: '#444444' },
    ]);

    expect(rows).toHaveLength(3);

    expect(rows.map((r) => r.schemeColorHex)).toEqual(['#444444', '#333333', '#111111']);
  });

  it('department-only keys collide independently of programme casing', () => {
    const a: RoomColorSchemeRow[] = canonicalRoomSchemeRows([
      { department: 'CORE', programmeCode: '', schemeColorHex: '#AAAAAA' },
      { department: 'core', programmeCode: '', schemeColorHex: '#BBBBBB' },
    ]);
    expect(a).toHaveLength(1);
    expect(a[0]!.schemeColorHex).toBe('#BBBBBB');
  });
});

describe('buildUpsertRoomColorSchemeCmdPayload', () => {
  it('uses singleton id and camelCase schemeRows alias', () => {
    const cmd = buildUpsertRoomColorSchemeCmdPayload([
      { programmeCode: 'OFF', schemeColorHex: '#010203' },
    ]);
    expect(cmd).toEqual({
      type: 'upsertRoomColorScheme',
      id: 'bim-room-color-scheme',
      schemeRows: [{ programmeCode: 'OFF', schemeColorHex: '#010203' }],
    });
  });
});
