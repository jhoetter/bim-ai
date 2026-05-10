import type { DxfLineworkPrim, Element, XY } from '@bim-ai/core';
import type { CategoryOverride } from '../state/storeTypes';

/** FED-04 — `link_dxf` element shape for type-narrowed callers. */
export type LinkDxfElement = Extract<Element, { kind: 'link_dxf' }>;

/** Stroke colour for the desaturated underlay. */
export const DXF_UNDERLAY_STROKE = '#7f7f7f';
export const DXF_UNDERLAY_OPACITY = 0.5;
export const DXF_UNDERLAY_LINE_WIDTH = 1;

export type DxfUnderlayStyle = {
  color: string;
  opacity: number;
  colorMode: NonNullable<LinkDxfElement['colorMode']>;
};

export type DxfAlignmentMode = NonNullable<LinkDxfElement['originAlignmentMode']>;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export type DxfPrimitiveQueryHit = {
  link: LinkDxfElement;
  primitive: DxfLineworkPrim;
  primitiveIndex: number;
  layerName: string;
  color: string;
  distanceMm: number;
};

/**
 * FED-04 — render a single `link_dxf` element's linework as desaturated
 * grey strokes onto a 2D canvas context. `worldToScreen` maps the host's
 * authoring frame (mm, +Y is north on plan) into pixel coordinates.
 *
 * The function applies the link's `originMm`, `rotationDeg`, and
 * `scaleFactor` to each primitive before passing it to `worldToScreen`.
 */
