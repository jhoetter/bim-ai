import type { Element } from '@bim-ai/core';

import { getTypeById } from '../families/familyCatalog';

type DoorElem = Extract<Element, { kind: 'door' }>;
type WindowElem = Extract<Element, { kind: 'window' }>;
type FamilyTypeElem = Extract<Element, { kind: 'family_type' }>;

function readNumber(source: Record<string, unknown> | undefined, keys: string[]): number | null {
  if (!source) return null;
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === 'boolean') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function familyTypeParams(
  familyTypeId: string | null | undefined,
  elementsById: Record<string, Element>,
): Record<string, unknown> | undefined {
  if (!familyTypeId) return undefined;
  const authored = elementsById[familyTypeId] as FamilyTypeElem | undefined;
  if (authored?.kind === 'family_type') return authored.parameters;
  return getTypeById(familyTypeId)?.parameters;
}

export function resolveDoorCutDimensions(
  door: DoorElem,
  elementsById: Record<string, Element>,
  wallHeightMm: number,
): { widthMm: number; heightMm: number } {
  const params = familyTypeParams(door.familyTypeId, elementsById);
  const overrides = door.overrideParams;
  const widthMm =
    readNumber(overrides, ['leafWidthMm', 'widthMm', 'roughWidthMm', 'Width', 'Rough Width']) ??
    readNumber(params, ['leafWidthMm', 'widthMm', 'roughWidthMm', 'Width', 'Rough Width']) ??
    door.widthMm;
  const heightMm =
    readNumber(overrides, [
      'leafHeightMm',
      'heightMm',
      'roughHeightMm',
      'Height',
      'Rough Height',
    ]) ??
    readNumber(params, ['leafHeightMm', 'heightMm', 'roughHeightMm', 'Height', 'Rough Height']) ??
    wallHeightMm * 0.86;
  return { widthMm, heightMm };
}

export function resolveWindowCutDimensions(
  win: WindowElem,
  elementsById: Record<string, Element>,
): { widthMm: number; heightMm: number; sillHeightMm: number } {
  const params = familyTypeParams(win.familyTypeId, elementsById);
  const overrides = win.overrideParams;
  const widthMm =
    readNumber(overrides, ['widthMm', 'roughWidthMm', 'Width', 'Rough Width']) ??
    readNumber(params, ['widthMm', 'roughWidthMm', 'Width', 'Rough Width']) ??
    win.widthMm;
  const heightMm =
    readNumber(overrides, ['heightMm', 'roughHeightMm', 'Height', 'Rough Height']) ??
    readNumber(params, ['heightMm', 'roughHeightMm', 'Height', 'Rough Height']) ??
    win.heightMm;
  const sillHeightMm =
    readNumber(overrides, ['sillMm', 'sillHeightMm', 'Sill Height', 'SillHeight']) ??
    readNumber(params, ['sillMm', 'sillHeightMm', 'Sill Height', 'SillHeight']) ??
    win.sillHeightMm;
  return { widthMm, heightMm, sillHeightMm };
}
