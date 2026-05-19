import type { Element } from '@bim-ai/core';

type RoofElement = Extract<Element, { kind: 'roof' }>;
type RoofOpeningElement = Extract<Element, { kind: 'roof_opening' }>;
type XY = { xMm: number; yMm: number };

export type RoofOpeningRenderDiagnosticSeverity = 'error' | 'warning' | 'info';

export type RoofOpeningRenderDiagnosticRuleId =
  | 'roof_opening_render_missing_host'
  | 'roof_opening_render_outside_host_footprint'
  | 'roof_opening_render_occupied_void_metadata_missing'
  | 'roof_opening_render_analytic_cut_unsupported'
  | 'roof_opening_render_edge_alignment_ambiguous';

export type RoofOpeningRenderDiagnostic = {
  ruleId: RoofOpeningRenderDiagnosticRuleId;
  severity: RoofOpeningRenderDiagnosticSeverity;
  elementIds: string[];
  message: string;
  details: Record<string, unknown>;
};

export type RoofOpeningRenderDiagnosticOptions = {
  /** Distance used by the current analytic asymmetric-gable path to snap authored opening edges. */
  analyticEdgeToleranceMm?: number;
  /** Target-house-critical openings close to, but not aligned with, an edge should block evidence. */
  criticalEdgeBandMm?: number;
  /** Large occupied roof courts/terraces need explicit render-support metadata. */
  largeOccupiedOpeningAreaMm2?: number;
};

const DEFAULT_ANALYTIC_EDGE_TOLERANCE_MM = 2;
const DEFAULT_CRITICAL_EDGE_BAND_MM = 250;
const DEFAULT_LARGE_OCCUPIED_OPENING_AREA_MM2 = 2_000_000;

export function diagnoseRoofOpeningRendering(
  elementsById: Record<string, Element>,
  options: RoofOpeningRenderDiagnosticOptions = {},
): RoofOpeningRenderDiagnostic[] {
  const analyticEdgeToleranceMm =
    options.analyticEdgeToleranceMm ?? DEFAULT_ANALYTIC_EDGE_TOLERANCE_MM;
  const criticalEdgeBandMm = options.criticalEdgeBandMm ?? DEFAULT_CRITICAL_EDGE_BAND_MM;
  const largeOccupiedOpeningAreaMm2 =
    options.largeOccupiedOpeningAreaMm2 ?? DEFAULT_LARGE_OCCUPIED_OPENING_AREA_MM2;

  const roofOpenings = Object.values(elementsById).filter(isRoofOpening);
  const diagnostics: RoofOpeningRenderDiagnostic[] = [];

  for (const opening of roofOpenings) {
    const host = elementsById[opening.hostRoofId];
    if (!isRoof(host)) {
      diagnostics.push({
        ruleId: 'roof_opening_render_missing_host',
        severity: 'error',
        elementIds: [opening.id, opening.hostRoofId].filter(Boolean),
        message: `Roof opening "${opening.id}" cannot be rendered because its host roof is missing.`,
        details: { hostRoofId: opening.hostRoofId },
      });
      continue;
    }

    const footprint = normalizedPolygon(host.footprintMm);
    const boundary = normalizedPolygon(opening.boundaryMm);
    if (footprint.length < 3 || boundary.length < 3) {
      diagnostics.push({
        ruleId: 'roof_opening_render_outside_host_footprint',
        severity: 'error',
        elementIds: [opening.id, host.id],
        message: `Roof opening "${opening.id}" cannot be validated against host roof "${host.id}".`,
        details: {
          hostFootprintVertexCount: footprint.length,
          openingBoundaryVertexCount: boundary.length,
        },
      });
      continue;
    }

    const outsideVertices = boundary.filter((point) => !pointInPolygonOrOnEdge(point, footprint));
    if (outsideVertices.length > 0) {
      diagnostics.push({
        ruleId: 'roof_opening_render_outside_host_footprint',
        severity: 'error',
        elementIds: [opening.id, host.id],
        message: `Roof opening "${opening.id}" extends outside host roof "${host.id}".`,
        details: {
          outsideVertexCount: outsideVertices.length,
          outsideVertices,
          hostBoundsMm: boundsFor(footprint),
          openingBoundsMm: boundsFor(boundary),
        },
      });
    }

    const openingAreaMm2 = Math.abs(polygonAreaMm2(boundary));
    const occupiedFeature = isOccupiedRoofVoid(opening);
    const renderSupport = renderSupportMetadata(opening);
    if (
      occupiedFeature &&
      openingAreaMm2 >= largeOccupiedOpeningAreaMm2 &&
      !hasRequiredOccupiedVoidRenderSupport(renderSupport)
    ) {
      diagnostics.push({
        ruleId: 'roof_opening_render_occupied_void_metadata_missing',
        severity: 'error',
        elementIds: [opening.id, host.id],
        message:
          `Occupied roof opening "${opening.id}" needs explicit render-support metadata ` +
          'for the cut, occupied floor, returns/curbs/parapets, guard, drainage, support, and evidence view.',
        details: {
          openingAreaMm2,
          requiredMetadata: [
            'cut',
            'occupiedFloor',
            'returns',
            'guard',
            'drainage',
            'support',
            'evidenceView',
          ],
          presentMetadata: renderSupport,
        },
      });
    }

    const analyticUnsupported = analyticRoofOpeningUnsupportedReason(
      host,
      opening,
      elementsById,
      analyticEdgeToleranceMm,
    );
    if (analyticUnsupported) {
      diagnostics.push({
        ruleId: 'roof_opening_render_analytic_cut_unsupported',
        severity: isTargetHouseCritical(opening) ? 'error' : 'warning',
        elementIds: [opening.id, host.id],
        message:
          `Roof opening "${opening.id}" is likely unsupported by the current analytic roof-cut path: ` +
          analyticUnsupported.reason,
        details: analyticUnsupported,
      });
    }

    const edgeDistanceMm = minDistanceToPolygonEdges(boundary, footprint);
    if (
      isTargetHouseCritical(opening) &&
      edgeDistanceMm > analyticEdgeToleranceMm &&
      edgeDistanceMm < criticalEdgeBandMm
    ) {
      diagnostics.push({
        ruleId: 'roof_opening_render_edge_alignment_ambiguous',
        severity: 'error',
        elementIds: [opening.id, host.id],
        message:
          `Target-house-critical roof opening "${opening.id}" is close to a roof edge ` +
          'but not aligned closely enough for reliable evidence rendering.',
        details: {
          minDistanceToRoofEdgeMm: edgeDistanceMm,
          analyticEdgeToleranceMm,
          criticalEdgeBandMm,
          hostBoundsMm: boundsFor(footprint),
          openingBoundsMm: boundsFor(boundary),
        },
      });
    }
  }

  return diagnostics;
}

