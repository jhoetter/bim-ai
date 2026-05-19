import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const TARGET_HOUSE_GEOMETRY_DIAGNOSTIC_SCHEMA_VERSION =
  'target-house-current-geometry-diagnostic.v1';

const DEFAULT_TARGET_ID = 'target-house-1';
const MM_EPSILON = 1;
const CONNECT_TOLERANCE_MM = 25;
const ROOM_AREA_TOLERANCE_RATIO = 0.15;

const PHYSICAL_AND_SKETCH_KINDS = new Set([
  'door',
  'floor',
  'placed_asset',
  'railing',
  'roof',
  'roof_opening',
  'room',
  'room_separation',
  'slab_opening',
  'stair',
  'sweep',
  'wall',
  'wall_opening',
  'window',
]);

const HELPER_LEAK_PREFIXES = ['access-wall-', 'access-door-'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function elementsById(snapshot) {
  if (!isObject(snapshot?.elements)) return {};
  return snapshot.elements;
}

function sortedElements(snapshot) {
  return Object.values(elementsById(snapshot)).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function pointsFrom(value) {
  if (!isObject(value)) return [];
  const points = [];
  for (const key of [
    'start',
    'end',
    'positionMm',
    'runStartMm',
    'runEndMm',
    'lineStartMm',
    'lineEndMm',
  ]) {
    if (isObject(value[key])) points.push(value[key]);
  }
  for (const key of [
    'boundaryMm',
    'footprintMm',
    'outlineMm',
    'pathMm',
    'segmentedPathMm',
    'treadLines',
  ]) {
    for (const point of asArray(value[key])) {
      if (isObject(point)) points.push(point);
      if (Array.isArray(point)) points.push(...point.filter(isObject));
    }
  }
  for (const run of asArray(value.runs)) {
    if (isObject(run.startMm)) points.push(run.startMm);
    if (isObject(run.endMm)) points.push(run.endMm);
    points.push(...asArray(run.polylineMm).filter(isObject));
  }
  return points.filter(
    (point) => Number.isFinite(point.xMm) && Number.isFinite(point.yMm),
  );
}

function boundsForPoints(points) {
  if (points.length === 0) return null;
  return {
    minX: Math.min(...points.map((point) => point.xMm)),
    minY: Math.min(...points.map((point) => point.yMm)),
    maxX: Math.max(...points.map((point) => point.xMm)),
    maxY: Math.max(...points.map((point) => point.yMm)),
  };
}

function boundsForElement(element) {
  return boundsForPoints(pointsFrom(element));
}

function mergeBounds(bounds) {
  const valid = bounds.filter(Boolean);
  if (valid.length === 0) return null;
  return {
    minX: Math.min(...valid.map((entry) => entry.minX)),
    minY: Math.min(...valid.map((entry) => entry.minY)),
    maxX: Math.max(...valid.map((entry) => entry.maxX)),
    maxY: Math.max(...valid.map((entry) => entry.maxY)),
  };
}

function width(bounds) {
  return bounds ? bounds.maxX - bounds.minX : 0;
}

function depth(bounds) {
  return bounds ? bounds.maxY - bounds.minY : 0;
}

function roundMm(value) {
  return Math.round(value * 1000) / 1000;
}

function roundM2(value) {
  return Math.round(value * 100) / 100;
}

function targetEnvelope(requiredFeatures) {
  const scaleBasis = requiredFeatures?.scaleBasis ?? {};
  return {
    minX: 0,
    minY: 0,
    maxX: Number(scaleBasis.overallWidthMm) || 0,
    maxY: Number(scaleBasis.overallDepthMm) || 0,
  };
}

function isBoundsOutside(inner, outer, toleranceMm = MM_EPSILON) {
  if (!inner || !outer) return false;
  return (
    inner.minX < outer.minX - toleranceMm ||
    inner.minY < outer.minY - toleranceMm ||
    inner.maxX > outer.maxX + toleranceMm ||
    inner.maxY > outer.maxY + toleranceMm
  );
}

function outsideDirections(inner, outer, toleranceMm = MM_EPSILON) {
  const directions = [];
  if (!inner || !outer) return directions;
  if (inner.minX < outer.minX - toleranceMm) directions.push('west');
  if (inner.minY < outer.minY - toleranceMm) directions.push('south');
  if (inner.maxX > outer.maxX + toleranceMm) directions.push('east');
  if (inner.maxY > outer.maxY + toleranceMm) directions.push('north');
  return directions;
}

function elementLevelId(element, elements) {
  if (element.levelId) return element.levelId;
  if (element.referenceLevelId) return element.referenceLevelId;
  const hostWallId = element.wallId ?? element.hostWallId;
  if (hostWallId && elements[hostWallId]?.levelId) return elements[hostWallId].levelId;
  const hostFloorId = element.hostFloorId;
  if (hostFloorId && elements[hostFloorId]?.levelId) return elements[hostFloorId].levelId;
  return null;
}

function floorBoundsByLevel(snapshot) {
  const byLevel = new Map();
  for (const element of sortedElements(snapshot)) {
    if (element.kind !== 'floor' || !element.levelId) continue;
    const bounds = boundsForElement(element);
    if (!bounds) continue;
    const current = byLevel.get(element.levelId);
    byLevel.set(element.levelId, mergeBounds([current, bounds]));
  }
  return byLevel;
}

function finding({
  category,
  code,
  severity = 'error',
  elementIds = [],
  elementKind = null,
  message,
  evidence = {},
  trackerItems = ['BIR-N01'],
}) {
  return {
    category,
    code,
    severity,
    elementIds: [...new Set(elementIds.filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    elementKind,
    message,
    evidence,
    trackerItems,
  };
}

function helperLeakageFindings(snapshot) {
  const findings = [];
  for (const element of sortedElements(snapshot)) {
    if (element.kind === 'room_separation') {
      findings.push(
        finding({
          category: 'helper_leakage',
          code: 'helper.room_separation.visible_in_snapshot',
          severity: 'error',
          elementIds: [element.id],
          elementKind: element.kind,
          message:
            'Room separation helper is present as a committed snapshot element; diagnostic/reporting views must separate helper geometry from physical BIM.',
          evidence: { boundsMm: boundsForElement(element) },
          trackerItems: ['BIR-B03', 'BIR-N01'],
        }),
      );
      continue;
    }

    if (
      HELPER_LEAK_PREFIXES.some((prefix) => String(element.id).startsWith(prefix)) ||
      String(element.name ?? '').toLowerCase().includes('access control wall')
    ) {
      findings.push(
        finding({
          category: 'helper_leakage',
          code: `helper.${element.kind}.access_stub_visible_in_snapshot`,
          severity: 'error',
          elementIds: [element.id],
          elementKind: element.kind,
          message:
            'Access-helper stub is modeled as a physical element and leaks into the target-house snapshot.',
          evidence: { boundsMm: boundsForElement(element), name: element.name ?? null },
          trackerItems: ['BIR-B03', 'BIR-N01'],
        }),
      );
    }
  }
  return findings;
}

function outOfEnvelopeFindings(snapshot, requiredFeatures) {
  const envelope = targetEnvelope(requiredFeatures);
  const floorByLevel = floorBoundsByLevel(snapshot);
  const elements = elementsById(snapshot);
  const findings = [];

  for (const element of sortedElements(snapshot)) {
    if (!PHYSICAL_AND_SKETCH_KINDS.has(element.kind)) continue;
    const bounds = boundsForElement(element);
    if (!bounds) continue;
    if (isBoundsOutside(bounds, envelope)) {
      findings.push(
        finding({
          category: 'out_of_envelope',
          code: 'geometry.element_outside_source_envelope',
          severity: 'error',
          elementIds: [element.id],
          elementKind: element.kind,
          message:
            'Element bounds extend outside the 14,000 mm by 10,000 mm source target envelope.',
          evidence: {
            boundsMm: bounds,
            targetEnvelopeMm: envelope,
            directions: outsideDirections(bounds, envelope),
          },
        }),
      );
    }

    const levelId = elementLevelId(element, elements);
    const supportBounds = levelId ? floorByLevel.get(levelId) : null;
    if (
      supportBounds &&
      element.kind !== 'floor' &&
      !['roof', 'roof_opening', 'room_separation'].includes(element.kind) &&
      isBoundsOutside(bounds, supportBounds)
    ) {
      findings.push(
        finding({
          category: 'out_of_envelope',
          code: 'geometry.element_outside_level_floor_support',
          severity: 'error',
          elementIds: [element.id],
          elementKind: element.kind,
          message:
            'Element bounds extend outside the floor/slab footprint for its resolved level.',
          evidence: {
            levelId,
            boundsMm: bounds,
            supportBoundsMm: supportBounds,
            directions: outsideDirections(bounds, supportBounds),
          },
        }),
      );
    }
  }
  return findings;
}

function distancePointToSegment(point, start, end) {
  const vx = end.xMm - start.xMm;
  const vy = end.yMm - start.yMm;
  const wx = point.xMm - start.xMm;
  const wy = point.yMm - start.yMm;
  const lengthSq = vx * vx + vy * vy;
  if (lengthSq <= 0) return Math.hypot(point.xMm - start.xMm, point.yMm - start.yMm);
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lengthSq));
  return Math.hypot(point.xMm - (start.xMm + t * vx), point.yMm - (start.yMm + t * vy));
}

function wallEndpointConnectivity(wall, walls) {
  const endpoints = [
    { key: 'start', point: wall.start },
    { key: 'end', point: wall.end },
  ];
  const isolated = [];
  for (const endpoint of endpoints) {
    const connected = walls.some((other) => {
      if (other.id === wall.id || other.levelId !== wall.levelId || !other.start || !other.end) {
        return false;
      }
      return distancePointToSegment(endpoint.point, other.start, other.end) <= CONNECT_TOLERANCE_MM;
    });
    if (!connected) isolated.push(endpoint.key);
  }
  return isolated;
}

function wallLengthMm(wall) {
  if (!wall.start || !wall.end) return 0;
  return Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm);
}

function detachedOrFlyingFindings(snapshot) {
  const findings = [];
  const elements = elementsById(snapshot);
  const walls = sortedElements(snapshot).filter((element) => element.kind === 'wall');

  for (const wall of walls) {
    const isolatedEndpoints = wallEndpointConnectivity(wall, walls);
    if (isolatedEndpoints.length > 0) {
      findings.push(
        finding({
          category: 'detached_or_flying',
          code: 'geometry.wall_detached_endpoint',
          severity: 'error',
          elementIds: [wall.id],
          elementKind: wall.kind,
          message:
            'Wall has endpoint(s) that do not connect to another wall segment on the same level.',
          evidence: {
            levelId: wall.levelId ?? null,
            isolatedEndpoints,
            lengthMm: roundMm(wallLengthMm(wall)),
            boundsMm: boundsForElement(wall),
          },
        }),
      );
    }
  }

  for (const element of sortedElements(snapshot)) {
    if (element.kind === 'door' || element.kind === 'window') {
      const host = elements[element.wallId];
      if (!host || host.kind !== 'wall') continue;
      if (String(host.id).startsWith('access-wall-')) {
        findings.push(
          finding({
            category: 'detached_or_flying',
            code: 'geometry.hosted_opening_on_access_stub',
            severity: 'error',
            elementIds: [element.id, host.id],
            elementKind: element.kind,
            message:
              'Hosted opening is attached to an access-helper stub instead of a real enclosing wall.',
            evidence: {
              hostWallId: host.id,
              hostLengthMm: roundMm(wallLengthMm(host)),
              alongT: element.alongT ?? null,
            },
            trackerItems: ['BIR-C07', 'BIR-N01'],
          }),
        );
      }
    }

    if (element.kind === 'railing' && !element.hostedStairId && !element.levelId) {
      findings.push(
        finding({
          category: 'detached_or_flying',
          code: 'geometry.railing_unhosted_no_level',
          severity: 'error',
          elementIds: [element.id],
          elementKind: element.kind,
          message:
            'Railing has no hosted stair, slab/edge host, or level id, so its vertical support is ambiguous.',
          evidence: { pathMm: element.pathMm ?? null, guardHeightMm: element.guardHeightMm ?? null },
        }),
      );
    }

    if (element.kind === 'sweep' && !element.hostElementId && !element.levelId) {
      findings.push(
        finding({
          category: 'detached_or_flying',
          code: 'geometry.sweep_unhosted_no_level',
          severity: 'error',
          elementIds: [element.id],
          elementKind: element.kind,
          message: 'Sweep has no host element or level id.',
          evidence: { pathMm: element.pathMm ?? null },
        }),
      );
    }
  }

  return findings;
}

function cutInterval(opening, host) {
  const hostLength = Math.max(1, wallLengthMm(host));
  if (opening.kind === 'wall_opening') {
    return {
      startT: Number(opening.alongTStart),
      endT: Number(opening.alongTEnd),
    };
  }
  const widthMm = Number(opening.widthMm) || 0;
  const halfT = widthMm / 2 / hostLength;
  const center = Number(opening.alongT);
  return {
    startT: center - halfT,
    endT: center + halfT,
  };
}

function intervalsOverlap(left, right) {
  return left.startT < right.endT && right.startT < left.endT;
}

function rendererFindings(snapshot) {
  const findings = [];
  const elements = elementsById(snapshot);

  for (const element of sortedElements(snapshot)) {
    if (element.kind === 'roof_opening') {
      const host = elements[element.hostRoofId];
      findings.push(
        finding({
          category: 'unsupported_renderer_feature',
          code: 'renderer.roof_opening.asymmetric_gable_unproven',
          severity: 'error',
          elementIds: [element.id, element.hostRoofId],
          elementKind: element.kind,
          message:
            'Roof opening is hosted in an asymmetric gable roof; renderer support is partial and no structured renderer diagnostic evidence proves the cut.',
          evidence: {
            hostRoofId: element.hostRoofId ?? null,
            hostRoofGeometryMode: host?.roofGeometryMode ?? null,
            diagnosticCodesRequired: [
              'renderer.roof_opening.unsupported',
              'renderer.roof_opening.failed_cut',
            ],
          },
          trackerItems: ['BIR-I03', 'BIR-I04', 'BIR-N01'],
        }),
      );
    }

    if (element.kind === 'slab_opening') {
      findings.push(
        finding({
          category: 'unsupported_renderer_feature',
          code: 'renderer.slab_opening.stair_penetration_unproven',
          severity: 'error',
          elementIds: [element.id, element.hostFloorId],
          elementKind: element.kind,
          message:
            'Stair slab opening uses partial renderer support and lacks structured renderer diagnostic evidence proving the cut.',
          evidence: {
            hostFloorId: element.hostFloorId ?? null,
            diagnosticCodesRequired: [
              'renderer.slab_opening.unsupported',
              'renderer.slab_opening.failed_cut',
            ],
          },
          trackerItems: ['BIR-I03', 'BIR-I04', 'BIR-N01'],
        }),
      );
    }

    if (element.kind === 'railing') {
      findings.push(
        finding({
          category: 'unsupported_renderer_feature',
          code: 'renderer.railing_geometry.unhosted_edge_unproven',
          severity: 'warning',
          elementIds: [element.id],
          elementKind: element.kind,
          message:
            'Railing rendering is partial and this railing has no explicit host edge relation for diagnostic evidence.',
          evidence: {
            diagnosticCodesRequired: [
              'renderer.railing_geometry.degraded',
              'renderer.railing_geometry.unsupported',
            ],
          },
          trackerItems: ['BIR-I03', 'BIR-I04', 'BIR-N01'],
        }),
      );
    }
  }

  const hostedCutsByWall = new Map();
  for (const element of sortedElements(snapshot)) {
    if (!['door', 'window', 'wall_opening'].includes(element.kind)) continue;
    const hostWallId = element.kind === 'wall_opening' ? element.hostWallId : element.wallId;
    const host = elements[hostWallId];
    if (!host || host.kind !== 'wall') continue;
    const row = { element, interval: cutInterval(element, host), host };
    if (!hostedCutsByWall.has(host.id)) hostedCutsByWall.set(host.id, []);
    hostedCutsByWall.get(host.id).push(row);
  }

  for (const [wallId, rows] of hostedCutsByWall) {
    rows.sort((a, b) => a.element.id.localeCompare(b.element.id));
    for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
        const left = rows[leftIndex];
        const right = rows[rightIndex];
        if (!intervalsOverlap(left.interval, right.interval)) continue;
        findings.push(
          finding({
            category: 'unsupported_renderer_feature',
            code: 'renderer.wall_cut.overlapping_hosted_cuts',
            severity: 'error',
            elementIds: [left.element.id, right.element.id, wallId],
            elementKind: 'wall',
            message:
              'Hosted cuts overlap on the same wall; current renderer support requires a structured unsupported/failed diagnostic instead of silent proxy rendering.',
            evidence: {
              hostWallId: wallId,
              leftInterval: left.interval,
              rightInterval: right.interval,
              diagnosticCodesRequired: [
                'renderer.hosted_opening.detached_proxy',
                'renderer.hosted_opening.no_cut',
                'renderer.wall_cut.failed',
              ],
            },
            trackerItems: ['BIR-C08', 'BIR-I03', 'BIR-I04', 'BIR-N01'],
          }),
        );
      }
    }
  }

  return findings;
}

