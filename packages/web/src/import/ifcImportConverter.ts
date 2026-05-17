/** §12.1.2 — Convert parsed IFC entities to bim-ai Element[]. */

import type { Element } from '@bim-ai/core';
import type { IfcEntity, IfcRef } from './ifcParser';

function isRef(v: unknown): v is IfcRef {
  return typeof v === 'object' && v !== null && 'ref' in v;
}

function getString(entity: IfcEntity, attrIdx: number): string | null {
  const v = entity.attrs[attrIdx];
  return typeof v === 'string' ? v : null;
}

function getNumber(entity: IfcEntity, attrIdx: number): number | null {
  const v = entity.attrs[attrIdx];
  return typeof v === 'number' ? v : null;
}

/**
 * Walk IFCEXTRUDEDAREASOLID shape tree to extract the length (XDim) of the
 * first IFCRECTANGLEPROFILEDEF found reachable from the given entity.
 *
 * Returns null when no usable profile is found.
 */
function extractLengthFromShape(entities: Map<number, IfcEntity>, shapeId: number): number | null {
  const shape = entities.get(shapeId);
  if (!shape) return null;

  // IFCEXTRUDEDAREASOLID: attr[0] = swept area (profile ref)
  if (shape.type === 'IFCEXTRUDEDAREASOLID') {
    const profileAttr = shape.attrs[0];
    if (isRef(profileAttr)) {
      const profile = entities.get(profileAttr.ref);
      if (profile && profile.type === 'IFCRECTANGLEPROFILEDEF') {
        // attr[3] = XDim (length), attr[4] = YDim (thickness)
        const xDim = getNumber(profile, 3);
        if (xDim != null) return xDim * 1000; // IFC metres → mm
      }
    }
    return null;
  }

  // IFCSHAPEREPRESENTATION: attr[3] = list of shape items
  if (shape.type === 'IFCSHAPEREPRESENTATION') {
    const items = shape.attrs[3];
    if (Array.isArray(items)) {
      for (const item of items) {
        if (isRef(item)) {
          const len = extractLengthFromShape(entities, item.ref);
          if (len != null) return len;
        }
      }
    }
    return null;
  }

  // IFCPRODUCTDEFINITIONSHAPE: attr[2] = list of representations
  if (shape.type === 'IFCPRODUCTDEFINITIONSHAPE') {
    const reps = shape.attrs[2];
    if (Array.isArray(reps)) {
      for (const rep of reps) {
        if (isRef(rep)) {
          const len = extractLengthFromShape(entities, rep.ref);
          if (len != null) return len;
        }
      }
    }
    return null;
  }

  return null;
}

/**
 * Build a map from IFC storey id → level element id for use when assigning
 * levelId to contained elements.
 *
 * We do a best-effort scan: look through IFCRELCONTAINEDINSPATIALSTRUCTURE
 * and IFCRELAGGREGATES to map element ids to their storey.
 */
function buildElementStoreyMap(
  entities: Map<number, IfcEntity>,
  storeyIdMap: Map<number, string>,
): Map<number, string> {
  const elementStorey = new Map<number, string>();

  for (const [, entity] of entities) {
    if (entity.type === 'IFCRELCONTAINEDINSPATIALSTRUCTURE') {
      // attr[4] = list of product refs, attr[5] = relating structure ref
      const products = entity.attrs[4];
      const structureAttr = entity.attrs[5];
      if (isRef(structureAttr) && Array.isArray(products)) {
        const levelElemId = storeyIdMap.get(structureAttr.ref);
        if (levelElemId) {
          for (const p of products) {
            if (isRef(p)) {
              elementStorey.set(p.ref, levelElemId);
            }
          }
        }
      }
    }
  }

  return elementStorey;
}

// ---------------------------------------------------------------------------
// Main converter
// ---------------------------------------------------------------------------