function isRoof(element: Element | undefined): element is RoofElement {
  return element?.kind === 'roof';
}

function isRoofOpening(element: Element): element is RoofOpeningElement {
  return element.kind === 'roof_opening';
}

function normalizedPolygon(points: XY[] | undefined): XY[] {
  return (points ?? []).filter((point) => Number.isFinite(point.xMm) && Number.isFinite(point.yMm));
}

function boundsFor(points: XY[]): { minX: number; maxX: number; minY: number; maxY: number } {
  const xs = points.map((point) => point.xMm);
  const ys = points.map((point) => point.yMm);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function polygonAreaMm2(points: XY[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.xMm * next.yMm - next.xMm * current.yMm;
  }
  return area / 2;
}

function pointInPolygonOrOnEdge(point: XY, polygon: XY[], toleranceMm = 1): boolean {
  for (let index = 0; index < polygon.length; index += 1) {
    if (
      distancePointToSegmentMm(point, polygon[index], polygon[(index + 1) % polygon.length]) <=
      toleranceMm
    ) {
      return true;
    }
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersects =
      pi.yMm > point.yMm !== pj.yMm > point.yMm &&
      point.xMm < ((pj.xMm - pi.xMm) * (point.yMm - pi.yMm)) / (pj.yMm - pi.yMm) + pi.xMm;
    if (intersects) inside = !inside;
  }
  return inside;
}

function minDistanceToPolygonEdges(inner: XY[], outer: XY[]): number {
  let minDistance = Number.POSITIVE_INFINITY;
  for (const point of inner) {
    for (let index = 0; index < outer.length; index += 1) {
      minDistance = Math.min(
        minDistance,
        distancePointToSegmentMm(point, outer[index], outer[(index + 1) % outer.length]),
      );
    }
  }
  return minDistance;
}

function distancePointToSegmentMm(point: XY, a: XY, b: XY): number {
  const dx = b.xMm - a.xMm;
  const dy = b.yMm - a.yMm;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-9) return Math.hypot(point.xMm - a.xMm, point.yMm - a.yMm);
  const t = Math.max(0, Math.min(1, ((point.xMm - a.xMm) * dx + (point.yMm - a.yMm) * dy) / lenSq));
  const x = a.xMm + t * dx;
  const y = a.yMm + t * dy;
  return Math.hypot(point.xMm - x, point.yMm - y);
}