function polygonAreaM2(points) {
  if (!Array.isArray(points) || points.length < 3) return null;
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.xMm * next.yMm - next.xMm * current.yMm;
  }
  return Math.abs(sum) / 2 / 1_000_000;
}

function requiredRoomFindings(snapshot, requiredFeatures) {
  const findings = [];
  const rooms = sortedElements(snapshot).filter((element) => element.kind === 'room');
  const currentRoomIds = new Set(rooms.map((room) => room.id));

  for (const requiredRoom of asArray(requiredFeatures?.requiredRooms)) {
    if (!currentRoomIds.has(requiredRoom.id)) {
      findings.push(
        finding({
          category: 'sketch_critical_mismatch',
          code: 'sketch.required_room_id_missing',
          severity: 'error',
          elementIds: [],
          elementKind: 'room',
          message:
            'Required target-house room id is absent from the current snapshot, so schedules and semantic acceptance cannot bind to the required room.',
          evidence: {
            requiredRoomId: requiredRoom.id,
            requiredName: requiredRoom.name,
            semanticSelector: requiredRoom.semanticSelector ?? null,
          },
          trackerItems: ['BIR-N01', 'BIR-N06'],
        }),
      );
    }
  }

  for (const room of rooms) {
    const currentAreaM2 = polygonAreaM2(room.outlineMm);
    const scheduledAreaM2 = Number(room.targetAreaM2);
    if (currentAreaM2 !== null && Number.isFinite(scheduledAreaM2)) {
      const delta = Math.abs(currentAreaM2 - scheduledAreaM2);
      if (delta > Math.max(0.25, scheduledAreaM2 * ROOM_AREA_TOLERANCE_RATIO)) {
        findings.push(
          finding({
            category: 'sketch_critical_mismatch',
            code: 'sketch.room_schedule_area_differs_from_outline',
            severity: 'warning',
            elementIds: [room.id],
            elementKind: 'room',
            message:
              'Room scheduled targetAreaM2 differs materially from its committed outline area.',
            evidence: {
              currentOutlineAreaM2: roundM2(currentAreaM2),
              scheduledTargetAreaM2: scheduledAreaM2,
              deltaM2: roundM2(currentAreaM2 - scheduledAreaM2),
            },
            trackerItems: ['BIR-N01', 'BIR-N06'],
          }),
        );
      }
    }
  }
  return findings;
}

