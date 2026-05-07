/**
 * KRN-10 — pure rendering helpers for masking regions.
 *
 * A `masking_region` is a view-local 2D opaque polygon that occludes underlying
 * element linework while leaving annotations (dimensions, tags, detail
 * components) visible on top. Like detail components, masking regions are
 * scoped to a single host view and never appear in 3D.
 *
 * Z-order intent (host renderer applies):
 *   element wires < masking region < detail components, dimensions, tags
 */
import type { Element, XY } from '@bim-ai/core';

export type MaskingRegionPrimitive = {
  kind: 'masking_region';
  id: string;
  boundaryMm: XY[];
  fillColor: string;
};

export function extractMaskingRegionPrimitives(
  elementsById: Record<string, Element>,
  viewId: string | undefined,
): MaskingRegionPrimitive[] {
  if (!viewId) return [];
  const out: MaskingRegionPrimitive[] = [];
  for (const el of Object.values(elementsById)) {
    if (el.kind === 'masking_region' && el.hostViewId === viewId) {
      out.push({
        kind: 'masking_region',
        id: el.id,
        boundaryMm: el.boundaryMm,
        fillColor: el.fillColor ?? '#ffffff',
      });
    }
  }
  return out;
}
