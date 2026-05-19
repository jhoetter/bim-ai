import type { Element } from '@bim-ai/core';

import {
  createRendererDiagnostic,
  type RendererDiagnostic,
  type RendererDiagnosticEvidence,
} from './rendererDiagnostics';

type PointMm = { xMm: number; yMm: number };
type FloorElement = Extract<Element, { kind: 'floor' }>;
type LevelElement = Extract<Element, { kind: 'level' }>;
type RailingElement = Extract<Element, { kind: 'railing' }>;
type SlabOpeningElement = Extract<Element, { kind: 'slab_opening' }>;
type StairElement = Extract<Element, { kind: 'stair' }>;

export type VerticalCirculationRenderDiagnosticsOptions = {
  evidence?: RendererDiagnosticEvidence;
  viewId?: string | null;
  requireRailingHostedEdges?: boolean;
  guardHeightThresholdMm?: number;
  targetHouseTerraceGuardrails?: boolean;
};

const DEFAULT_GUARD_HEIGHT_THRESHOLD_MM = 760;
const TRACKER_SLAB = ['BIR-I02', 'BIR-I03', 'BIR-J03', 'BIR-E01'];
const TRACKER_STAIR = ['BIR-I02', 'BIR-I03', 'BIR-J03', 'BIR-J04', 'BIR-E01'];
const TRACKER_RAILING = ['BIR-I02', 'BIR-I03', 'BIR-J04', 'BIR-E03'];
const TARGET_HOUSE_TERRACE_RE =
  /(?:target-house|terrace|loggia|roof[-_\s]?court|balcony|guardrail)/i;

export function diagnoseVerticalCirculationRendering(
  elementsById: Record<string, Element | undefined>,
  options: VerticalCirculationRenderDiagnosticsOptions = {},
): RendererDiagnostic[] {
  const elements = Object.values(elementsById).filter((element): element is Element => !!element);
  const floors = elements.filter((element): element is FloorElement => element.kind === 'floor');
  const levelsById = new Map(
    elements
      .filter((element): element is LevelElement => element.kind === 'level')
      .map((level) => [level.id, level]),
  );
  const slabOpeningsByFloorId = groupSlabOpeningsByFloorId(elements);
  const diagnostics: RendererDiagnostic[] = [];

  for (const opening of elements.filter(
    (element): element is SlabOpeningElement => element.kind === 'slab_opening',
  )) {
    diagnostics.push(...diagnoseSlabOpening(opening, elementsById, options));
  }

  for (const stair of elements.filter(
    (element): element is StairElement => element.kind === 'stair',
  )) {
    diagnostics.push(
      ...diagnoseStairRendering(stair, floors, levelsById, slabOpeningsByFloorId, options),
    );
  }

  for (const railing of elements.filter(
    (element): element is RailingElement => element.kind === 'railing',
  )) {
    diagnostics.push(...diagnoseRailingRendering(railing, elementsById, options));
  }

  if (options.targetHouseTerraceGuardrails !== false) {
    diagnostics.push(...diagnoseTargetHouseGuardrailRisks(floors, elements, levelsById, options));
  }

  return diagnostics.sort((a, b) => {
    const aKey = `${a.severity}:${a.code}:${a.elementIds.join(',')}`;
    const bKey = `${b.severity}:${b.code}:${b.elementIds.join(',')}`;
    return aKey.localeCompare(bKey);
  });
}