export function renderDxfUnderlay(
  ctx: CanvasRenderingContext2D,
  link: LinkDxfElement,
  worldToScreen: (xy: XY) => [number, number],
  elementsById?: Record<string, Element>,
): void {
  const linework: DxfLineworkPrim[] = link.linework ?? [];
  if (linework.length === 0) return;

  const style = resolveDxfUnderlayStyle(link);

  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.globalAlpha = style.opacity;
  ctx.lineWidth = DXF_UNDERLAY_LINE_WIDTH;

  const transform = makeDxfLinkTransform(link, elementsById);

  for (const prim of linework) {
    if (isDxfLayerHidden(link, prim)) continue;
    ctx.strokeStyle = resolveDxfPrimitiveColor(link, prim, style);
    if (prim.kind === 'line') {
      const [sx, sy] = worldToScreen(transform(prim.start));
      const [ex, ey] = worldToScreen(transform(prim.end));
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    } else if (prim.kind === 'polyline') {
      if (prim.points.length < 2) continue;
      ctx.beginPath();
      for (let i = 0; i < prim.points.length; i++) {
        const [px, py] = worldToScreen(transform(prim.points[i]!));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      if (prim.closed) ctx.closePath();
      ctx.stroke();
    } else if (prim.kind === 'arc') {
      const segments = arcToPolylineSegments(prim);
      if (segments.length < 2) continue;
      ctx.beginPath();
      for (let i = 0; i < segments.length; i++) {
        const [px, py] = worldToScreen(transform(segments[i]!));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function dxfPrimitiveLayerName(prim: DxfLineworkPrim): string {
  return prim.layerName ?? '0';
}

export function hiddenDxfLayerNamesForView(
  link: LinkDxfElement,
  viewOverride?: CategoryOverride,
): string[] {
  return Array.from(
    new Set([...(link.hiddenLayerNames ?? []), ...(viewOverride?.dxf?.hiddenLayerNames ?? [])]),
  );
}

export function isDxfLayerHiddenByName(
  link: LinkDxfElement,
  layerName: string,
  viewOverride?: CategoryOverride,
): boolean {
  return hiddenDxfLayerNamesForView(link, viewOverride).includes(layerName);
}

export function isDxfLayerHidden(
  link: LinkDxfElement,
  prim: DxfLineworkPrim,
  viewOverride?: CategoryOverride,
): boolean {
  return isDxfLayerHiddenByName(link, dxfPrimitiveLayerName(prim), viewOverride);
}

export function setDxfLayerHiddenInView(
  override: CategoryOverride | undefined,
  layerName: string,
  hidden: boolean,
): CategoryOverride {
  const current = override?.dxf?.hiddenLayerNames ?? [];
  const next = hidden
    ? Array.from(new Set([...current, layerName]))
    : current.filter((name) => name !== layerName);
  return {
    ...(override ?? {}),
    dxf: {
      ...(override?.dxf ?? {}),
      hiddenLayerNames: next,
    },
  };
}

export function resolveDxfLayerRows(
  link: LinkDxfElement,
): { name: string; color?: string; primitiveCount: number }[] {
  if (link.dxfLayers?.length) {
    return link.dxfLayers.map((row) => {
      const out: { name: string; color?: string; primitiveCount: number } = {
        name: row.name,
        primitiveCount: row.primitiveCount ?? 0,
      };
      if (row.color) out.color = row.color;
      return out;
    });
  }
  const rows = new Map<string, { name: string; color?: string; primitiveCount: number }>();
  for (const prim of link.linework ?? []) {
    const name = prim.layerName ?? '0';
    const row = rows.get(name) ?? { name, primitiveCount: 0 };
    row.primitiveCount += 1;
    if (prim.layerColor && !row.color) row.color = prim.layerColor;
    rows.set(name, row);
  }
  return Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function resolveDxfUnderlayStyle(
  link: LinkDxfElement,
  viewOverride?: CategoryOverride,
): DxfUnderlayStyle {
  const baseOpacity =
    typeof link.overlayOpacity === 'number' ? link.overlayOpacity : DXF_UNDERLAY_OPACITY;
  const transparency = viewOverride?.projection?.transparency;
  const overrideOpacity =
    typeof transparency === 'number'
      ? 1 - Math.max(0, Math.min(100, transparency)) / 100
      : undefined;
  const halftoneOpacity = viewOverride?.projection?.halftone ? 0.5 : undefined;
  return {
    color: link.colorMode === 'custom' && link.customColor ? link.customColor : DXF_UNDERLAY_STROKE,
    opacity: clamp01(overrideOpacity ?? halftoneOpacity ?? baseOpacity),
    colorMode: link.colorMode ?? 'black_white',
  };
}

export function resolveDxfPrimitiveColor(
  link: LinkDxfElement,
  prim: DxfLineworkPrim,
  style = resolveDxfUnderlayStyle(link),
): string {
  if (style.colorMode === 'native' && prim.layerColor) return prim.layerColor;
  return style.color;
}

export function dxfViewOverrideKey(linkId: string): string {
  return `link_dxf:${linkId}`;
}

export function isDxfLinkVisibleInView(
  link: LinkDxfElement,
  viewOverride?: CategoryOverride,
): boolean {
  return link.loaded !== false && viewOverride?.visible !== false;
}

function findOriginPoint(
  elementsById: Record<string, Element> | undefined,
  kind: 'project_base_point' | 'survey_point',
): { xMm: number; yMm: number } | undefined {
  if (!elementsById) return undefined;
  for (const el of Object.values(elementsById)) {
    if (el.kind !== kind) continue;
    return { xMm: el.positionMm.xMm, yMm: el.positionMm.yMm };
  }
  return undefined;
}

export function resolveDxfAlignmentAnchorMm(
  link: LinkDxfElement,
  elementsById?: Record<string, Element>,
): XY {
  const mode: DxfAlignmentMode = link.originAlignmentMode ?? 'origin_to_origin';
  const base =
    mode === 'project_origin'
      ? findOriginPoint(elementsById, 'project_base_point')
      : mode === 'shared_coords'
        ? findOriginPoint(elementsById, 'survey_point')
        : undefined;
  return {
    xMm: (base?.xMm ?? 0) + link.originMm.xMm,
    yMm: (base?.yMm ?? 0) + link.originMm.yMm,
  };
}

export function makeDxfLinkTransform(
  link: LinkDxfElement,
  elementsById?: Record<string, Element>,
): (xy: XY) => XY {
  const anchor = resolveDxfAlignmentAnchorMm(link, elementsById);
  const scale = link.scaleFactor ?? 1;
  const rot = degToRad(link.rotationDeg ?? 0);
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  return ({ xMm, yMm }: XY): XY => {
    const sx = xMm * scale;
    const sy = yMm * scale;
    const rx = sx * cosR - sy * sinR;
    const ry = sx * sinR + sy * cosR;
    return { xMm: rx + anchor.xMm, yMm: ry + anchor.yMm };
  };
}

function arcToPolylineSegments(arc: Extract<DxfLineworkPrim, { kind: 'arc' }>): XY[] {
  const cx = arc.center.xMm;
  const cy = arc.center.yMm;
  const r = arc.radiusMm;
  const start = arc.startDeg;
  let end = arc.endDeg;
  if (end < start) end += 360;
  const sweep = Math.max(0.0001, end - start);
  const stepDeg = 3;
  const steps = Math.max(2, Math.ceil(sweep / stepDeg));
  const out: XY[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = start + (sweep * i) / steps;
    const rad = degToRad(t);
    out.push({ xMm: cx + r * Math.cos(rad), yMm: cy + r * Math.sin(rad) });
  }
  return out;
}

function distancePointToSegmentMm(p: XY, a: XY, b: XY): number {
  const dx = b.xMm - a.xMm;
  const dy = b.yMm - a.yMm;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-9) return Math.hypot(p.xMm - a.xMm, p.yMm - a.yMm);
  const t = Math.max(0, Math.min(1, ((p.xMm - a.xMm) * dx + (p.yMm - a.yMm) * dy) / len2));
  const x = a.xMm + dx * t;
  const y = a.yMm + dy * t;
  return Math.hypot(p.xMm - x, p.yMm - y);
}

function primitiveSegmentsMm(prim: DxfLineworkPrim): Array<[XY, XY]> {
  if (prim.kind === 'line') return [[prim.start, prim.end]];
  if (prim.kind === 'polyline') {
    const segments: Array<[XY, XY]> = [];
    for (let i = 0; i < prim.points.length - 1; i++) {
      segments.push([prim.points[i]!, prim.points[i + 1]!]);
    }
    if (prim.closed && prim.points.length > 2) {
      segments.push([prim.points[prim.points.length - 1]!, prim.points[0]!]);
    }
    return segments;
  }
  const arcPts = arcToPolylineSegments(prim);
  const segments: Array<[XY, XY]> = [];
  for (let i = 0; i < arcPts.length - 1; i++) {
    segments.push([arcPts[i]!, arcPts[i + 1]!]);
  }
  return segments;
}

export function queryDxfPrimitiveAtPoint(
  links: LinkDxfElement[],
  pointMm: XY,
  opts: {
    toleranceMm: number;
    elementsById?: Record<string, Element>;
    viewOverridesByLinkId?: Record<string, CategoryOverride | undefined>;
  },
): DxfPrimitiveQueryHit | null {
  let best: DxfPrimitiveQueryHit | null = null;
  for (const link of links) {
    if (link.loaded === false) continue;
    if (!link.linework || link.linework.length === 0) continue;
    const viewOverride = opts.viewOverridesByLinkId?.[link.id];
    if (!isDxfLinkVisibleInView(link, viewOverride)) continue;
    const transform = makeDxfLinkTransform(link, opts.elementsById);
    const style = resolveDxfUnderlayStyle(link, viewOverride);
    for (let primitiveIndex = 0; primitiveIndex < link.linework.length; primitiveIndex++) {
      const primitive = link.linework[primitiveIndex]!;
      if (isDxfLayerHidden(link, primitive, viewOverride)) continue;
      let primitiveDistance = Infinity;
      for (const [rawA, rawB] of primitiveSegmentsMm(primitive)) {
        const distance = distancePointToSegmentMm(pointMm, transform(rawA), transform(rawB));
        if (distance < primitiveDistance) primitiveDistance = distance;
      }
      if (primitiveDistance > opts.toleranceMm) continue;
      if (best && primitiveDistance >= best.distanceMm) continue;
      const layerName = dxfPrimitiveLayerName(primitive);
      best = {
        link,
        primitive,
        primitiveIndex,
        layerName,
        color: resolveDxfPrimitiveColor(link, primitive, style),
        distanceMm: primitiveDistance,
      };
    }
  }
  return best;
}

/**
 * Filter a snapshot's elements down to the `link_dxf` rows that should
 * render on `levelId`. Used by PlanCanvas to know what to draw before the
 * regular element-render loop runs.
 */
export function selectDxfUnderlaysForLevel(
  elementsById: Record<string, Element>,
  levelId: string | undefined,
): LinkDxfElement[] {
  if (!levelId) return [];
  const out: LinkDxfElement[] = [];
  for (const el of Object.values(elementsById)) {
    if (el.kind === 'link_dxf' && el.levelId === levelId && el.loaded !== false) {
      out.push(el as LinkDxfElement);
    }
  }
  return out;
}
