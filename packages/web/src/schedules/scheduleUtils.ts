import type { Element } from '@bim-ai/core';

import type { SchedulePresetCategory } from './scheduleDefinitionPresets';
import type { RegistryModelTab } from './schedulePanelPlansSheetsUi';

export type TabKey =
  | 'rooms'
  | 'doors'
  | 'windows'
  | 'finishes'
  | 'floors'
  | 'roofs'
  | 'stairs'
  | 'plans'
  | 'views'
  | 'sheets'
  | 'assemblies';

export function registryScheduleTab(tab: TabKey): tab is RegistryModelTab {
  return (
    tab === 'floors' ||
    tab === 'finishes' ||
    tab === 'roofs' ||
    tab === 'stairs' ||
    tab === 'plans' ||
    tab === 'views' ||
    tab === 'sheets' ||
    tab === 'assemblies'
  );
}

export function tabToPresetCategory(tab: TabKey): SchedulePresetCategory | null {
  switch (tab) {
    case 'rooms':
      return 'room';
    case 'doors':
      return 'door';
    case 'windows':
      return 'window';
    case 'finishes':
      return 'finish';
    case 'assemblies':
      return 'material_assembly';
    default:
      return null;
  }
}

export const SCHED_TABLE_ROW_PX = 28;
export const SCHED_TABLE_VIEWPORT_PX = 220;

export function findScheduleIdForCategory(
  elementsById: Record<string, Element>,
  category: string,
): string | undefined {
  let best: string | undefined;

  for (const e of Object.values(elementsById)) {
    if (e.kind !== 'schedule') continue;
    const f = e.filters ?? {};
    const c = String(
      (f as { category?: string }).category ?? (f as { Category?: string }).Category ?? '',
    ).toLowerCase();
    if (c !== category) continue;
    if (!best || e.id.localeCompare(best) < 0) best = e.id;
  }

  return best;
}

export function scheduleGroupingKeyChoices(tab: TabKey): readonly string[] {
  switch (tab) {
    case 'doors': {
      return ['levelId', 'familyTypeId', 'wallId', 'hostWallTypeId', 'hostWallTypeDisplay'];
    }

    case 'windows': {
      return ['levelId', 'familyTypeId', 'wallId', 'hostWallTypeId', 'hostWallTypeDisplay'];
    }

    case 'rooms': {
      return ['levelId', 'programmeCode', 'department'];
    }

    case 'finishes': {
      return ['levelId', 'department', 'finishState', 'finishSet'];
    }

    case 'floors': {
      return ['levelId', 'name'];
    }

    case 'roofs': {
      return ['referenceLevelId', 'name'];
    }

    case 'stairs': {
      return ['baseLevelId', 'topLevelId', 'name'];
    }

    case 'plans': {
      return ['levelId', 'planPresentation', 'discipline', 'sheetId'];
    }

    case 'views': {
      return ['viewKind', 'viewType', 'levelId', 'discipline', 'sheetId'];
    }

    case 'sheets': {
      return ['titleBlock', 'name', 'planViewNames'];
    }

    case 'assemblies': {
      return [
        'levelId',
        'hostKind',
        'assemblyTypeId',
        'hostElementId',
        'materialKey',
        'layerIndex',
        'layerFunction',
      ];
    }

    default: {
      const exhaustive: never = tab;

      return exhaustive;
    }
  }
}

export function scheduleSortKeyChoices(tab: TabKey): readonly string[] {
  switch (tab) {
    case 'doors': {
      return [
        'name',
        'elementId',
        'level',
        'widthMm',
        'hostHeightMm',
        'roughOpeningWidthMm',
        'roughOpeningHeightMm',
        'roughOpeningAreaM2',
        'hostWallTypeId',
        'hostWallTypeDisplay',
        'familyTypeId',
        'materialKey',
        'materialDisplay',
      ];
    }

    case 'windows': {
      return [
        'name',
        'elementId',
        'level',
        'widthMm',
        'heightMm',
        'sillMm',
        'roughOpeningWidthMm',
        'roughOpeningHeightMm',
        'roughOpeningAreaM2',
        'openingAreaM2',
        'aspectRatio',
        'headHeightMm',
        'hostWallTypeId',
        'hostWallTypeDisplay',
        'familyTypeId',
        'materialKey',
        'materialDisplay',
      ];
    }

    case 'rooms': {
      return [
        'name',
        'elementId',
        'level',
        'areaM2',
        'targetAreaM2',
        'areaDeltaM2',
        'perimeterM',
        'programmeCode',
      ];
    }

    case 'finishes': {
      return [
        'name',
        'elementId',
        'level',
        'department',
        'programmeCode',
        'finishSet',
        'finishState',
        'areaM2',
      ];
    }

    case 'floors': {
      return ['name', 'elementId', 'level', 'thicknessMm', 'areaM2', 'perimeterM'];
    }

    case 'roofs': {
      return ['name', 'elementId', 'referenceLevel', 'overhangMm', 'slopeDeg', 'footprintAreaM2'];
    }

    case 'stairs': {
      return ['name', 'elementId', 'baseLevel', 'topLevel', 'riseMm', 'runMm', 'widthMm'];
    }

    case 'plans': {
      return [
        'name',
        'elementId',
        'level',
        'planPresentation',
        'discipline',
        'sheetId',
        'sheetName',
      ];
    }

    case 'views': {
      return [
        'name',
        'elementId',
        'viewKind',
        'viewType',
        'level',
        'discipline',
        'viewTemplateId',
        'sheetId',
        'sheetName',
      ];
    }

    case 'sheets': {
      return ['name', 'elementId', 'viewportCount', 'titleBlock', 'planViewNames'];
    }

    case 'assemblies': {
      return [
        'name',
        'elementId',
        'level',
        'hostKind',
        'hostElementId',
        'layerIndex',
        'layerFunction',
        'materialKey',
        'materialDisplay',
        'thicknessMm',
        'grossAreaM2',
        'grossVolumeM3',
        'assemblyTypeId',
        'assemblyTotalThicknessMm',
        'layerOffsetFromExteriorMm',
      ];
    }

    default: {
      const exhaustive: never = tab;

      return exhaustive;
    }
  }
}