function diagnoseSlabOpening(
  opening: SlabOpeningElement,
  elementsById: Record<string, Element | undefined>,
  options: VerticalCirculationRenderDiagnosticsOptions,
): RendererDiagnostic[] {
  const host = elementsById[opening.hostFloorId];
  const diagnostics: RendererDiagnostic[] = [];
  if (!host || host.kind !== 'floor') {
    diagnostics.push(
      diagnostic({
        code: 'renderer.slab_opening.missing_host_floor',
        ruleId: 'renderer_slab_opening_missing_host_floor',
        severity: 'error',
        message: 'Slab opening cannot render a cut because hostFloorId does not reference a floor.',
        elementIds: [opening.id, opening.hostFloorId].filter(Boolean),
        trackerItems: TRACKER_SLAB,
        options,
      }),
    );
    return diagnostics;
  }

  if (polygonAreaAbs(opening.boundaryMm) < 1) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.slab_opening.degenerate_boundary',
        ruleId: 'renderer_slab_opening_degenerate_boundary',
        severity: 'error',
        message: 'Slab opening boundary is degenerate, so the slab void cannot be rendered.',
        elementIds: [opening.id, host.id],
        trackerItems: TRACKER_SLAB,
        options,
      }),
    );
  }

  if (
    opening.boundaryMm.length >= 3 &&
    host.boundaryMm.length >= 3 &&
    !polygonContainsPolygon(host.boundaryMm, opening.boundaryMm)
  ) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.slab_opening.boundary_outside_host',
        ruleId: 'renderer_slab_opening_boundary_outside_host',
        severity: 'error',
        message:
          'Slab opening boundary extends outside its host floor, so the floor cut is renderer-invalid.',
        elementIds: [opening.id, host.id],
        trackerItems: TRACKER_SLAB,
        options,
      }),
    );
  }

  return diagnostics;
}

function diagnoseStairRendering(
  stair: StairElement,
  floors: FloorElement[],
  levelsById: Map<string, LevelElement>,
  slabOpeningsByFloorId: Map<string, SlabOpeningElement[]>,
  options: VerticalCirculationRenderDiagnosticsOptions,
): RendererDiagnostic[] {
  const diagnostics: RendererDiagnostic[] = [];
  const baseElev = levelsById.get(stair.baseLevelId)?.elevationMm;
  const topElev = levelsById.get(stair.topLevelId)?.elevationMm;
  if (typeof baseElev !== 'number' || typeof topElev !== 'number') {
    diagnostics.push(
      diagnostic({
        code: 'renderer.stair_geometry.missing_level_evidence',
        ruleId: 'renderer_stair_missing_level_evidence',
        severity: 'error',
        message:
          'Stair rendering cannot verify floor penetrations because a level reference is missing.',
        elementIds: [stair.id, stair.baseLevelId, stair.topLevelId],
        trackerItems: TRACKER_STAIR,
        options,
      }),
    );
  }

  for (const marker of unsupportedMarkersFor(stair)) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.stair_geometry.unsupported',
        ruleId: 'renderer_stair_unsupported_feature_marker',
        severity: 'warning',
        message: `Stair declares unsupported render feature "${marker}".`,
        elementIds: [stair.id],
        trackerItems: TRACKER_STAIR,
        options,
      }),
    );
  }

  if (!isKnownStairShape((stair as { shape?: string }).shape)) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.stair_geometry.unsupported_shape',
        ruleId: 'renderer_stair_unsupported_shape',
        severity: 'warning',
        message: `Stair shape "${(stair as { shape?: string }).shape}" is not in the renderer support contract.`,
        elementIds: [stair.id],
        trackerItems: TRACKER_STAIR,
        options,
      }),
    );
  }

  if (typeof baseElev !== 'number' || typeof topElev !== 'number') return diagnostics;

  const minElev = Math.min(baseElev, topElev);
  const maxElev = Math.max(baseElev, topElev);
  const stairPoly = stairPlanPolygon(stair);
  const stairBox = bboxFor(stairPoly);
  if (!stairBox) return diagnostics;

  for (const floor of floors) {
    const floorElev = levelsById.get(floor.levelId)?.elevationMm;
    if (typeof floorElev !== 'number') continue;
    if (floorElev <= minElev || floorElev > maxElev) continue;
    if (!bboxesOverlap(stairBox, bboxFor(floor.boundaryMm))) continue;
    if (!polygonIntersectsPolygon(stairPoly, floor.boundaryMm)) continue;
    if (floorHasOpeningForStair(stairPoly, slabOpeningsByFloorId.get(floor.id) ?? [])) continue;

    diagnostics.push(
      diagnostic({
        code: 'renderer.stair_geometry.floor_penetration_without_slab_opening',
        ruleId: 'renderer_stair_floor_penetration_without_slab_opening',
        severity: 'error',
        message:
          'Stair crosses an upper floor without slab/shaft opening evidence, so the viewport can render a stair-slab clash.',
        elementIds: [stair.id, floor.id],
        trackerItems: TRACKER_STAIR,
        options,
      }),
    );
  }

  return diagnostics;
}

