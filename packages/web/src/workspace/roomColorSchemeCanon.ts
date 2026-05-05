import type { RoomColorSchemeRow } from '@bim-ai/core';

const SCHEME_HEX = /^#[0-9a-fA-F]{6}$/;

/** Matches server `RoomColorSchemeRow` hex validation (#RRGGBB, uppercase body). */
export function normalizeSchemeColorHex(input: string): string | null {
  const s = input.trim();
  if (!SCHEME_HEX.test(s)) return null;
  return `#${s.slice(1).toUpperCase()}`;
}

export function rowHasProgrammeOrDepartment(row: {
  programmeCode?: string | null;
  department?: string | null;
}): boolean {
  const pc = typeof row.programmeCode === 'string' ? row.programmeCode.trim() : '';
  const dp = typeof row.department === 'string' ? row.department.trim() : '';
  return pc.length > 0 || dp.length > 0;
}

/** Mirrors `app/bim_ai/engine.py::_canonical_room_scheme_rows` (dedupe keys, deterministic order). */
export function canonicalRoomSchemeRows(rows: RoomColorSchemeRow[]): RoomColorSchemeRow[] {
  const keyed = new Map<string, RoomColorSchemeRow>();
  const compoundToTuple = new Map<string, readonly [string, string]>();

  for (const row of rows) {
    const prog = (row.programmeCode ?? '').toString().trim();
    const dept = (row.department ?? '').toString().trim();
    const pk = prog.toLowerCase();
    const dk = dept.toLowerCase();
    const fuse = `${pk}\x00${dk}`;
    keyed.set(fuse, row);
    compoundToTuple.set(fuse, [pk, dk]);
  }

  const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

  return [...keyed.keys()]
    .sort((ka, kb) => {
      const ta = compoundToTuple.get(ka)!;
      const tb = compoundToTuple.get(kb)!;
      const c0 = cmpStr(ta[0], tb[0]);
      return c0 !== 0 ? c0 : cmpStr(ta[1], tb[1]);
    })
    .map((k) => keyed.get(k)!);
}

export type UpsertRoomColorSchemeCmdPayload = Record<string, unknown> & {
  type: 'upsertRoomColorScheme';
  id: string;
  schemeRows: RoomColorSchemeRow[];
};

export function buildUpsertRoomColorSchemeCmdPayload(
  schemeRows: RoomColorSchemeRow[],
): UpsertRoomColorSchemeCmdPayload {
  return {
    type: 'upsertRoomColorScheme',
    id: 'bim-room-color-scheme',
    schemeRows,
  };
}