function sketchMismatchFindings(snapshot, requiredFeatures) {
  const findings = [];
  const elements = elementsById(snapshot);
  const envelope = targetEnvelope(requiredFeatures);
  const modelBounds = mergeBounds(
    sortedElements(snapshot)
      .filter((element) => ['wall', 'floor', 'roof', 'room'].includes(element.kind))
      .map(boundsForElement),
  );
  if (modelBounds && envelope.maxX > 0 && envelope.maxY > 0) {
    const widthRatio = width(modelBounds) / width(envelope);
    const depthRatio = depth(modelBounds) / depth(envelope);
    if (Math.abs(1 - widthRatio) > 0.1 || Math.abs(1 - depthRatio) > 0.1) {
      findings.push(
        finding({
          category: 'sketch_critical_mismatch',
          code: 'sketch.scale_basis_not_met',
          severity: 'error',
          elementIds: [],
          elementKind: null,
          message:
            'Current physical model extents do not match the 14,000 mm by 10,000 mm target-house scale basis.',
          evidence: {
            modelBoundsMm: modelBounds,
            targetEnvelopeMm: envelope,
            modelWidthMm: roundMm(width(modelBounds)),
            modelDepthMm: roundMm(depth(modelBounds)),
            targetWidthMm: width(envelope),
            targetDepthMm: depth(envelope),
            widthRatio: Math.round(widthRatio * 1000) / 1000,
            depthRatio: Math.round(depthRatio * 1000) / 1000,
          },
        }),
      );
    }
  }

  const roofOpening = elements['hf-roof-court-opening'];
  const roofBounds = boundsForElement(roofOpening);
  const expectedRoofCourtWidth = Number(requiredFeatures?.dimensions?.roofCourtWidthMm) || 5300;
  const expectedRoofCourtDepth = Number(requiredFeatures?.dimensions?.roofCourtDepthMm) || 4200;
  if (roofBounds) {
    const actualWidth = width(roofBounds);
    const actualDepth = depth(roofBounds);
    if (
      Math.abs(actualWidth - expectedRoofCourtWidth) > expectedRoofCourtWidth * 0.15 ||
      Math.abs(actualDepth - expectedRoofCourtDepth) > expectedRoofCourtDepth * 0.15
    ) {
      findings.push(
        finding({
          category: 'sketch_critical_mismatch',
          code: 'sketch.roof_court_dimensions_not_met',
          severity: 'error',
          elementIds: ['hf-roof-court-opening'],
          elementKind: 'roof_opening',
          message:
            'Roof terrace cutout dimensions do not match the Sketch IR roof court target.',
          evidence: {
            actualWidthMm: roundMm(actualWidth),
            actualDepthMm: roundMm(actualDepth),
            expectedWidthMm: expectedRoofCourtWidth,
            expectedDepthMm: expectedRoofCourtDepth,
          },
        }),
      );
    }
  }

  const windows = sortedElements(snapshot).filter((element) => element.kind === 'window');
  if (windows.length < 4) {
    findings.push(
      finding({
        category: 'sketch_critical_mismatch',
        code: 'sketch.opening_rhythm_window_count_low',
        severity: 'error',
        elementIds: windows.map((window) => window.id),
        elementKind: 'window',
        message:
          'Opening/glazing rhythm is under-modeled for target-house evidence; current snapshot has fewer than four window elements.',
        evidence: {
          currentWindowCount: windows.length,
          requiredFeatureId: 'opening_and_glazing_rhythm',
        },
      }),
    );
  }

  const roofMaterial = elements['hf-roof-main']?.materialKey ?? null;
  if (roofMaterial !== 'white_render') {
    findings.push(
      finding({
        category: 'sketch_critical_mismatch',
        code: 'sketch.roof_material_not_white_shell',
        severity: 'error',
        elementIds: ['hf-roof-main'],
        elementKind: 'roof',
        message: 'Roof material does not match the required matte white shell material.',
        evidence: { materialKey: roofMaterial },
      }),
    );
  }

  findings.push(...requiredRoomFindings(snapshot, requiredFeatures));
  return findings;
}