function lowerTokens(opening: RoofOpeningElement): string {
  const props = readProps(opening);
  return [
    opening.id,
    opening.name,
    stringProp(props, 'featureKind'),
    stringProp(props, 'featureId'),
    stringProp(props, 'briefFeatureId'),
    stringProp(props, 'spaceType'),
    stringProp(props, 'acceptanceRole'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isOccupiedRoofVoid(opening: RoofOpeningElement): boolean {
  const props = readProps(opening);
  if (booleanProp(props, 'occupiedRoofVoid') || booleanProp(props, 'occupiedTerrace')) return true;
  return /\b(terrace|court|roof[-_\s]?terrace|loggia|occupied)\b/.test(lowerTokens(opening));
}

function isTargetHouseCritical(opening: RoofOpeningElement): boolean {
  const props = readProps(opening);
  if (booleanProp(props, 'targetHouseCritical') || booleanProp(props, 'criticalEvidenceFeature')) {
    return true;
  }
  return /\b(target[-_\s]?house|terrace|court|roof[-_\s]?terrace)\b/.test(lowerTokens(opening));
}

function readProps(opening: RoofOpeningElement): Record<string, unknown> {
  const value = (opening as RoofOpeningElement & { props?: unknown }).props;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringProp(props: Record<string, unknown>, key: string): string | null {
  const value = props[key];
  return typeof value === 'string' ? value : null;
}

function booleanProp(props: Record<string, unknown>, key: string): boolean {
  return props[key] === true;
}

function renderSupportMetadata(opening: RoofOpeningElement): Record<string, unknown> {
  const props = readProps(opening);
  const candidates = [props.renderSupport, props.roofOpeningRenderSupport, props.rendererSupport];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }
  return {};
}

function hasRequiredOccupiedVoidRenderSupport(metadata: Record<string, unknown>): boolean {
  return ['cut', 'occupiedFloor', 'returns', 'guard', 'drainage', 'support', 'evidenceView'].every(
    (key) => metadata[key] === true || typeof metadata[key] === 'string',
  );
}

function analyticRoofOpeningUnsupportedReason(
  roof: RoofElement,
  opening: RoofOpeningElement,
  elementsById: Record<string, Element>,
  analyticEdgeToleranceMm: number,
): { reason: string; [key: string]: unknown } | null {
  const mode = roof.roofGeometryMode ?? 'gable_pitched_rectangle';
  if (!['asymmetric_gable', 'gable_pitched_rectangle'].includes(mode)) return null;

  const openingsForHost = Object.values(elementsById).filter(
    (element): element is RoofOpeningElement =>
      element.kind === 'roof_opening' && element.hostRoofId === roof.id,
  );
  const roofBounds = boundsFor(normalizedPolygon(roof.footprintMm));
  const openingBounds = boundsFor(normalizedPolygon(opening.boundaryMm));
  const ridgeAlongX = resolveRidgeAlongX(roof);

  if (mode === 'gable_pitched_rectangle') {
    return {
      reason:
        'gable roof openings currently require CSG/fallback support rather than the analytic roof-opening path',
      roofGeometryMode: mode,
    };
  }

  if (ridgeAlongX) {
    return {
      reason:
        'asymmetric gable analytic opening path only supports ridges running along the plan Y/Z axis',
      ridgeAxis: roof.ridgeAxis ?? null,
    };
  }
  if (openingsForHost.length !== 1) {
    return {
      reason:
        'asymmetric gable analytic opening path only supports exactly one hosted roof opening',
      hostedOpeningCount: openingsForHost.length,
    };
  }
  if ((roof.footprintMm ?? []).length !== 4) {
    return {
      reason:
        'asymmetric gable analytic opening path only supports rectangular four-point roof footprints',
      hostFootprintVertexCount: roof.footprintMm?.length ?? 0,
    };
  }

  const ridgeX = asymmetricRidgeX(roof, roofBounds);
  const opensEastSlope = openingBounds.minX > ridgeX;
  const alignsWithEastEdge =
    Math.abs(openingBounds.maxX - roofBounds.maxX) <= analyticEdgeToleranceMm;
  const staysInsideDepth =
    openingBounds.minY > roofBounds.minY && openingBounds.maxY < roofBounds.maxY;
  if (!opensEastSlope || !alignsWithEastEdge || !staysInsideDepth) {
    return {
      reason:
        'asymmetric gable cut must sit on the east slope, align to the east roof edge, and stay inside roof depth',
      roofGeometryMode: mode,
      roofBoundsMm: roofBounds,
      openingBoundsMm: openingBounds,
      ridgeX,
      opensEastSlope,
      alignsWithEastEdge,
      staysInsideDepth,
      analyticEdgeToleranceMm,
    };
  }
  return null;
}

function resolveRidgeAlongX(roof: RoofElement): boolean {
  if (roof.ridgeAxis === 'x') return true;
  if (roof.ridgeAxis === 'z') return false;
  const bounds = boundsFor(normalizedPolygon(roof.footprintMm));
  return bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY;
}

function asymmetricRidgeX(
  roof: RoofElement,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): number {
  const halfSpan = (bounds.maxX - bounds.minX) / 2;
  const center = (bounds.minX + bounds.maxX) / 2;
  const rawOffset = roof.ridgeOffsetTransverseMm ?? 0;
  const offset = Math.max(-halfSpan + 0.001, Math.min(halfSpan - 0.001, rawOffset));
  return center + offset;
}
