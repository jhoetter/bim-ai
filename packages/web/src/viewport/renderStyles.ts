import type { ViewerRenderStyle } from '../state/storeTypes';

export const RASTER_HIGH_FIDELITY_STYLE: ViewerRenderStyle = 'high-fidelity';

type LegacyViewerRenderStyle = ViewerRenderStyle | 'path-trace-preview';

export function normalizeViewerRenderStyle(style: LegacyViewerRenderStyle): ViewerRenderStyle {
  return style === 'ray-trace' || style === 'path-trace-preview'
    ? RASTER_HIGH_FIDELITY_STYLE
    : style;
}

export function isTextureRichRenderStyle(style: LegacyViewerRenderStyle): boolean {
  const normalized = normalizeViewerRenderStyle(style);
  return (
    normalized === 'realistic' ||
    normalized === RASTER_HIGH_FIDELITY_STYLE
  );
}

export function isRasterHighFidelityRenderStyle(style: LegacyViewerRenderStyle): boolean {
  return normalizeViewerRenderStyle(style) === RASTER_HIGH_FIDELITY_STYLE;
}