function summarize(findings) {
  const summary = {
    total: findings.length,
    byCategory: {},
    bySeverity: { error: 0, warning: 0, info: 0 },
  };
  for (const entry of findings) {
    summary.byCategory[entry.category] = (summary.byCategory[entry.category] ?? 0) + 1;
    summary.bySeverity[entry.severity] = (summary.bySeverity[entry.severity] ?? 0) + 1;
  }
  return summary;
}

function ruleCatalog() {
  return [
    {
      code: 'geometry.element_outside_source_envelope',
      category: 'out_of_envelope',
      basis: 'Element 2D bounds must remain inside the source target envelope unless a tolerance records another origin/scale.',
    },
    {
      code: 'geometry.element_outside_level_floor_support',
      category: 'out_of_envelope',
      basis: 'Level-resolved elements must be supported by the floor/slab footprint for that level.',
    },
    {
      code: 'geometry.wall_detached_endpoint',
      category: 'detached_or_flying',
      basis: 'Wall endpoints should connect to wall topology or be explicitly documented as free edges.',
    },
    {
      code: 'geometry.hosted_opening_on_access_stub',
      category: 'detached_or_flying',
      basis: 'Door/window hosts must be real enclosing walls, not synthetic access-helper stubs.',
    },
    {
      code: 'geometry.railing_unhosted_no_level',
      category: 'detached_or_flying',
      basis: 'Railings need an explicit host edge/stair or level relation.',
    },
    {
      code: 'helper.room_separation.visible_in_snapshot',
      category: 'helper_leakage',
      basis: 'Room separation lines are analysis/helper geometry and must not be confused with physical BIM.',
    },
    {
      code: 'helper.*.access_stub_visible_in_snapshot',
      category: 'helper_leakage',
      basis: 'Access-helper wall/door stubs are not target-house physical architecture.',
    },
    {
      code: 'renderer.*',
      category: 'unsupported_renderer_feature',
      basis: 'Partial renderer support must produce structured diagnostics for target-house-critical evidence.',
    },
    {
      code: 'sketch.*',
      category: 'sketch_critical_mismatch',
      basis: 'Machine-readable target-house scale, room, opening, and roof-court requirements must bind to the snapshot.',
    },
  ];
}