function diagnoseRailingRendering(
  railing: RailingElement,
  elementsById: Record<string, Element | undefined>,
  options: VerticalCirculationRenderDiagnosticsOptions,
): RendererDiagnostic[] {
  const diagnostics: RendererDiagnostic[] = [];
  const requiresHostedEdge =
    options.requireRailingHostedEdges === true || booleanProp(railing, 'requiresHostedEdge');

  for (const marker of unsupportedMarkersFor(railing)) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.railing_geometry.unsupported',
        ruleId: 'renderer_railing_unsupported_feature_marker',
        severity: 'warning',
        message: `Railing declares unsupported render feature "${marker}".`,
        elementIds: [railing.id],
        trackerItems: TRACKER_RAILING,
        options,
      }),
    );
  }

  if (
    !isKnownBalusterRule((railing as { balusterPattern?: { rule?: string } }).balusterPattern?.rule)
  ) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.railing_geometry.unsupported_baluster_pattern',
        ruleId: 'renderer_railing_unsupported_baluster_pattern',
        severity: 'warning',
        message: `Railing baluster pattern "${railing.balusterPattern?.rule}" is not in the renderer support contract.`,
        elementIds: [railing.id],
        trackerItems: TRACKER_RAILING,
        options,
      }),
    );
  }

  if (railing.hostedStairId && elementsById[railing.hostedStairId]?.kind !== 'stair') {
    diagnostics.push(
      diagnostic({
        code: 'renderer.railing_geometry.missing_hosted_stair',
        ruleId: 'renderer_railing_missing_hosted_stair',
        severity: 'error',
        message:
          'Railing references a hosted stair that does not exist, so stair-slope interpolation is invalid.',
        elementIds: [railing.id, railing.hostedStairId],
        trackerItems: TRACKER_RAILING,
        options,
      }),
    );
  }

  if (requiresHostedEdge && !hasRailingHostEdgeEvidence(railing)) {
    diagnostics.push(
      diagnostic({
        code: 'renderer.railing_geometry.missing_host_edge',
        ruleId: 'renderer_railing_missing_host_edge',
        severity: 'error',
        message:
          'Railing requires an exposed/hosted edge association, but no host edge, floor edge, or hosted stair evidence is present.',
        elementIds: [railing.id],
        trackerItems: TRACKER_RAILING,
        options,
      }),
    );
  }

  return diagnostics;
}

function diagnoseTargetHouseGuardrailRisks(
  floors: FloorElement[],
  elements: Element[],
  levelsById: Map<string, LevelElement>,
  options: VerticalCirculationRenderDiagnosticsOptions,
): RendererDiagnostic[] {
  const railings = elements.filter(
    (element): element is RailingElement => element.kind === 'railing',
  );
  const threshold = options.guardHeightThresholdMm ?? DEFAULT_GUARD_HEIGHT_THRESHOLD_MM;
  const diagnostics: RendererDiagnostic[] = [];

  for (const floor of floors) {
    if (!isTargetHouseTerraceFloor(floor)) continue;
    const levelElev = levelsById.get(floor.levelId)?.elevationMm ?? 0;
    const requiresGuard =
      levelElev >= threshold ||
      booleanProp(floor, 'requiresGuardrail') ||
      /terrace|loggia/i.test(floor.name);
    if (!requiresGuard) continue;

    if (hasExplicitGuardrailEvidence(floor, railings)) continue;

    const guardCoverage = railingCoverageForFloorBoundary(floor, railings);
    if (guardCoverage <= 0) {
      diagnostics.push(
        diagnostic({
          code: 'renderer.railing_geometry.target_house_guardrail_missing',
          ruleId: 'renderer_target_house_guardrail_missing',
          severity: 'error',
          message:
            'Target-house terrace/loggia floor has no nearby guardrail path, so evidence can render an unsafe exposed edge.',
          elementIds: [floor.id],
          trackerItems: TRACKER_RAILING,
          options,
        }),
      );
    } else if (guardCoverage < 0.35) {
      diagnostics.push(
        diagnostic({
          code: 'renderer.railing_geometry.target_house_guardrail_partial',
          ruleId: 'renderer_target_house_guardrail_partial',
          severity: 'warning',
          message:
            'Target-house terrace/loggia guardrail path covers too little of the exposed boundary for reliable evidence.',
          elementIds: [floor.id],
          trackerItems: TRACKER_RAILING,
          options,
        }),
      );
    }
  }

  return diagnostics;
}

