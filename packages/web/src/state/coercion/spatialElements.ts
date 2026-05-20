import type { Element } from '@bim-ai/core';

import { coerceLoop, coerceNumber, coerceXY, type WireRecord } from './primitives';

type RoomElement = Extract<Element, { kind: 'room' }>;
type AreaElement = Extract<Element, { kind: 'area' }>;
type RoomSeparationElement = Extract<Element, { kind: 'room_separation' }>;
type PlanRegionElement = Extract<Element, { kind: 'plan_region' }>;
type SpatialElement = RoomElement | AreaElement | RoomSeparationElement | PlanRegionElement;

function coerceAreaScheme(raw: unknown): 'gross_building' | 'net' | 'rentable' {
  return raw === 'net' || raw === 'rentable' ? raw : 'gross_building';
}

function coerceComputedArea(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }
  return undefined;
}

function nullableNumber(raw: unknown): number | null | undefined {
  if (raw === null) return null;
  if (raw === undefined) return undefined;
  return coerceNumber(raw, 0);
}

function coerceRoom(id: string, name: string, raw: WireRecord): RoomElement {
  const outlineRaw = raw.outlineMm ?? raw.outline_mm ?? [];
  const targetAreaM2 = nullableNumber(raw.targetAreaM2 ?? raw.target_area_m2);
  const volumeM3 = nullableNumber(raw.volumeM3 ?? raw.volume_m3);
  return {
    kind: 'room',
    id,
    name,
    levelId: String(raw.levelId ?? raw.level_id ?? ''),
    outlineMm: Array.isArray(outlineRaw) ? outlineRaw.map(coerceXY) : [],
    ...(raw.upperLimitLevelId || raw.upper_limit_level_id
      ? { upperLimitLevelId: String(raw.upperLimitLevelId ?? raw.upper_limit_level_id) }
      : {}),
    ...(raw.volumeCeilingOffsetMm !== undefined || raw.volume_ceiling_offset_mm !== undefined
      ? {
          volumeCeilingOffsetMm: coerceNumber(
            raw.volumeCeilingOffsetMm ?? raw.volume_ceiling_offset_mm,
            0,
          ),
        }
      : {}),
    ...(typeof raw.programmeCode === 'string' || typeof raw.programme_code === 'string'
      ? { programmeCode: String(raw.programmeCode ?? raw.programme_code) }
      : {}),
    ...(typeof raw.department === 'string' ? { department: raw.department } : {}),
    ...(typeof raw.functionLabel === 'string' || typeof raw.function_label === 'string'
      ? { functionLabel: String(raw.functionLabel ?? raw.function_label) }
      : {}),
    ...(typeof raw.finishSet === 'string' || typeof raw.finish_set === 'string'
      ? { finishSet: String(raw.finishSet ?? raw.finish_set) }
      : {}),
    ...(targetAreaM2 !== undefined ? { targetAreaM2 } : {}),
    ...(volumeM3 !== undefined ? { volumeM3 } : {}),
    ...(typeof raw.roomFillOverrideHex === 'string' ||
    typeof raw.room_fill_override_hex === 'string'
      ? { roomFillOverrideHex: String(raw.roomFillOverrideHex ?? raw.room_fill_override_hex) }
      : {}),
    ...(typeof raw.roomFillPatternOverride === 'string' ||
    typeof raw.room_fill_pattern_override === 'string'
      ? {
          roomFillPatternOverride: String(
            raw.roomFillPatternOverride ?? raw.room_fill_pattern_override,
          ) as RoomElement['roomFillPatternOverride'],
        }
      : {}),
    ...(raw.phaseCreated || raw.phase_created
      ? { phaseCreated: String(raw.phaseCreated ?? raw.phase_created) }
      : {}),
    ...(raw.phaseDemolished || raw.phase_demolished
      ? { phaseDemolished: String(raw.phaseDemolished ?? raw.phase_demolished) }
      : {}),
    ...(raw.props && typeof raw.props === 'object' && !Array.isArray(raw.props)
      ? { props: raw.props as Record<string, unknown> }
      : {}),
  };
}

function coerceArea(id: string, name: string, raw: WireRecord): AreaElement {
  const ruleRaw = raw.ruleSet ?? raw.rule_set;
  const boundaryRaw = raw.boundaryMm ?? raw.boundary_mm;
  const computedAreaSqMm = coerceComputedArea(raw.computedAreaSqMm ?? raw.computed_area_sq_mm);
  return {
    kind: 'area',
    id,
    name,
    levelId: String(raw.levelId ?? raw.level_id ?? ''),
    boundaryMm: Array.isArray(boundaryRaw) ? boundaryRaw.map(coerceXY) : [],
    ruleSet: ruleRaw === 'gross' || ruleRaw === 'net' ? ruleRaw : 'no_rules',
    areaScheme: coerceAreaScheme(raw.areaScheme ?? raw.area_scheme),
    ...(computedAreaSqMm !== undefined ? { computedAreaSqMm } : {}),
    ...(raw.pinned != null ? { pinned: Boolean(raw.pinned) } : {}),
    phaseCreated: (raw.phaseCreated ?? raw.phase_created ?? null) as string | null,
    phaseDemolished: (raw.phaseDemolished ?? raw.phase_demolished ?? null) as string | null,
  };
}

export function coerceSpatialElement(
  id: string,
  name: string,
  raw: WireRecord,
): SpatialElement | null {
  switch (raw.kind) {
    case 'room':
      return coerceRoom(id, name, raw);
    case 'area':
      return coerceArea(id, name, raw);
    case 'room_separation':
      return {
        kind: 'room_separation',
        id,
        name,
        levelId: String(raw.levelId ?? raw.level_id ?? ''),
        start: coerceXY(raw.start ?? {}),
        end: coerceXY(raw.end ?? {}),
      };
    case 'plan_region':
      return {
        kind: 'plan_region',
        id,
        name,
        levelId: String(raw.levelId ?? raw.level_id ?? ''),
        outlineMm: coerceLoop(raw, 'outlineMm', 'outline_mm'),
        cutPlaneOffsetMm: coerceNumber(raw.cutPlaneOffsetMm ?? raw.cut_plane_offset_mm, -500),
      };
    default:
      return null;
  }
}