export function levelFilterFieldForTab(
  tab: TabKey,
): 'levelId' | 'referenceLevelId' | 'baseLevelId' | null {
  switch (tab) {
    case 'rooms':
    case 'doors':
    case 'windows':
    case 'floors':
    case 'finishes':
    case 'plans':
    case 'views':
    case 'assemblies':
      return 'levelId';
    case 'roofs':
      return 'referenceLevelId';
    case 'stairs':
      return 'baseLevelId';
    case 'sheets':
      return null;
    default: {
      const exhaustive: never = tab;
      return exhaustive;
    }
  }
}

export function formatScheduleCell(v: unknown): string {
  if (v == null || v === '') return '—';

  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);

  return String(v);
}

export function flattenSchedulePayloadRows(
  data: Record<string, unknown>,
): Record<string, unknown>[] {
  const rows = data.rows;

  if (Array.isArray(rows)) return rows as Record<string, unknown>[];

  const gs = data.groupedSections as Record<string, unknown[]> | undefined;

  if (gs && typeof gs === 'object') {
    const out: Record<string, unknown>[] = [];

    for (const v of Object.values(gs)) {
      if (Array.isArray(v)) out.push(...(v as Record<string, unknown>[]));
    }

    return out;
  }

  return [];
}

export type RoomVm = {
  id: string;
  name: string;
  level: string;
  areaM2: number;
  perM: number;
  targetAreaM2: number | null;
  areaDeltaM2: number | null;
};

export const ROOM_SCHED_COLSPAN = 6;

export function fmtRoomScheduleOptM2(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(3);
}

export type DoorVm = {
  id: string;
  name: string;
  level: string;
  widthMm: number;
  familyKey: string;
};

export type WinVm = {
  id: string;
  name: string;
  level: string;
  widthMm: number;
  heightMm: number;
  sillMm: number;
  familyKey: string;
};

export function roomRowsFromServer(rows: Record<string, unknown>[]): RoomVm[] {
  return rows.map((r, i) => {
    const rawT = r.targetAreaM2 ?? r.target_area_m2;
    const rawD = r.areaDeltaM2 ?? r.area_delta_m2;
    const targetAreaM2 =
      rawT != null && rawT !== '' && Number.isFinite(Number(rawT)) ? Number(rawT) : null;
    const areaDeltaM2 =
      rawD != null && rawD !== '' && Number.isFinite(Number(rawD)) ? Number(rawD) : null;
    return {
      id: String(r.elementId ?? r.element_id ?? `srv-room-${i}`),
      name: String(r.name ?? ''),
      level: String(r.level ?? r.levelId ?? r.level_id ?? ''),
      areaM2: Number(r.areaM2 ?? r.area_m2 ?? 0),
      perM: Number(r.perimeterM ?? r.perimeter_m ?? 0),
      targetAreaM2,
      areaDeltaM2,
    };
  });
}

export function doorRowsFromServer(rows: Record<string, unknown>[]): DoorVm[] {
  return rows.map((r, i) => ({
    id: String(r.elementId ?? r.element_id ?? `srv-door-${i}`),
    name: String(r.name ?? ''),
    level: String(r.level ?? ''),
    widthMm: Number(r.widthMm ?? r.width_mm ?? 0),
    familyKey: String(r.familyTypeId ?? r.family_type_id ?? '—'),
  }));
}

export function winRowsFromServer(rows: Record<string, unknown>[]): WinVm[] {
  return rows.map((r, i) => ({
    id: String(r.elementId ?? r.element_id ?? `srv-win-${i}`),
    name: String(r.name ?? ''),
    level: String(r.level ?? ''),
    widthMm: Number(r.widthMm ?? r.width_mm ?? 0),
    heightMm: Number(r.heightMm ?? r.height_mm ?? 0),
    sillMm: Number(r.sillMm ?? r.sill_mm ?? 0),
    familyKey: String(r.familyTypeId ?? r.family_type_id ?? '—'),
  }));
}