function hasExplicitGuardrailEvidence(floor: FloorElement, railings: RailingElement[]): boolean {
  const declaredGuardIds = normalizeMarkerList(
    (floor.props as Record<string, unknown> | null)?.guardIds,
  );
  const candidates = declaredGuardIds.length
    ? railings.filter((railing) => declaredGuardIds.includes(railing.id))
    : railings.filter((railing) => railing.hostFloorId === floor.id);
  return candidates.some((railing) => {
    const path = railing.pathMm ?? [];
    return path.length >= 2 && hasRailingHostEdgeEvidence(railing);
  });
}

function diagnostic(input: {
  code: string;
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  elementIds: string[];
  trackerItems: string[];
  options: VerticalCirculationRenderDiagnosticsOptions;
}): RendererDiagnostic {
  const feature = input.code.startsWith('renderer.slab_opening')
    ? 'slab-opening'
    : input.code.includes('railing')
      ? 'railing-geometry'
      : 'stair-geometry';
  return createRendererDiagnostic({
    code: input.code,
    ruleId: input.ruleId,
    severity: input.severity,
    issueClass: input.severity === 'error' ? 'model-invalid' : 'renderer-unsupported',
    rendererArea: input.code.includes('slab_opening') ? 'boolean-cut' : 'viewport-3d',
    feature,
    message: input.message,
    elementIds: input.elementIds,
    trackerItems: input.trackerItems,
    viewId: input.options.viewId,
    evidence: input.options.evidence,
  });
}

function groupSlabOpeningsByFloorId(elements: Element[]): Map<string, SlabOpeningElement[]> {
  const byFloorId = new Map<string, SlabOpeningElement[]>();
  for (const element of elements) {
    if (element.kind !== 'slab_opening') continue;
    const entries = byFloorId.get(element.hostFloorId) ?? [];
    entries.push(element);
    byFloorId.set(element.hostFloorId, entries);
  }
  return byFloorId;
}

function stairPlanPolygon(stair: StairElement): PointMm[] {
  if (stair.boundaryMm && stair.boundaryMm.length >= 3) return stair.boundaryMm;
  if (stair.shape === 'spiral' && stair.centerMm && stair.outerRadiusMm) {
    const r = stair.outerRadiusMm;
    return [
      { xMm: stair.centerMm.xMm - r, yMm: stair.centerMm.yMm - r },
      { xMm: stair.centerMm.xMm + r, yMm: stair.centerMm.yMm - r },
      { xMm: stair.centerMm.xMm + r, yMm: stair.centerMm.yMm + r },
      { xMm: stair.centerMm.xMm - r, yMm: stair.centerMm.yMm + r },
    ];
  }

  const runPolys =
    stair.runs?.flatMap((run) =>
      segmentBoxPolygon(run.startMm, run.endMm, run.widthMm ?? stair.widthMm),
    ) ?? [];
  const landingPts = stair.landings?.flatMap((landing) => landing.boundaryMm ?? []) ?? [];
  const allPts = [...runPolys, ...landingPts];
  if (allPts.length > 0) return bboxPolygonFor(allPts);
  return segmentBoxPolygon(stair.runStartMm, stair.runEndMm, stair.widthMm);
}

function segmentBoxPolygon(start: PointMm, end: PointMm, widthMm: number): PointMm[] {
  const dx = end.xMm - start.xMm;
  const dy = end.yMm - start.yMm;
  const len = Math.hypot(dx, dy);
  const px = len > 1e-6 ? -dy / len : 0;
  const py = len > 1e-6 ? dx / len : 1;
  const half = Math.max(widthMm, 1) / 2;
  return [
    { xMm: start.xMm + px * half, yMm: start.yMm + py * half },
    { xMm: end.xMm + px * half, yMm: end.yMm + py * half },
    { xMm: end.xMm - px * half, yMm: end.yMm - py * half },
    { xMm: start.xMm - px * half, yMm: start.yMm - py * half },
  ];
}

function floorHasOpeningForStair(stairPoly: PointMm[], openings: SlabOpeningElement[]): boolean {
  const center = centroid(stairPoly);
  return openings.some((opening) => {
    if (polygonAreaAbs(opening.boundaryMm) < 1) return false;
    return (
      pointInPolygonOrBoundary(center, opening.boundaryMm) ||
      polygonIntersectsPolygon(stairPoly, opening.boundaryMm)
    );
  });
}

