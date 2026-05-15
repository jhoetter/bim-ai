import type { ViewerRenderStyle } from '../state/storeTypes';

export const RASTER_HIGH_FIDELITY_STYLE: ViewerRenderStyle = 'high-fidelity';
export const PATH_TRACE_PREVIEW_STYLE: ViewerRenderStyle = 'path-trace-preview';

export function normalizeViewerRenderStyle(style: ViewerRenderStyle): ViewerRenderStyle {
  return style === 'ray-trace' ? RASTER_HIGH_FIDELITY_STYLE : style;
}

export function isTextureRichRenderStyle(style: ViewerRenderStyle): boolean {
  const normalized = normalizeViewerRenderStyle(style);
  return (
    normalized === 'realistic' ||
    normalized === RASTER_HIGH_FIDELITY_STYLE ||
    normalized === PATH_TRACE_PREVIEW_STYLE
  );
}

export function isRasterHighFidelityRenderStyle(style: ViewerRenderStyle): boolean {
  return normalizeViewerRenderStyle(style) === RASTER_HIGH_FIDELITY_STYLE;
}

export function isPathTraceRenderStyle(style: ViewerRenderStyle): boolean {
  return normalizeViewerRenderStyle(style) === PATH_TRACE_PREVIEW_STYLE;
}
