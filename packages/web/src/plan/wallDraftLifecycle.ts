import { pointInsideCrop } from './cropRegionDragHandles';

type CropState = {
  cropMinMm: { xMm: number; yMm: number };
  cropMaxMm: { xMm: number; yMm: number };
  cropEnabled: boolean;
};

type WallPointMm = { xMm: number; yMm: number };

type PreviousWallForChain = {
  id: string;
  pathStart: WallPointMm;
  pathEnd: WallPointMm;
  actualStart: WallPointMm;
  actualEnd: WallPointMm;
  cornerEndpoint: 'start' | 'end';
};

export type WallDraftState = {
  kind: 'wall';
  sx: number;
  sy: number;
  previousWall?: PreviousWallForChain;
};

export function shouldBlockWallCommitOutsideCrop(
  cropState: CropState | null,
  start: WallPointMm,
  end: WallPointMm,
): boolean {
  if (!cropState || !cropState.cropEnabled) return false;
  return (
    !pointInsideCrop(cropState.cropMinMm, cropState.cropMaxMm, start.xMm, start.yMm) ||
    !pointInsideCrop(cropState.cropMinMm, cropState.cropMaxMm, end.xMm, end.yMm)
  );
}

export function nextWallDraftAfterCommit(params: {
  loopMode: boolean;
  endpoint: WallPointMm;
  previousWallForChain?: PreviousWallForChain;
}): WallDraftState | undefined {
  if (!params.loopMode) return undefined;
  return {
    kind: 'wall',
    sx: params.endpoint.xMm,
    sy: params.endpoint.yMm,
    previousWall: params.previousWallForChain,
  };
}

export const WALL_CROP_BLOCK_MESSAGE =
  'Wall endpoints must stay inside the active crop region (disable Crop View to draw outside).';