function unsupportedMarkersFor(element: Element): string[] {
  const record = element as Element & {
    props?: Record<string, unknown>;
    unsupportedRenderFeatures?: unknown;
    rendererUnsupportedFeatures?: unknown;
  };
  const values = [
    record.unsupportedRenderFeatures,
    record.rendererUnsupportedFeatures,
    record.props?.unsupportedRenderFeatures,
    record.props?.rendererUnsupportedFeatures,
    nestedUnknown(record.props?.renderDiagnostics, 'unsupportedFeatures'),
  ];
  return values.flatMap(normalizeMarkerList);
}

function nestedUnknown(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  return (value as Record<string, unknown>)[key];
}

function normalizeMarkerList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  }
  if (typeof value === 'string' && value.length > 0) return [value];
  return [];
}

function isKnownStairShape(shape: string | undefined): boolean {
  return (
    shape === undefined ||
    shape === 'straight' ||
    shape === 'l_shape' ||
    shape === 'u_shape' ||
    shape === 'spiral' ||
    shape === 'sketch'
  );
}

function isKnownBalusterRule(rule: string | undefined): boolean {
  return (
    rule === undefined ||
    rule === 'regular' ||
    rule === 'glass_panel' ||
    rule === 'cable' ||
    rule === 'vertical'
  );
}

function hasRailingHostEdgeEvidence(railing: RailingElement): boolean {
  if (railing.hostedStairId) return true;
  const direct = railing as {
    hostEdgeId?: string | null;
    hostedEdgeId?: string | null;
    floorEdgeId?: string | null;
    hostFloorId?: string | null;
    edgeRef?: string | null;
  };
  const hostEvidenceKeys = [
    'hostEdgeId',
    'hostedEdgeId',
    'floorEdgeId',
    'hostFloorId',
    'edgeRef',
  ] as const;
  if (hostEvidenceKeys.some((key) => typeof direct[key] === 'string' && direct[key]!.length > 0)) {
    return true;
  }
  const props = (railing as { props?: Record<string, unknown> }).props ?? {};
  return hostEvidenceKeys.some(
    (key) => typeof props[key] === 'string' && String(props[key]).length > 0,
  );
}

function booleanProp(element: Element, propName: string): boolean {
  const props = (element as { props?: Record<string, unknown> }).props ?? {};
  return props[propName] === true;
}

function isTargetHouseTerraceFloor(floor: FloorElement): boolean {
  return TARGET_HOUSE_TERRACE_RE.test(`${floor.id} ${floor.name}`);
}

function railingCoverageForFloorBoundary(floor: FloorElement, railings: RailingElement[]): number {
  const perimeter = polygonPerimeter(floor.boundaryMm);
  if (perimeter <= 0) return 0;
  let nearbyLength = 0;
  for (const railing of railings) {
    const path = railing.pathMm ?? [];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!;
      const b = path[i + 1]!;
      if (segmentNearPolygonBoundary(a, b, floor.boundaryMm, 350)) {
        nearbyLength += distance(a, b);
      }
    }
  }
  return Math.min(1, nearbyLength / perimeter);
}

function segmentNearPolygonBoundary(
  a: PointMm,
  b: PointMm,
  polygon: PointMm[],
  toleranceMm: number,
): boolean {
  if (polygon.length < 2) return false;
  for (let i = 0; i < polygon.length; i++) {
    const c = polygon[i]!;
    const d = polygon[(i + 1) % polygon.length]!;
    if (
      segmentDistance(a, c, d) <= toleranceMm ||
      segmentDistance(b, c, d) <= toleranceMm ||
      segmentDistance(c, a, b) <= toleranceMm
    ) {
      return true;
    }
  }
  return false;
}

function polygonContainsPolygon(container: PointMm[], contained: PointMm[]): boolean {
  return contained.every((point) => pointInPolygonOrBoundary(point, container));
}

