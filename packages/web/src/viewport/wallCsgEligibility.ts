type WallCsgEligibilityInput = {
  csgEnabled: boolean;
  hostedDoorCount: number;
  hostedWindowCount: number;
  hostedWallOpeningCount: number;
  roofAttachmentId?: string | null;
  isCurtainWall?: boolean;
};

/**
 * NEXT-GAP-006 — determine whether a wall should use worker CSG hole-cutting.
 * Typed walls are intentionally eligible so hosted windows/openings carve
 * correctly instead of leaving visible solid-wall faces in apertures.
 * Roof-attached walls are also eligible: preserving a sloped top is less
 * important than keeping hosted glazing clear of wall skin. The roof mass
 * usually masks the upper wall edge, while an uncut opening is immediately
 * visible through the window.
 */
export function shouldRunWallOpeningCsg(input: WallCsgEligibilityInput): boolean {
  if (!input.csgEnabled) return false;
  const hasHostedCuts =
    input.hostedDoorCount > 0 || input.hostedWindowCount > 0 || input.hostedWallOpeningCount > 0;
  if (!hasHostedCuts) return false;
  if (Boolean(input.isCurtainWall)) return false;
  return true;
}