export function convertIfcToElements(entities: Map<number, IfcEntity>): Element[] {
  const elements: Element[] = [];

  // --- Pass 1: collect IFCBUILDINGSTOREY → create level elements
  // Map IFC entity id (number) → bim-ai level element id (string)
  const storeyToLevelId = new Map<number, string>();

  for (const [entityId, entity] of entities) {
    if (entity.type !== 'IFCBUILDINGSTOREY') continue;

    // IFCBUILDINGSTOREY attrs:
    // [0] GUID, [1] OwnerHistory, [2] Name, [3] Description,
    // [4] ObjectType, [5] ObjectPlacement, [6] Representation,
    // [7] LongName, [8] CompositionType, [9] Elevation (in metres)
    const name = getString(entity, 2) ?? getString(entity, 7) ?? 'Level';
    const elevationM = getNumber(entity, 9) ?? 0;
    const elevationMm = elevationM * 1000;

    const levelId = crypto.randomUUID();
    storeyToLevelId.set(entityId, levelId);

    elements.push({
      kind: 'level',
      id: levelId,
      name,
      elevationMm,
    });
  }

  // --- Build element → storey map for levelId assignment
  const elementStoreyMap = buildElementStoreyMap(entities, storeyToLevelId);

  // Fallback levelId: use first level or empty string
  const fallbackLevelId = elements.find((e) => e.kind === 'level')?.id ?? '';

  function levelIdForEntity(entityId: number): string {
    return elementStoreyMap.get(entityId) ?? fallbackLevelId;
  }

  // --- Pass 2: walls, slabs, spaces, doors, windows
  for (const [entityId, entity] of entities) {
    const { type } = entity;

    // ── Walls ──────────────────────────────────────────────────────────────
    if (type === 'IFCWALL' || type === 'IFCWALLSTANDARDCASE') {
      // IFC 2x3 IFCWALLSTANDARDCASE attrs:
      // [0] GlobalId, [1] OwnerHistory, [2] Name, [3] Description,
      // [4] ObjectType, [5] ObjectPlacement, [6] Representation, [7] Tag
      const name = getString(entity, 2) ?? 'Wall';

      // Try to extract length from shape
      const shapeAttr = entity.attrs[6];
      let lengthMm = 3000; // default fallback
      if (isRef(shapeAttr)) {
        const extracted = extractLengthFromShape(entities, shapeAttr.ref);
        if (extracted != null) lengthMm = extracted;
      }

      const levelId = levelIdForEntity(entityId);
      const id = crypto.randomUUID();

      elements.push({
        kind: 'wall',
        id,
        name,
        levelId,
        start: { xMm: 0, yMm: 0 },
        end: { xMm: lengthMm, yMm: 0 },
        thicknessMm: 200,
        heightMm: 3000,
      });
      continue;
    }

    // ── Slabs ──────────────────────────────────────────────────────────────
    if (type === 'IFCSLAB') {
      // attr[8] = PredefinedType enum string (e.g. '.FLOOR.' or '.ROOF.')
      const predType = getString(entity, 8) ?? entity.attrs[8];
      const predTypeStr = typeof predType === 'string' ? predType.toUpperCase() : '';
      if (!predTypeStr.includes('FLOOR') && predTypeStr !== '') continue; // only FLOOR slabs

      const name = getString(entity, 2) ?? 'Floor';
      const levelId = levelIdForEntity(entityId);
      const id = crypto.randomUUID();

      elements.push({
        kind: 'floor',
        id,
        name,
        levelId,
        boundaryMm: [],
        thicknessMm: 200,
      });
      continue;
    }

    // ── Spaces (rooms) ─────────────────────────────────────────────────────
    if (type === 'IFCSPACE') {
      // attr[2] = Name
      const name = getString(entity, 2) ?? getString(entity, 7) ?? 'Room';
      const levelId = levelIdForEntity(entityId);
      const id = crypto.randomUUID();

      elements.push({
        kind: 'room',
        id,
        name,
        levelId,
        outlineMm: [],
      });
      continue;
    }

    // ── Doors ──────────────────────────────────────────────────────────────
    if (type === 'IFCDOOR') {
      // IFC 2x3 IFCDOOR attrs:
      // [0] GlobalId, [1] OwnerHistory, [2] Name, [3] Description,
      // [4] ObjectType, [5] ObjectPlacement, [6] Representation, [7] Tag,
      // [8] OverallHeight (m), [9] OverallWidth (m)
      const name = getString(entity, 2) ?? 'Door';
      const levelId = levelIdForEntity(entityId);
      const id = crypto.randomUUID();

      const overallWidthM = getNumber(entity, 9);
      const widthMm = overallWidthM != null ? overallWidthM * 1000 : 900;

      elements.push({
        kind: 'door',
        id,
        name,
        levelId: levelId,
        wallId: '',
        alongT: 0.5,
        widthMm,
      });
      continue;
    }

    // ── Windows ────────────────────────────────────────────────────────────
    if (type === 'IFCWINDOW') {
      // IFC 2x3 IFCWINDOW attrs:
      // [0] GlobalId, [1] OwnerHistory, [2] Name, [3] Description,
      // [4] ObjectType, [5] ObjectPlacement, [6] Representation, [7] Tag,
      // [8] OverallHeight (m), [9] OverallWidth (m)
      const name = getString(entity, 2) ?? 'Window';
      const levelId = levelIdForEntity(entityId);
      const id = crypto.randomUUID();

      const overallWidthM = getNumber(entity, 9);
      const overallHeightM = getNumber(entity, 8);
      const widthMm = overallWidthM != null ? overallWidthM * 1000 : 1000;
      const heightMm = overallHeightM != null ? overallHeightM * 1000 : 1200;

      elements.push({
        kind: 'window',
        id,
        name,
        levelId: levelId,
        wallId: '',
        alongT: 0.5,
        widthMm,
        heightMm,
        sillHeightMm: 900,
      });
      continue;
    }

    // All other entity types are skipped.
  }

  return elements;
}
