import type { Element, XY } from '@bim-ai/core';

export interface IfcExportOptions {
  includeStructure?: boolean;
  coordinateSystem?: 'local' | 'wgs84';
}

// ---------------------------------------------------------------------------
// IFC entity ID counter
// ---------------------------------------------------------------------------

class IdCounter {
  private n = 0;
  next(): number {
    return ++this.n;
  }
  current(): number {
    return this.n;
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function guid(): string {
  // Produces a pseudo-random IFC GUID-style string (22 chars, base64url-ish).
  // IFC GUIDs are 22-character strings using a custom base64 alphabet.
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let result = '';
  for (let i = 0; i < 22; i++) {
    result += alphabet[Math.floor(Math.random() * 64)];
  }
  return result;
}

function ifcStr(s: string | null | undefined): string {
  if (s == null) return '$';
  return `'${s.replace(/'/g, "''")}'`;
}

function ifcRef(id: number): string {
  return `#${id}`;
}

function ifcRefList(ids: number[]): string {
  return `(${ids.map(ifcRef).join(',')})`;
}

function mm2m(mm: number): number {
  return mm / 1000;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function wallLength(start: XY, end: XY): number {
  const dx = end.xMm - start.xMm;
  const dy = end.yMm - start.yMm;
  return Math.sqrt(dx * dx + dy * dy);
}

function wallAngleDeg(start: XY, end: XY): number {
  const dx = end.xMm - start.xMm;
  const dy = end.yMm - start.yMm;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

// ---------------------------------------------------------------------------
// Low-level entity emitters
// ---------------------------------------------------------------------------

interface Lines {
  push(line: string): void;
}

function emitCartesianPoint(
  lines: Lines,
  ids: IdCounter,
  x: number,
  y: number,
  z?: number,
): number {
  const id = ids.next();
  if (z !== undefined) {
    lines.push(`#${id}=IFCCARTESIANPOINT((${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}));`);
  } else {
    lines.push(`#${id}=IFCCARTESIANPOINT((${x.toFixed(6)},${y.toFixed(6)}));`);
  }
  return id;
}

function emitDirection(lines: Lines, ids: IdCounter, x: number, y: number, z?: number): number {
  const id = ids.next();
  if (z !== undefined) {
    lines.push(`#${id}=IFCDIRECTION((${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}));`);
  } else {
    lines.push(`#${id}=IFCDIRECTION((${x.toFixed(6)},${y.toFixed(6)}));`);
  }
  return id;
}

function emitAxis2Placement3D(
  lines: Lines,
  ids: IdCounter,
  origin: number,
  axis?: number,
  refDir?: number,
): number {
  const id = ids.next();
  const axisStr = axis != null ? ifcRef(axis) : '$';
  const refStr = refDir != null ? ifcRef(refDir) : '$';
  lines.push(`#${id}=IFCAXIS2PLACEMENT3D(${ifcRef(origin)},${axisStr},${refStr});`);
  return id;
}

function emitLocalPlacement(
  lines: Lines,
  ids: IdCounter,
  placementRelTo: number | null,
  placement: number,
): number {
  const id = ids.next();
  const relStr = placementRelTo != null ? ifcRef(placementRelTo) : '$';
  lines.push(`#${id}=IFCLOCALPLACEMENT(${relStr},${ifcRef(placement)});`);
  return id;
}

function emitShapeRepresentation(
  lines: Lines,
  ids: IdCounter,
  contextId: number,
  identifier: string,
  type: string,
  itemIds: number[],
): number {
  const id = ids.next();
  lines.push(
    `#${id}=IFCSHAPEREPRESENTATION(${ifcRef(contextId)},${ifcStr(identifier)},${ifcStr(type)},${ifcRefList(itemIds)});`,
  );
  return id;
}

function emitProductDefinitionShape(lines: Lines, ids: IdCounter, repIds: number[]): number {
  const id = ids.next();
  lines.push(`#${id}=IFCPRODUCTDEFINITIONSHAPE($,$,${ifcRefList(repIds)});`);
  return id;
}

// ---------------------------------------------------------------------------
// Wall geometry: IFCEXTRUDEDAREASOLID
// ---------------------------------------------------------------------------

function emitWallBody(
  lines: Lines,
  ids: IdCounter,
  contextId: number,
  lengthMm: number,
  thicknessMm: number,
  heightMm: number,
): { shapeRepId: number; placementId: number } {
  // Profile: rectangle in local XZ (length × thickness)
  const profileOriginId = emitCartesianPoint(lines, ids, 0, 0);
  const profileXDirId = emitDirection(lines, ids, 1, 0);
  const profileYDirId = emitDirection(lines, ids, 0, 1);
  const profileAxisId = ids.next();
  lines.push(
    `#${profileAxisId}=IFCAXIS2PLACEMENT2D(${ifcRef(profileOriginId)},${ifcRef(profileXDirId)});`,
  );
  const profileId = ids.next();
  lines.push(
    `#${profileId}=IFCRECTANGLEPROFILEDEF(.AREA.,$,${ifcRef(profileAxisId)},${mm2m(lengthMm).toFixed(6)},${mm2m(thicknessMm).toFixed(6)});`,
  );

  // Extrusion placement (origin at wall base start)
  const extrusionOriginId = emitCartesianPoint(lines, ids, 0, 0, 0);
  const extrusionAxisId = emitDirection(lines, ids, 0, 0, 1);
  const extrusionRefId = emitDirection(lines, ids, 1, 0, 0);
  const extrusionPlacementId = emitAxis2Placement3D(
    lines,
    ids,
    extrusionOriginId,
    extrusionAxisId,
    extrusionRefId,
  );
  const extrusionDirId = emitDirection(lines, ids, 0, 0, 1);

  const solidId = ids.next();
  lines.push(
    `#${solidId}=IFCEXTRUDEDAREASOLID(${ifcRef(profileId)},${ifcRef(extrusionPlacementId)},${ifcRef(extrusionDirId)},${mm2m(heightMm).toFixed(6)});`,
  );

  // Local placement for the wall (placed at wall start, rotated by wall angle)
  const wallOriginId = emitCartesianPoint(lines, ids, 0, 0, 0);
  const wallAxisId = emitDirection(lines, ids, 0, 0, 1);
  const wallRefDirId = emitDirection(lines, ids, 1, 0, 0);
  const wallAxis2PlaceId = emitAxis2Placement3D(lines, ids, wallOriginId, wallAxisId, wallRefDirId);
  const placementId = emitLocalPlacement(lines, ids, null, wallAxis2PlaceId);

  const shapeRepId = emitShapeRepresentation(lines, ids, contextId, 'Body', 'SweptSolid', [
    solidId,
  ]);

  return { shapeRepId, placementId };
}

// ---------------------------------------------------------------------------
// Bounding-box body for non-wall elements
// ---------------------------------------------------------------------------

function emitBBoxBody(
  lines: Lines,
  ids: IdCounter,
  contextId: number,
  widthMm: number,
  depthMm: number,
  heightMm: number,
  originXm: number,
  originYm: number,
  originZm: number,
): { shapeRepId: number; placementId: number } {
  const profileOriginId = emitCartesianPoint(lines, ids, 0, 0);
  const profileXDirId = emitDirection(lines, ids, 1, 0);
  const profileAxisId = ids.next();
  lines.push(
    `#${profileAxisId}=IFCAXIS2PLACEMENT2D(${ifcRef(profileOriginId)},${ifcRef(profileXDirId)});`,
  );
  const profileId = ids.next();
  lines.push(
    `#${profileId}=IFCRECTANGLEPROFILEDEF(.AREA.,$,${ifcRef(profileAxisId)},${mm2m(widthMm).toFixed(6)},${mm2m(depthMm).toFixed(6)});`,
  );

  const extrusionOriginId = emitCartesianPoint(lines, ids, 0, 0, 0);
  const extrusionAxisId = emitDirection(lines, ids, 0, 0, 1);
  const extrusionRefId = emitDirection(lines, ids, 1, 0, 0);
  const extrusionPlacementId = emitAxis2Placement3D(
    lines,
    ids,
    extrusionOriginId,
    extrusionAxisId,
    extrusionRefId,
  );
  const extrusionDirId = emitDirection(lines, ids, 0, 0, 1);

  const solidId = ids.next();
  lines.push(
    `#${solidId}=IFCEXTRUDEDAREASOLID(${ifcRef(profileId)},${ifcRef(extrusionPlacementId)},${ifcRef(extrusionDirId)},${mm2m(Math.max(heightMm, 1)).toFixed(6)});`,
  );

  const originId = emitCartesianPoint(lines, ids, originXm, originYm, originZm);
  const axisId = emitDirection(lines, ids, 0, 0, 1);
  const refDirId = emitDirection(lines, ids, 1, 0, 0);
  const axis2PlaceId = emitAxis2Placement3D(lines, ids, originId, axisId, refDirId);
  const placementId = emitLocalPlacement(lines, ids, null, axis2PlaceId);

  const shapeRepId = emitShapeRepresentation(lines, ids, contextId, 'Body', 'SweptSolid', [
    solidId,
  ]);

  return { shapeRepId, placementId };
}

// ---------------------------------------------------------------------------
// Polygon-based floor/roof body
// ---------------------------------------------------------------------------

function emitPolyBody(
  lines: Lines,
  ids: IdCounter,
  contextId: number,
  boundaryMm: XY[],
  thicknessMm: number,
  elevationMm: number,
): { shapeRepId: number; placementId: number } {
  // Build polyline profile
  const pointIds = boundaryMm.map((p) => emitCartesianPoint(lines, ids, mm2m(p.xMm), mm2m(p.yMm)));
  // close the polyline by repeating first point
  pointIds.push(pointIds[0]);
  const polylineId = ids.next();
  lines.push(`#${polylineId}=IFCPOLYLINE(${ifcRefList(pointIds)});`);
  const profileId = ids.next();
  lines.push(`#${profileId}=IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${ifcRef(polylineId)});`);

  const extrusionOriginId = emitCartesianPoint(lines, ids, 0, 0, 0);
  const extrusionAxisId = emitDirection(lines, ids, 0, 0, 1);
  const extrusionRefId = emitDirection(lines, ids, 1, 0, 0);
  const extrusionPlacementId = emitAxis2Placement3D(
    lines,
    ids,
    extrusionOriginId,
    extrusionAxisId,
    extrusionRefId,
  );
  const extrusionDirId = emitDirection(lines, ids, 0, 0, 1);
  const solidId = ids.next();
  const extrusionDepth = Math.max(thicknessMm, 1);
  lines.push(
    `#${solidId}=IFCEXTRUDEDAREASOLID(${ifcRef(profileId)},${ifcRef(extrusionPlacementId)},${ifcRef(extrusionDirId)},${mm2m(extrusionDepth).toFixed(6)});`,
  );

  const originId = emitCartesianPoint(lines, ids, 0, 0, mm2m(elevationMm));
  const axisId = emitDirection(lines, ids, 0, 0, 1);
  const refDirId = emitDirection(lines, ids, 1, 0, 0);
  const axis2PlaceId = emitAxis2Placement3D(lines, ids, originId, axisId, refDirId);
  const placementId = emitLocalPlacement(lines, ids, null, axis2PlaceId);

  const shapeRepId = emitShapeRepresentation(lines, ids, contextId, 'Body', 'SweptSolid', [
    solidId,
  ]);
  return { shapeRepId, placementId };
}

// ---------------------------------------------------------------------------
// Main exporter
// ---------------------------------------------------------------------------

export function exportToIfc(
  elementsById: Record<string, Element>,
  _opts?: IfcExportOptions,
): string {
  const lines: string[] = [];
  const ids = new IdCounter();

  const now = new Date().toISOString().replace(/\.\d+Z$/, '');

  // -------------------------------------------------------------------------
  // HEADER
  // -------------------------------------------------------------------------
  lines.push('ISO-10303-21;');
  lines.push('HEADER;');
  lines.push(`FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');`);
  lines.push(`FILE_NAME('project.ifc','${now}',(''),(''),'','bim-ai','');`);
  lines.push(`FILE_SCHEMA(('IFC2X3'));`);
  lines.push('ENDSEC;');
  lines.push('DATA;');

  const dataLines: string[] = [];

  // -------------------------------------------------------------------------
  // Shared geometric context
  // -------------------------------------------------------------------------
  const originId = emitCartesianPoint(dataLines, ids, 0, 0, 0);
  const zDirId = emitDirection(dataLines, ids, 0, 0, 1);
  const xDirId = emitDirection(dataLines, ids, 1, 0, 0);
  const worldPlacementId = emitAxis2Placement3D(dataLines, ids, originId, zDirId, xDirId);

  const geoContextId = ids.next();
  dataLines.push(
    `#${geoContextId}=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${ifcRef(worldPlacementId)},$);`,
  );

  // -------------------------------------------------------------------------
  // Units
  // -------------------------------------------------------------------------
  const lengthUnitId = ids.next();
  dataLines.push(`#${lengthUnitId}=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);`);
  const areaUnitId = ids.next();
  dataLines.push(`#${areaUnitId}=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);`);
  const volumeUnitId = ids.next();
  dataLines.push(`#${volumeUnitId}=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);`);
  const unitAssignmentId = ids.next();
  dataLines.push(
    `#${unitAssignmentId}=IFCUNITASSIGNMENT(${ifcRefList([lengthUnitId, areaUnitId, volumeUnitId])});`,
  );

  // -------------------------------------------------------------------------
  // Project hierarchy: IFCPROJECT → IFCSITE → IFCBUILDING → IFCBUILDINGSTOREY
  // -------------------------------------------------------------------------
  const projectId = ids.next();
  dataLines.push(
    `#${projectId}=IFCPROJECT('${guid()}',$,'bim-ai Project',$,$,$,$,${ifcRefList([geoContextId])},${ifcRef(unitAssignmentId)});`,
  );

  // Site
  const siteOriginId = emitCartesianPoint(dataLines, ids, 0, 0, 0);
  const siteAxisId = emitDirection(dataLines, ids, 0, 0, 1);
  const siteRefId = emitDirection(dataLines, ids, 1, 0, 0);
  const sitePlacementAxis = emitAxis2Placement3D(
    dataLines,
    ids,
    siteOriginId,
    siteAxisId,
    siteRefId,
  );
  const siteLocalPlaceId = emitLocalPlacement(dataLines, ids, null, sitePlacementAxis);
  const siteId = ids.next();
  dataLines.push(
    `#${siteId}=IFCSITE('${guid()}',$,'Site',$,$,${ifcRef(siteLocalPlaceId)},$,$,.ELEMENT.,$,$,$,$,$);`,
  );

  // Building
  const bldgOriginId = emitCartesianPoint(dataLines, ids, 0, 0, 0);
  const bldgAxisId = emitDirection(dataLines, ids, 0, 0, 1);
  const bldgRefId = emitDirection(dataLines, ids, 1, 0, 0);
  const bldgPlacementAxis = emitAxis2Placement3D(
    dataLines,
    ids,
    bldgOriginId,
    bldgAxisId,
    bldgRefId,
  );
  const bldgLocalPlaceId = emitLocalPlacement(dataLines, ids, siteLocalPlaceId, bldgPlacementAxis);
  const buildingId = ids.next();
  dataLines.push(
    `#${buildingId}=IFCBUILDING('${guid()}',$,'Building',$,$,${ifcRef(bldgLocalPlaceId)},$,$,.ELEMENT.,$,$,$);`,
  );

  // -------------------------------------------------------------------------
  // Collect elements by kind
  // -------------------------------------------------------------------------
  const elements = Object.values(elementsById);

  const levels = elements.filter((e) => e.kind === 'level') as Extract<
    Element,
    { kind: 'level' }
  >[];
  const walls = elements.filter((e) => e.kind === 'wall') as Extract<Element, { kind: 'wall' }>[];
  const doors = elements.filter((e) => e.kind === 'door') as Extract<Element, { kind: 'door' }>[];
  const windows = elements.filter((e) => e.kind === 'window') as Extract<
    Element,
    { kind: 'window' }
  >[];
  const floors = elements.filter((e) => e.kind === 'floor') as Extract<
    Element,
    { kind: 'floor' }
  >[];
  const roofs = elements.filter((e) => e.kind === 'roof') as Extract<Element, { kind: 'roof' }>[];
  const rooms = elements.filter((e) => e.kind === 'room') as Extract<Element, { kind: 'room' }>[];

  // Map level element id → IFC storey id
  const levelIfcId: Record<string, number> = {};
  // Map level element id → elevationMm
  const levelElevation: Record<string, number> = {};

  // -------------------------------------------------------------------------
  // IFCBUILDINGSTOREY for each level
  // -------------------------------------------------------------------------
  const storeyIds: number[] = [];
  for (const level of levels) {
    levelElevation[level.id] = level.elevationMm;
    const elevM = mm2m(level.elevationMm);

    const lvlOriginId = emitCartesianPoint(dataLines, ids, 0, 0, elevM);
    const lvlAxisId = emitDirection(dataLines, ids, 0, 0, 1);
    const lvlRefId = emitDirection(dataLines, ids, 1, 0, 0);
    const lvlAxis2PlaceId = emitAxis2Placement3D(dataLines, ids, lvlOriginId, lvlAxisId, lvlRefId);
    const lvlLocalPlaceId = emitLocalPlacement(dataLines, ids, bldgLocalPlaceId, lvlAxis2PlaceId);

    const storeyId = ids.next();
    levelIfcId[level.id] = storeyId;
    storeyIds.push(storeyId);
    dataLines.push(
      `#${storeyId}=IFCBUILDINGSTOREY('${guid()}',$,${ifcStr(level.name)},$,$,${ifcRef(lvlLocalPlaceId)},$,$,.ELEMENT.,${elevM.toFixed(6)});`,
    );
  }

  // -------------------------------------------------------------------------
  // Map wall element id → IFC wall id (needed for door/window void references)
  // -------------------------------------------------------------------------
  const wallIfcId: Record<string, number> = {};
  const wallIfcPlaceId: Record<string, number> = {};

  // -------------------------------------------------------------------------
  // IFCWALLSTANDARDCASE for each wall
  // -------------------------------------------------------------------------
  const wallProductIds: number[] = [];
  for (const wall of walls) {
    const lengthMm = wallLength(wall.start, wall.end);
    const angleDeg = wallAngleDeg(wall.start, wall.end);
    const angleRad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const elevMm = levelElevation[wall.levelId] ?? 0;

    // Profile and extruded solid
    const profileOriginId = emitCartesianPoint(dataLines, ids, 0, 0);
    const profileXDirId = emitDirection(dataLines, ids, 1, 0);
    const profileAxisId = ids.next();
    dataLines.push(
      `#${profileAxisId}=IFCAXIS2PLACEMENT2D(${ifcRef(profileOriginId)},${ifcRef(profileXDirId)});`,
    );
    const profileId = ids.next();
    dataLines.push(
      `#${profileId}=IFCRECTANGLEPROFILEDEF(.AREA.,$,${ifcRef(profileAxisId)},${mm2m(lengthMm).toFixed(6)},${mm2m(wall.thicknessMm).toFixed(6)});`,
    );
    const extOriginId = emitCartesianPoint(dataLines, ids, 0, 0, 0);
    const extAxisId = emitDirection(dataLines, ids, 0, 0, 1);
    const extRefId = emitDirection(dataLines, ids, 1, 0, 0);
    const extPlaceId = emitAxis2Placement3D(dataLines, ids, extOriginId, extAxisId, extRefId);
    const extDirId = emitDirection(dataLines, ids, 0, 0, 1);
    const solidId = ids.next();
    dataLines.push(
      `#${solidId}=IFCEXTRUDEDAREASOLID(${ifcRef(profileId)},${ifcRef(extPlaceId)},${ifcRef(extDirId)},${mm2m(wall.heightMm).toFixed(6)});`,
    );

    // Wall placement: origin at wall start, rotated by wall angle
    const wallOriginId = emitCartesianPoint(
      dataLines,
      ids,
      mm2m(wall.start.xMm),
      mm2m(wall.start.yMm),
      mm2m(elevMm),
    );
    const wallAxisId = emitDirection(dataLines, ids, 0, 0, 1);
    const wallRefId = emitDirection(dataLines, ids, cosA, sinA, 0);
    const wallAxis2PlaceId = emitAxis2Placement3D(
      dataLines,
      ids,
      wallOriginId,
      wallAxisId,
      wallRefId,
    );
    const wallLocalPlaceId = emitLocalPlacement(dataLines, ids, null, wallAxis2PlaceId);
    wallIfcPlaceId[wall.id] = wallLocalPlaceId;

    const shapeRepId = emitShapeRepresentation(dataLines, ids, geoContextId, 'Body', 'SweptSolid', [
      solidId,
    ]);
    const productShapeId = emitProductDefinitionShape(dataLines, ids, [shapeRepId]);

    const wallIfcEntityId = ids.next();
    wallIfcId[wall.id] = wallIfcEntityId;
    wallProductIds.push(wallIfcEntityId);
    dataLines.push(
      `#${wallIfcEntityId}=IFCWALLSTANDARDCASE('${guid()}',$,${ifcStr(wall.name)},$,$,${ifcRef(wallLocalPlaceId)},${ifcRef(productShapeId)},$);`,
    );
  }

  // -------------------------------------------------------------------------
  // IFCDOOR + IFCOPENINGELEMENT + IFCRELVOIDSELEMENT
  // -------------------------------------------------------------------------
  const doorProductIds: number[] = [];
  const openingElementIds: number[] = [];

  for (const door of doors) {
    const hostWallId = door.wallId;
    const hostWall = elementsById[hostWallId] as Extract<Element, { kind: 'wall' }> | undefined;
    const elevMm = hostWall ? (levelElevation[hostWall.levelId] ?? 0) : 0;
    const widthMm = door.widthMm;
    const heightMm = 2100; // default door height (no heightMm on door type)

    // Opening element placement
    const openOriginId = emitCartesianPoint(dataLines, ids, 0, 0, mm2m(elevMm));
    const openAxisId = emitDirection(dataLines, ids, 0, 0, 1);
    const openRefId = emitDirection(dataLines, ids, 1, 0, 0);
    const openAxis2PlaceId = emitAxis2Placement3D(
      dataLines,
      ids,
      openOriginId,
      openAxisId,
      openRefId,
    );
    const openLocalPlaceId = emitLocalPlacement(dataLines, ids, null, openAxis2PlaceId);

    // Opening shape (bbox)
    const openProfileOriginId = emitCartesianPoint(dataLines, ids, 0, 0);
    const openProfileXDirId = emitDirection(dataLines, ids, 1, 0);
    const openProfileAxisId = ids.next();
    dataLines.push(
      `#${openProfileAxisId}=IFCAXIS2PLACEMENT2D(${ifcRef(openProfileOriginId)},${ifcRef(openProfileXDirId)});`,
    );
    const openProfileId = ids.next();
    const hostThicknessMm = hostWall?.thicknessMm ?? 200;
    dataLines.push(
      `#${openProfileId}=IFCRECTANGLEPROFILEDEF(.AREA.,$,${ifcRef(openProfileAxisId)},${mm2m(widthMm).toFixed(6)},${mm2m(hostThicknessMm).toFixed(6)});`,
    );
    const openExtOriginId = emitCartesianPoint(dataLines, ids, 0, 0, 0);
    const openExtAxisId = emitDirection(dataLines, ids, 0, 0, 1);
    const openExtRefId = emitDirection(dataLines, ids, 1, 0, 0);
    const openExtPlaceId = emitAxis2Placement3D(
      dataLines,
      ids,
      openExtOriginId,
      openExtAxisId,
      openExtRefId,
    );
    const openExtDirId = emitDirection(dataLines, ids, 0, 0, 1);
    const openSolidId = ids.next();
    dataLines.push(
      `#${openSolidId}=IFCEXTRUDEDAREASOLID(${ifcRef(openProfileId)},${ifcRef(openExtPlaceId)},${ifcRef(openExtDirId)},${mm2m(heightMm).toFixed(6)});`,
    );
    const openShapeRepId = emitShapeRepresentation(
      dataLines,
      ids,
      geoContextId,
      'Body',
      'SweptSolid',
      [openSolidId],
    );
    const openProductShapeId = emitProductDefinitionShape(dataLines, ids, [openShapeRepId]);

    const openingId = ids.next();
    openingElementIds.push(openingId);
    dataLines.push(
      `#${openingId}=IFCOPENINGELEMENT('${guid()}',$,'Opening',$,$,${ifcRef(openLocalPlaceId)},${ifcRef(openProductShapeId)},$);`,
    );

    // RelVoidsElement (host wall voids)
    if (hostWallId && wallIfcId[hostWallId]) {
      const relVoidId = ids.next();
      dataLines.push(
        `#${relVoidId}=IFCRELVOIDSELEMENT('${guid()}',$,$,$,${ifcRef(wallIfcId[hostWallId])},${ifcRef(openingId)});`,
      );
    }

    // Door placement
    const doorOriginId = emitCartesianPoint(dataLines, ids, 0, 0, mm2m(elevMm));
    const doorAxisId = emitDirection(dataLines, ids, 0, 0, 1);
    const doorRefId = emitDirection(dataLines, ids, 1, 0, 0);
    const doorAxis2PlaceId = emitAxis2Placement3D(
      dataLines,
      ids,
      doorOriginId,
      doorAxisId,
      doorRefId,
    );
    const doorLocalPlaceId = emitLocalPlacement(dataLines, ids, null, doorAxis2PlaceId);

    const doorId = ids.next();
    doorProductIds.push(doorId);
    dataLines.push(
      `#${doorId}=IFCDOOR('${guid()}',$,${ifcStr(door.name)},$,$,${ifcRef(doorLocalPlaceId)},$,$,${mm2m(heightMm).toFixed(6)},${mm2m(widthMm).toFixed(6)});`,
    );

    // RelFillsElement (door fills opening)
    const relFillId = ids.next();
    dataLines.push(
      `#${relFillId}=IFCRELFILLSELEMENT('${guid()}',$,$,$,${ifcRef(openingId)},${ifcRef(doorId)});`,
    );
  }

  // -------------------------------------------------------------------------
  // IFCWINDOW + IFCOPENINGELEMENT + IFCRELVOIDSELEMENT
  // -------------------------------------------------------------------------
  const windowProductIds: number[] = [];

  for (const win of windows) {
    const hostWallId = win.wallId;
    const hostWall = elementsById[hostWallId] as Extract<Element, { kind: 'wall' }> | undefined;
    const elevMm = hostWall ? (levelElevation[hostWall.levelId] ?? 0) : 0;
    const sillMm = win.sillHeightMm;
    const widthMm = win.widthMm;
    const heightMm = win.heightMm;

    // Opening element
    const openOriginId = emitCartesianPoint(dataLines, ids, 0, 0, mm2m(elevMm + sillMm));
    const openAxisId = emitDirection(dataLines, ids, 0, 0, 1);
    const openRefId = emitDirection(dataLines, ids, 1, 0, 0);
    const openAxis2PlaceId = emitAxis2Placement3D(
      dataLines,
      ids,
      openOriginId,
      openAxisId,
      openRefId,
    );
    const openLocalPlaceId = emitLocalPlacement(dataLines, ids, null, openAxis2PlaceId);

    const openProfileOriginId = emitCartesianPoint(dataLines, ids, 0, 0);
    const openProfileXDirId = emitDirection(dataLines, ids, 1, 0);
    const openProfileAxisId = ids.next();
    dataLines.push(
      `#${openProfileAxisId}=IFCAXIS2PLACEMENT2D(${ifcRef(openProfileOriginId)},${ifcRef(openProfileXDirId)});`,
    );
    const openProfileId = ids.next();
    const hostThicknessMm = hostWall?.thicknessMm ?? 200;
    dataLines.push(
      `#${openProfileId}=IFCRECTANGLEPROFILEDEF(.AREA.,$,${ifcRef(openProfileAxisId)},${mm2m(widthMm).toFixed(6)},${mm2m(hostThicknessMm).toFixed(6)});`,
    );
    const openExtOriginId = emitCartesianPoint(dataLines, ids, 0, 0, 0);
    const openExtAxisId = emitDirection(dataLines, ids, 0, 0, 1);
    const openExtRefId = emitDirection(dataLines, ids, 1, 0, 0);
    const openExtPlaceId = emitAxis2Placement3D(
      dataLines,
      ids,
      openExtOriginId,
      openExtAxisId,
      openExtRefId,
    );
    const openExtDirId = emitDirection(dataLines, ids, 0, 0, 1);
    const openSolidId = ids.next();
    dataLines.push(
      `#${openSolidId}=IFCEXTRUDEDAREASOLID(${ifcRef(openProfileId)},${ifcRef(openExtPlaceId)},${ifcRef(openExtDirId)},${mm2m(heightMm).toFixed(6)});`,
    );
    const openShapeRepId = emitShapeRepresentation(
      dataLines,
      ids,
      geoContextId,
      'Body',
      'SweptSolid',
      [openSolidId],
    );
    const openProductShapeId = emitProductDefinitionShape(dataLines, ids, [openShapeRepId]);

    const openingId = ids.next();
    openingElementIds.push(openingId);
    dataLines.push(
      `#${openingId}=IFCOPENINGELEMENT('${guid()}',$,'Opening',$,$,${ifcRef(openLocalPlaceId)},${ifcRef(openProductShapeId)},$);`,
    );

    if (hostWallId && wallIfcId[hostWallId]) {
      const relVoidId = ids.next();
      dataLines.push(
        `#${relVoidId}=IFCRELVOIDSELEMENT('${guid()}',$,$,$,${ifcRef(wallIfcId[hostWallId])},${ifcRef(openingId)});`,
      );
    }

    // Window placement
    const winOriginId = emitCartesianPoint(dataLines, ids, 0, 0, mm2m(elevMm + sillMm));
    const winAxisId = emitDirection(dataLines, ids, 0, 0, 1);
    const winRefId = emitDirection(dataLines, ids, 1, 0, 0);
    const winAxis2PlaceId = emitAxis2Placement3D(dataLines, ids, winOriginId, winAxisId, winRefId);
    const winLocalPlaceId = emitLocalPlacement(dataLines, ids, null, winAxis2PlaceId);

    const windowId = ids.next();
    windowProductIds.push(windowId);
    dataLines.push(
      `#${windowId}=IFCWINDOW('${guid()}',$,${ifcStr(win.name)},$,$,${ifcRef(winLocalPlaceId)},$,$,${mm2m(heightMm).toFixed(6)},${mm2m(widthMm).toFixed(6)});`,
    );

    const relFillId = ids.next();
    dataLines.push(
      `#${relFillId}=IFCRELFILLSELEMENT('${guid()}',$,$,$,${ifcRef(openingId)},${ifcRef(windowId)});`,
    );
  }

  // -------------------------------------------------------------------------
  // IFCSLAB (floor)
  // -------------------------------------------------------------------------
  const floorSlabIds: number[] = [];
  for (const floor of floors) {
    const elevMm = levelElevation[floor.levelId] ?? 0;
    const { shapeRepId, placementId } = emitPolyBody(
      dataLines,
      ids,
      geoContextId,
      floor.boundaryMm,
      floor.thicknessMm,
      elevMm,
    );
    const productShapeId = emitProductDefinitionShape(dataLines, ids, [shapeRepId]);
    const slabId = ids.next();
    floorSlabIds.push(slabId);
    dataLines.push(
      `#${slabId}=IFCSLAB('${guid()}',$,${ifcStr(floor.name)},$,$,${ifcRef(placementId)},${ifcRef(productShapeId)},$,.FLOOR.);`,
    );
  }

  // -------------------------------------------------------------------------
  // IFCSLAB (roof)
  // -------------------------------------------------------------------------
  const roofSlabIds: number[] = [];
  for (const roof of roofs) {
    const footprint = roof.footprintMm ?? [];
    const elevMm = levelElevation[roof.referenceLevelId] ?? 0;
    const thicknessMm = 300; // default

    if (footprint.length >= 3) {
      const { shapeRepId, placementId } = emitPolyBody(
        dataLines,
        ids,
        geoContextId,
        footprint,
        thicknessMm,
        elevMm,
      );
      const productShapeId = emitProductDefinitionShape(dataLines, ids, [shapeRepId]);
      const slabId = ids.next();
      roofSlabIds.push(slabId);
      dataLines.push(
        `#${slabId}=IFCSLAB('${guid()}',$,${ifcStr(roof.name)},$,$,${ifcRef(placementId)},${ifcRef(productShapeId)},$,.ROOF.);`,
      );
    } else {
      // No footprint geometry; emit a minimal placement
      const placeholderOriginId = emitCartesianPoint(dataLines, ids, 0, 0, mm2m(elevMm));
      const placeholderAxisId = emitDirection(dataLines, ids, 0, 0, 1);
      const placeholderRefId = emitDirection(dataLines, ids, 1, 0, 0);
      const placeholderAxis2PlaceId = emitAxis2Placement3D(
        dataLines,
        ids,
        placeholderOriginId,
        placeholderAxisId,
        placeholderRefId,
      );
      const placeholderPlaceId = emitLocalPlacement(dataLines, ids, null, placeholderAxis2PlaceId);
      const slabId = ids.next();
      roofSlabIds.push(slabId);
      dataLines.push(
        `#${slabId}=IFCSLAB('${guid()}',$,${ifcStr(roof.name)},$,$,${ifcRef(placeholderPlaceId)},$,$,.ROOF.);`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // IFCSPACE (room)
  // -------------------------------------------------------------------------
  const spaceIds: number[] = [];
  for (const room of rooms) {
    const elevMm = levelElevation[room.levelId] ?? 0;
    const outline = room.outlineMm ?? [];
    const thicknessMm = 2800; // default room height

    if (outline.length >= 3) {
      const { shapeRepId, placementId } = emitPolyBody(
        dataLines,
        ids,
        geoContextId,
        outline,
        thicknessMm,
        elevMm,
      );
      const productShapeId = emitProductDefinitionShape(dataLines, ids, [shapeRepId]);
      const spaceId = ids.next();
      spaceIds.push(spaceId);
      dataLines.push(
        `#${spaceId}=IFCSPACE('${guid()}',$,${ifcStr(room.name)},$,$,${ifcRef(placementId)},${ifcRef(productShapeId)},$,.ELEMENT.,$);`,
      );
    } else {
      const spaceOriginId = emitCartesianPoint(dataLines, ids, 0, 0, mm2m(elevMm));
      const spaceAxisId = emitDirection(dataLines, ids, 0, 0, 1);
      const spaceRefId = emitDirection(dataLines, ids, 1, 0, 0);
      const spaceAxis2PlaceId = emitAxis2Placement3D(
        dataLines,
        ids,
        spaceOriginId,
        spaceAxisId,
        spaceRefId,
      );
      const spaceLocalPlaceId = emitLocalPlacement(dataLines, ids, null, spaceAxis2PlaceId);
      const spaceId = ids.next();
      spaceIds.push(spaceId);
      dataLines.push(
        `#${spaceId}=IFCSPACE('${guid()}',$,${ifcStr(room.name)},$,$,${ifcRef(spaceLocalPlaceId)},$,$,.ELEMENT.,$);`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Spatial structure relationships
  // -------------------------------------------------------------------------

  // Project → Site
  const relProjectSiteId = ids.next();
  dataLines.push(
    `#${relProjectSiteId}=IFCRELAGGREGATES('${guid()}',$,$,$,${ifcRef(projectId)},${ifcRefList([siteId])});`,
  );

  // Site → Building
  const relSiteBuildingId = ids.next();
  dataLines.push(
    `#${relSiteBuildingId}=IFCRELAGGREGATES('${guid()}',$,$,$,${ifcRef(siteId)},${ifcRefList([buildingId])});`,
  );

  // Building → Storeys
  if (storeyIds.length > 0) {
    const relBuildingStoreysId = ids.next();
    dataLines.push(
      `#${relBuildingStoreysId}=IFCRELAGGREGATES('${guid()}',$,$,$,${ifcRef(buildingId)},${ifcRefList(storeyIds)});`,
    );
  }

  // Contained elements in building (walls, doors, windows, slabs, spaces)
  const allProductIds = [
    ...wallProductIds,
    ...doorProductIds,
    ...windowProductIds,
    ...floorSlabIds,
    ...roofSlabIds,
    ...spaceIds,
  ];
  if (allProductIds.length > 0) {
    const relContainedId = ids.next();
    dataLines.push(
      `#${relContainedId}=IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',$,$,$,${ifcRefList(allProductIds)},${ifcRef(buildingId)});`,
    );
  }

  // -------------------------------------------------------------------------
  // Write data lines and footer
  // -------------------------------------------------------------------------
  for (const line of dataLines) {
    lines.push(line);
  }

  lines.push('ENDSEC;');
  lines.push('END-ISO-10303-21;');

  return lines.join('\n');
}
