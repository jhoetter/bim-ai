import type { ViewerRenderStyle } from '../state/storeTypes';

export const RASTER_HIGH_FIDELITY_STYLE: ViewerRenderStyle = 'high-fidelity';

type LegacyViewerRenderStyle = ViewerRenderStyle | 'path-trace-preview';

const VIEWER_RENDER_STYLES: readonly ViewerRenderStyle[] = [
  'shaded',
  'wireframe',
  'consistent-colors',
  'hidden-line',
  'realistic',
  'ray-trace',
  'high-fidelity',
];

export function normalizeViewerRenderStyle(style: LegacyViewerRenderStyle): ViewerRenderStyle {
  return style === 'ray-trace' || style === 'path-trace-preview'
    ? RASTER_HIGH_FIDELITY_STYLE
    : style;
}

export function isTextureRichRenderStyle(style: LegacyViewerRenderStyle): boolean {
  const normalized = normalizeViewerRenderStyle(style);
  return normalized === 'realistic' || normalized === RASTER_HIGH_FIDELITY_STYLE;
}

export function isRasterHighFidelityRenderStyle(style: LegacyViewerRenderStyle): boolean {
  return normalizeViewerRenderStyle(style) === RASTER_HIGH_FIDELITY_STYLE;
}

/**
 * Parse a render style from a query-string value (e.g. ``?renderStyle=wireframe``).
 *
 * Used by the capture pipeline so the headless Playwright runner can deep-link
 * into a viewer that already has ``viewerRenderStyle`` set to the requested
 * mode before the first frame is composited — see MF-render-3 (#27). The
 * capture-ortho-views driver emits one URL per (viewpoint, style) pair so a
 * grader can spot modeling defects that shaded surfaces hide (wireframe
 * exposes stray geometry, hidden-line clarifies eave/ridge intersections).
 *
 * Returns ``null`` for unknown / missing / malformed values so the caller can
 * fall back to the store default (``'realistic'``) silently.
 */
export function parseViewerRenderStyleParam(
  raw: string | null | undefined,
): ViewerRenderStyle | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim().toLowerCase();
  if (!trimmed) return null;
  const found = VIEWER_RENDER_STYLES.find((style) => style === trimmed);
  if (!found) return null;
  return normalizeViewerRenderStyle(found);
}

export type ViewerProjection = 'perspective' | 'orthographic';

const VIEWER_PROJECTIONS: readonly ViewerProjection[] = ['perspective', 'orthographic'];

/**
 * Parse a camera projection from a query-string value (e.g. ``?projection=orthographic``).
 *
 * MF-render-5 (#54): the ``capture-ortho-views`` driver names files
 * ``ortho-{n,s,e,w}.png`` but previously rendered them through the default
 * perspective camera — the saved viewpoint mode is ``orbit_3d`` (saveViewpoint
 * has no first-class orthographic mode). To make those files actually
 * orthographic without changing the saved viewpoint shape, the capture URL
 * carries ``?projection=orthographic`` and the viewer toggles
 * ``viewerProjection`` in the store on mount. The same orbit camera pose is
 * then re-projected through the ortho camera (see
 * ``orthoMode = viewerProjection === 'orthographic'`` in ``Viewport.tsx``).
 *
 * Returns ``null`` for unknown / missing / malformed values so the caller can
 * leave the store at its default (``'perspective'``).
 */
export function parseViewerProjectionParam(
  raw: string | null | undefined,
): ViewerProjection | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim().toLowerCase();
  if (!trimmed) return null;
  // Accept a few common aliases so URL-encoded values from grader runs and
  // hand-typed debug links both work.
  if (trimmed === 'ortho') return 'orthographic';
  if (trimmed === 'persp') return 'perspective';
  const found = VIEWER_PROJECTIONS.find((projection) => projection === trimmed);
  return found ?? null;
}
