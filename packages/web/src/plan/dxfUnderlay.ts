import type { DxfLineworkPrim, Element, XY } from '@bim-ai/core';

/** FED-04 — `link_dxf` element shape for type-narrowed callers. */
export type LinkDxfElement = Extract<Element, { kind: 'link_dxf' }>;

/** Stroke colour for the desaturated underlay. */
export const DXF_UNDERLAY_STROKE = '#7f7f7f';
export const DXF_UNDERLAY_OPACITY = 0.5;
export const DXF_UNDERLAY_LINE_WIDTH = 1;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

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
): void {
  const linework: DxfLineworkPrim[] = link.linework ?? [];
  if (linework.length === 0) return;

  const color =
    link.colorMode === 'custom' && link.customColor ? link.customColor : DXF_UNDERLAY_STROKE;
  const opacity =
    typeof link.overlayOpacity === 'number' ? link.overlayOpacity : DXF_UNDERLAY_OPACITY;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = opacity;
  ctx.lineWidth = DXF_UNDERLAY_LINE_WIDTH;

  const transform = applyLinkTransform(link);

  for (const prim of linework) {
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

function applyLinkTransform(link: LinkDxfElement): (xy: XY) => XY {
  const ox = link.originMm.xMm;
  const oy = link.originMm.yMm;
  const scale = link.scaleFactor ?? 1;
  const rot = degToRad(link.rotationDeg ?? 0);
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  return ({ xMm, yMm }: XY): XY => {
    const sx = xMm * scale;
    const sy = yMm * scale;
    const rx = sx * cosR - sy * sinR;
    const ry = sx * sinR + sy * cosR;
    return { xMm: rx + ox, yMm: ry + oy };
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
    if (el.kind === 'link_dxf' && el.levelId === levelId) {
      out.push(el as LinkDxfElement);
    }
  }
  return out;
}
