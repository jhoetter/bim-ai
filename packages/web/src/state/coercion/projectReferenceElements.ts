import type { Element } from '@bim-ai/core';

import { coerceNumber, coerceXY, coerceXYZ, type WireRecord } from './primitives';

type ReferencePlaneElement = Extract<Element, { kind: 'reference_plane' }>;
type PropertyLineElement = Extract<Element, { kind: 'property_line' }>;
type SelectionSetElement = Extract<Element, { kind: 'selection_set' }>;
type ProjectBasePointElement = Extract<Element, { kind: 'project_base_point' }>;
type SurveyPointElement = Extract<Element, { kind: 'survey_point' }>;
type ProjectReferenceElement =
  | ReferencePlaneElement
  | PropertyLineElement
  | SelectionSetElement
  | ProjectBasePointElement
  | SurveyPointElement;

function listOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

function coerceReferencePlane(id: string, name: string, raw: WireRecord): ReferencePlaneElement {
  const rawLevelId = raw.levelId ?? raw.level_id;
  if (rawLevelId != null && String(rawLevelId).length > 0) {
    return {
      kind: 'reference_plane',
      id,
      ...(typeof raw.name === 'string' && raw.name ? { name: raw.name } : {}),
      levelId: String(rawLevelId),
      startMm: coerceXY(raw.startMm ?? raw.start_mm ?? raw.start),
      endMm: coerceXY(raw.endMm ?? raw.end_mm ?? raw.end),
      ...(raw.isWorkPlane != null || raw.is_work_plane != null
        ? { isWorkPlane: Boolean(raw.isWorkPlane ?? raw.is_work_plane) }
        : {}),
      ...(raw.pinned != null ? { pinned: Boolean(raw.pinned) } : {}),
    };
  }

  return {
    kind: 'reference_plane',
    id,
    name,
    familyEditorId: String(raw.familyEditorId ?? raw.family_editor_id ?? ''),
    isVertical: Boolean(raw.isVertical ?? raw.is_vertical),
    offsetMm: coerceNumber(raw.offsetMm ?? raw.offset_mm, 0),
    ...(raw.isSymmetryRef != null || raw.is_symmetry_ref != null
      ? { isSymmetryRef: Boolean(raw.isSymmetryRef ?? raw.is_symmetry_ref) }
      : {}),
  };
}

function coercePropertyLine(id: string, raw: WireRecord): PropertyLineElement {
  const classification = raw.classification;
  const validClassification =
    classification === 'street' ||
    classification === 'rear' ||
    classification === 'side' ||
    classification === 'other'
      ? classification
      : undefined;

  return {
    kind: 'property_line',
    id,
    ...(typeof raw.name === 'string' && raw.name ? { name: raw.name } : {}),
    startMm: coerceXY(raw.startMm ?? raw.start_mm ?? raw.start),
    endMm: coerceXY(raw.endMm ?? raw.end_mm ?? raw.end),
    ...(raw.setbackMm != null || raw.setback_mm != null
      ? { setbackMm: coerceNumber(raw.setbackMm ?? raw.setback_mm, 0) }
      : {}),
    ...(validClassification ? { classification: validClassification } : {}),
    ...(raw.pinned != null ? { pinned: Boolean(raw.pinned) } : {}),
  };
}

function coerceSelectionSet(id: string, name: string, raw: WireRecord): SelectionSetElement {
  const rulesRaw = raw.filterRules ?? raw.filter_rules ?? [];
  const filterRules = Array.isArray(rulesRaw)
    ? rulesRaw
        .filter((rule): rule is WireRecord => rule != null && typeof rule === 'object')
        .map((rule) => ({
          field: (['category', 'level', 'typeName'].includes(rule.field as string)
            ? rule.field
            : 'category') as 'category' | 'level' | 'typeName',
          operator: (rule.operator === 'contains' ? 'contains' : 'equals') as 'equals' | 'contains',
          value: String(rule.value ?? ''),
        }))
    : [];
  return { kind: 'selection_set', id, name, filterRules };
}

export function coerceProjectReferenceElement(
  id: string,
  name: string,
  raw: WireRecord,
): ProjectReferenceElement | null {
  switch (raw.kind) {
    case 'reference_plane':
      return coerceReferencePlane(id, name, raw);
    case 'property_line':
      return coercePropertyLine(id, raw);
    case 'selection_set':
      return coerceSelectionSet(id, name, raw);
    case 'project_base_point':
      return {
        kind: 'project_base_point',
        id,
        positionMm: coerceXYZ(raw.positionMm ?? raw.position_mm),
        angleToTrueNorthDeg: coerceNumber(
          raw.angleToTrueNorthDeg ?? raw.angle_to_true_north_deg,
          0,
        ),
        clipped: Boolean(raw.clipped ?? false),
      };
    case 'survey_point':
      return {
        kind: 'survey_point',
        id,
        positionMm: coerceXYZ(raw.positionMm ?? raw.position_mm),
        sharedElevationMm: coerceNumber(raw.sharedElevationMm ?? raw.shared_elevation_mm, 0),
        clipped: Boolean(raw.clipped ?? false),
      };
    default:
      return null;
  }
}

export const projectReferenceStringList = listOfStrings;