export function sha256File(path) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

export function buildTargetHouseGeometryDiagnostic({
  snapshot,
  requiredFeatures,
  targetId = DEFAULT_TARGET_ID,
  sourceDigests = {},
} = {}) {
  const findings = [
    ...detachedOrFlyingFindings(snapshot),
    ...outOfEnvelopeFindings(snapshot, requiredFeatures),
    ...helperLeakageFindings(snapshot),
    ...rendererFindings(snapshot),
    ...sketchMismatchFindings(snapshot, requiredFeatures),
  ].sort((a, b) => {
    const keyA = `${a.category}:${a.code}:${a.elementIds.join(',')}:${JSON.stringify(a.evidence)}`;
    const keyB = `${b.category}:${b.code}:${b.elementIds.join(',')}:${JSON.stringify(b.evidence)}`;
    return keyA.localeCompare(keyB);
  });

  return {
    schemaVersion: TARGET_HOUSE_GEOMETRY_DIAGNOSTIC_SCHEMA_VERSION,
    targetId,
    deterministic: true,
    generatedFrom: {
      snapshotModelId: snapshot?.modelId ?? null,
      snapshotRevision: snapshot?.revision ?? null,
      sourceDigests,
    },
    targetEnvelopeMm: targetEnvelope(requiredFeatures),
    currentPhysicalBoundsMm: mergeBounds(
      sortedElements(snapshot)
        .filter((element) => PHYSICAL_AND_SKETCH_KINDS.has(element.kind))
        .map(boundsForElement),
    ),
    ruleCatalog: ruleCatalog(),
    summary: summarize(findings),
    findings,
  };
}