function polygonIntersectsPolygon(a: PointMm[], b: PointMm[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  if (!bboxesOverlap(bboxFor(a), bboxFor(b))) return false;
  if (a.some((point) => pointInPolygonOrBoundary(point, b))) return true;
  if (b.some((point) => pointInPolygonOrBoundary(point, a))) return true;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (segmentsIntersect(a[i]!, a[(i + 1) % a.length]!, b[j]!, b[(j + 1) % b.length]!)) {
        return true;
      }
    }
  }
  return false;
}

function pointInPolygonOrBoundary(point: PointMm, polygon: PointMm[]): boolean {
  if (polygon.length < 3) return false;
  for (let i = 0; i < polygon.length; i++) {
    if (pointOnSegment(point, polygon[i]!, polygon[(i + 1) % polygon.length]!)) return true;
  }
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const crosses =
      pi.yMm > point.yMm !== pj.yMm > point.yMm &&
      point.xMm < ((pj.xMm - pi.xMm) * (point.yMm - pi.yMm)) / (pj.yMm - pi.yMm) + pi.xMm;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointOnSegment(point: PointMm, a: PointMm, b: PointMm): boolean {
  const cross = (point.yMm - a.yMm) * (b.xMm - a.xMm) - (point.xMm - a.xMm) * (b.yMm - a.yMm);
  if (Math.abs(cross) > 1e-6) return false;
  const dot = (point.xMm - a.xMm) * (b.xMm - a.xMm) + (point.yMm - a.yMm) * (b.yMm - a.yMm);
  if (dot < -1e-6) return false;
  const lenSq = (b.xMm - a.xMm) ** 2 + (b.yMm - a.yMm) ** 2;
  return dot <= lenSq + 1e-6;
}

function segmentsIntersect(a: PointMm, b: PointMm, c: PointMm, d: PointMm): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (
    pointOnSegment(c, a, b) ||
    pointOnSegment(d, a, b) ||
    pointOnSegment(a, c, d) ||
    pointOnSegment(b, c, d)
  );
}

function orientation(a: PointMm, b: PointMm, c: PointMm): -1 | 0 | 1 {
  const value = (b.yMm - a.yMm) * (c.xMm - b.xMm) - (b.xMm - a.xMm) * (c.yMm - b.yMm);
  if (Math.abs(value) < 1e-6) return 0;
  return value > 0 ? 1 : -1;
}

function polygonAreaAbs(points: PointMm[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    area += a.xMm * b.yMm - b.xMm * a.yMm;
  }
  return Math.abs(area) / 2;
}

function polygonPerimeter(points: PointMm[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    total += distance(points[i]!, points[(i + 1) % points.length]!);
  }
  return total;
}

function centroid(points: PointMm[]): PointMm {
  if (points.length === 0) return { xMm: 0, yMm: 0 };
  const sum = points.reduce(
    (acc, point) => ({ xMm: acc.xMm + point.xMm, yMm: acc.yMm + point.yMm }),
    { xMm: 0, yMm: 0 },
  );
  return { xMm: sum.xMm / points.length, yMm: sum.yMm / points.length };
}

function bboxFor(
  points: PointMm[] | undefined,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!points || points.length === 0) return null;
  return {
    minX: Math.min(...points.map((point) => point.xMm)),
    minY: Math.min(...points.map((point) => point.yMm)),
    maxX: Math.max(...points.map((point) => point.xMm)),
    maxY: Math.max(...points.map((point) => point.yMm)),
  };
}

function bboxPolygonFor(points: PointMm[]): PointMm[] {
  const box = bboxFor(points);
  if (!box) return [];
  return [
    { xMm: box.minX, yMm: box.minY },
    { xMm: box.maxX, yMm: box.minY },
    { xMm: box.maxX, yMm: box.maxY },
    { xMm: box.minX, yMm: box.maxY },
  ];
}

function bboxesOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number } | null,
  b: { minX: number; minY: number; maxX: number; maxY: number } | null,
): boolean {
  if (!a || !b) return false;
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function distance(a: PointMm, b: PointMm): number {
  return Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm);
}

function segmentDistance(point: PointMm, a: PointMm, b: PointMm): number {
  const dx = b.xMm - a.xMm;
  const dy = b.yMm - a.yMm;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-6) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point.xMm - a.xMm) * dx + (point.yMm - a.yMm) * dy) / lenSq));
  return distance(point, { xMm: a.xMm + t * dx, yMm: a.yMm + t * dy });
}
