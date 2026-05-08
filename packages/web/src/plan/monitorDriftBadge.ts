import type { Element, MonitorSource, XY } from '@bim-ai/core';

/** FED-03 — element shape narrowed to "carries an optional `monitorSource`". */
export type ElementWithMonitorSource = Element & { monitorSource?: MonitorSource | null };

export interface BadgeRect {
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
}

export const DRIFT_BADGE_FILL = '#FBBF24';
export const DRIFT_BADGE_STROKE = '#92400E';
export const DRIFT_BADGE_SIZE_PX = 16;

/**
 * FED-03 — true when the element's `monitorSource` says the source has
 * drifted *and* enumerates at least one drifted field. The bumpMonitored
 * command flips both atomically, so testing both keeps spurious badges
 * from showing during partial state.
 */
export function elementHasDrift(elem: object): boolean {
  const ms = (elem as { monitorSource?: MonitorSource | null }).monitorSource ?? null;
  if (!ms) return false;
  if (!ms.drifted) return false;
  const fields = ms.driftedFields ?? [];
  return fields.length > 0;
}

/**
 * FED-03 — count how many fields drifted. Used by the tooltip
 * "Monitored source has drifted — N field(s) differ".
 */
export function driftedFieldCount(elem: object): number {
  return (
    (elem as { monitorSource?: MonitorSource | null }).monitorSource?.driftedFields?.length ?? 0
  );
}

/**
 * FED-03 — render a 16×16 yellow-triangle drift badge centred on
 * `centerPx` (already in screen-space). Returns the screen-space hit
 * rect for click handling. Caller is responsible for clipping the badge
 * inside the visible canvas region.
 */
export function renderMonitorDriftBadge(
  ctx: CanvasRenderingContext2D,
  centerPx: { xPx: number; yPx: number },
  options: { sizePx?: number } = {},
): BadgeRect {
  const sz = options.sizePx ?? DRIFT_BADGE_SIZE_PX;
  const half = sz / 2;
  const cx = centerPx.xPx;
  const cy = centerPx.yPx;

  ctx.save();
  ctx.fillStyle = DRIFT_BADGE_FILL;
  ctx.strokeStyle = DRIFT_BADGE_STROKE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - half);
  ctx.lineTo(cx + half, cy + half);
  ctx.lineTo(cx - half, cy + half);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  return { xPx: cx - half, yPx: cy - half, widthPx: sz, heightPx: sz };
}

/**
 * Build a small offscreen canvas containing the drift badge, suitable
 * for use as a `THREE.CanvasTexture`. Used by the 3D viewport sprite
 * layer so the badge renders identically to the plan canvas.
 */
export function buildDriftBadgeCanvas(sizePx = 64): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  renderMonitorDriftBadge(ctx, { xPx: sizePx / 2, yPx: sizePx / 2 }, { sizePx });
  return canvas;
}

/**
 * Plan-centroid for an element used to anchor the drift badge.
 *
 * Returns `null` when the element shape doesn't carry plan-space
 * geometry (the badge layer skips those silently). Falls back to common
 * geometry fields without inspecting the full element discriminator
 * union — every element kind that hosts a `monitorSource` today
 * (`level`, `grid_line`, future kinds) ships at least one of:
 * `position*Mm`, `start*Mm` + `end*Mm`, `boundary*Mm`, or `footprint*Mm`.
 */
export function elementBadgeAnchorMm(elem: Element): XY | null {
  const e = elem as unknown as Record<string, unknown>;
  const pos = e.positionMm as XY | undefined;
  if (pos && typeof pos.xMm === 'number' && typeof pos.yMm === 'number') return pos;
  const start = e.startMm as XY | undefined;
  const end = e.endMm as XY | undefined;
  if (
    start &&
    end &&
    typeof start.xMm === 'number' &&
    typeof start.yMm === 'number' &&
    typeof end.xMm === 'number' &&
    typeof end.yMm === 'number'
  ) {
    return { xMm: (start.xMm + end.xMm) / 2, yMm: (start.yMm + end.yMm) / 2 };
  }
  for (const key of ['boundaryMm', 'footprintMm', 'outlineMm', 'pointsMm']) {
    const poly = e[key] as XY[] | undefined;
    if (Array.isArray(poly) && poly.length > 0) {
      let sx = 0;
      let sy = 0;
      for (const p of poly) {
        sx += p.xMm;
        sy += p.yMm;
      }
      return { xMm: sx / poly.length, yMm: sy / poly.length };
    }
  }
  return null;
}

/**
 * Hit-test a screen-space point against a list of badge hit rects. Used
 * by the plan canvas pointer-down handler to map a click to an element.
 */
export function pickDriftBadgeAt(
  point: { xPx: number; yPx: number },
  hits: { elementId: string; rect: BadgeRect }[],
): string | null {
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i]!;
    const r = h.rect;
    if (
      point.xPx >= r.xPx &&
      point.xPx <= r.xPx + r.widthPx &&
      point.yPx >= r.yPx &&
      point.yPx <= r.yPx + r.heightPx
    ) {
      return h.elementId;
    }
  }
  return null;
}

/**
 * Build the tooltip string the badge shows on hover. Kept here so the
 * plan canvas + 3D viewport agree on the wording.
 */
export function driftBadgeTooltip(elem: object): string {
  const n = driftedFieldCount(elem);
  return `Monitored source has drifted — ${n} field(s) differ`;
}

/**
 * Walk the snapshot's elements and return the rows that should render a
 * drift badge. Currently equivalent to "every element with drifted
 * monitorSource"; centralised so the canvas + 3D layers stay in sync.
 */
export function selectDriftedElements(elementsById: Record<string, Element>): Element[] {
  const out: Element[] = [];
  for (const el of Object.values(elementsById)) {
    if (elementHasDrift(el as ElementWithMonitorSource)) out.push(el);
  }
  return out;
}
