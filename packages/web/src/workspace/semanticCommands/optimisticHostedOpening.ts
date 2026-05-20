import type { Element } from '@bim-ai/core';

import { isPhysicalHostedOpeningWall } from '../../viewport/directAuthoringGuards';

function finiteNumber(value: unknown, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, finiteNumber(value, fallback)));
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function materializeOptimisticHostedOpening(
  cmd: Record<string, unknown>,
  elementsById: Record<string, Element>,
): { command: Record<string, unknown>; element: Element } | null {
  if (
    cmd.type !== 'insertDoorOnWall' &&
    cmd.type !== 'insertWindowOnWall' &&
    cmd.type !== 'createWallOpening'
  ) {
    return null;
  }

  const hostWallId =
    cmd.type === 'createWallOpening' ? optionalString(cmd.hostWallId) : optionalString(cmd.wallId);
  if (!hostWallId) return null;
  const host = elementsById[hostWallId];
  if (!host || host.kind !== 'wall' || !isPhysicalHostedOpeningWall(host)) return null;

  const id = optionalString(cmd.id) ?? crypto.randomUUID();
  if (elementsById[id]) return null;
  const command = { ...cmd, id };

  if (cmd.type === 'insertDoorOnWall') {
    return {
      command,
      element: {
        kind: 'door',
        id,
        name: optionalString(cmd.name) ?? 'Door',
        wallId: hostWallId,
        alongT: clampNumber(cmd.alongT, 0.5, 0, 1),
        widthMm: Math.max(1, finiteNumber(cmd.widthMm, 900)),
        ...(optionalString(cmd.familyTypeId)
          ? { familyTypeId: optionalString(cmd.familyTypeId) }
          : {}),
        discipline: 'arch',
      },
    };
  }

  if (cmd.type === 'insertWindowOnWall') {
    return {
      command,
      element: {
        kind: 'window',
        id,
        name: optionalString(cmd.name) ?? 'Window',
        wallId: hostWallId,
        alongT: clampNumber(cmd.alongT, 0.5, 0, 1),
        widthMm: Math.max(1, finiteNumber(cmd.widthMm, 1200)),
        sillHeightMm: Math.max(0, finiteNumber(cmd.sillHeightMm, 900)),
        heightMm: Math.max(1, finiteNumber(cmd.heightMm, 1500)),
        ...(optionalString(cmd.familyTypeId)
          ? { familyTypeId: optionalString(cmd.familyTypeId) }
          : {}),
        discipline: 'arch',
      },
    };
  }

  const alongTStart = clampNumber(cmd.alongTStart, 0.45, 0, 1);
  const alongTEnd = clampNumber(cmd.alongTEnd, 0.55, 0, 1);
  const sillHeightMm = Math.max(0, finiteNumber(cmd.sillHeightMm, 200));
  const headHeightMm = Math.max(0, finiteNumber(cmd.headHeightMm, 2400));
  if (alongTStart >= alongTEnd || headHeightMm <= sillHeightMm || headHeightMm > host.heightMm) {
    return null;
  }

  return {
    command,
    element: {
      kind: 'wall_opening',
      id,
      name: optionalString(cmd.name) ?? 'Wall opening',
      hostWallId,
      alongTStart,
      alongTEnd,
      sillHeightMm,
      headHeightMm,
      discipline: 'arch',
    },
  };
}
