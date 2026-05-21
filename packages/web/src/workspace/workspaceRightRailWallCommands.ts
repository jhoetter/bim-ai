import type { Element } from '@bim-ai/core';

import { elevationFromWall, sectionCutFromWall } from '../lib/sectionElevationFromWall';

export function insertDoorOnWallCenterCommand(
  wall: Extract<Element, { kind: 'wall' }>,
): Record<string, unknown> {
  return {
    type: 'insertDoorOnWall',
    wallId: wall.id,
    alongT: 0.5,
    widthMm: 900,
  };
}

export function insertWindowOnWallCenterCommand(
  wall: Extract<Element, { kind: 'wall' }>,
): Record<string, unknown> {
  return {
    type: 'insertWindowOnWall',
    wallId: wall.id,
    alongT: 0.5,
    widthMm: 1200,
    sillHeightMm: 900,
    heightMm: 1500,
  };
}

export function createWallOpeningCenterCommand(
  wall: Extract<Element, { kind: 'wall' }>,
): Record<string, unknown> {
  return {
    type: 'createWallOpening',
    hostWallId: wall.id,
    alongTStart: 0.45,
    alongTEnd: 0.55,
    sillHeightMm: 200,
    headHeightMm: 2400,
  };
}

export function createSectionFromWallCommand(wall: Extract<Element, { kind: 'wall' }>): {
  id: string;
  cmd: Record<string, unknown>;
} {
  const params = sectionCutFromWall(wall);
  const id = `sc-${crypto.randomUUID().slice(0, 10)}`;
  return {
    id,
    cmd: {
      type: 'createSectionCut',
      id,
      name: params.name,
      lineStartMm: params.lineStartMm,
      lineEndMm: params.lineEndMm,
      cropDepthMm: params.cropDepthMm,
    },
  };
}

export function createElevationFromWallCommand(wall: Extract<Element, { kind: 'wall' }>): {
  id: string;
  cmd: Record<string, unknown>;
} {
  const params = elevationFromWall(wall);
  const id = `ev-${crypto.randomUUID().slice(0, 10)}`;
  const cmd: Record<string, unknown> = {
    type: 'createElevationView',
    id,
    name: params.name,
    direction: params.direction,
    cropMinMm: params.cropMinMm,
    cropMaxMm: params.cropMaxMm,
  };
  if (params.direction === 'custom' && params.customAngleDeg !== null) {
    cmd.customAngleDeg = params.customAngleDeg;
  }
  return { id, cmd };
}