export function renderTargetHouseGeometryDiagnosticMarkdown(report) {
  const lines = [
    '# Target House 1 Current Geometry Diagnostic',
    '',
    `Schema: \`${report.schemaVersion}\``,
    `Target: \`${report.targetId}\``,
    `Snapshot: \`${report.generatedFrom.snapshotModelId}\` revision \`${report.generatedFrom.snapshotRevision}\``,
    '',
    '## Summary',
    '',
    `- Total findings: ${report.summary.total}`,
    `- Errors: ${report.summary.bySeverity.error}`,
    `- Warnings: ${report.summary.bySeverity.warning}`,
    '',
    '| Category | Count |',
    '| --- | ---: |',
  ];
  for (const [category, count] of Object.entries(report.summary.byCategory).sort()) {
    lines.push(`| \`${category}\` | ${count} |`);
  }
  lines.push('', '## Bounds', '');
  lines.push(`- Target envelope: ${JSON.stringify(report.targetEnvelopeMm)}`);
  lines.push(`- Current physical/sketch bounds: ${JSON.stringify(report.currentPhysicalBoundsMm)}`);
  lines.push('', '## Findings', '');
  lines.push('| Category | Severity | Code | Elements | Evidence |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const entry of report.findings) {
    const evidence = JSON.stringify(entry.evidence).replaceAll('|', '\\|');
    lines.push(
      `| \`${entry.category}\` | ${entry.severity} | \`${entry.code}\` | ${entry.elementIds.map((id) => `\`${id}\``).join('<br>') || '-'} | ${evidence} |`,
    );
  }
  lines.push('', '## Rule Catalog', '');
  for (const rule of report.ruleCatalog) {
    lines.push(`- \`${rule.code}\` (${rule.category}): ${rule.basis}`);
  }
  lines.push('');
  return `${lines.join('\n')}`;
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
