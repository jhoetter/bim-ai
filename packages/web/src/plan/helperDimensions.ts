/**
 * EDT-V3-06 — per-element helper dimension providers.
 *
 * Returns a list of HelperDimensionDescriptors for a selected element.
 * Each descriptor describes one editable (or read-only) measurement chip.
 */
import type { Element, HelperDimensionDescriptor, XY } from '@bim-ai/core';

type Wall = Extract<Element, { kind: 'wall' }>;
type Door = Extract<Element, { kind: 'door' }>;
type Window = Extract<Element, { kind: 'window' }>;
type Floor = Extract<Element, { kind: 'floor' }>;
type Column = Extract<Element, { kind: 'column' }>;
type Beam = Extract<Element, { kind: 'beam' }>;

function wallLengthMm(wall: Wall): number {
  return Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm);
}

/** Perpendicular unit vector (rotated 90° CCW) for a wall. */
function wallNormal(wall: Wall): XY {
  const len = wallLengthMm(wall);
  if (len < 1e-6) return { xMm: 0, yMm: 1 };
  return {
    xMm: -(wall.end.yMm - wall.start.yMm) / len,
    yMm: (wall.end.xMm - wall.start.xMm) / len,
  };
}

function offset(pt: XY, normal: XY, dist: number): XY {
  return { xMm: pt.xMm + normal.xMm * dist, yMm: pt.yMm + normal.yMm * dist };
}

function midpoint(a: XY, b: XY): XY {
  return { xMm: (a.xMm + b.xMm) / 2, yMm: (a.yMm + b.yMm) / 2 };
}

const DIM_OFFSET_MM = 300;

function wallHelperDims(wall: Wall): HelperDimensionDescriptor[] {
  const len = wallLengthMm(wall);
  const n = wallNormal(wall);
  const fromLen = offset(wall.start, n, DIM_OFFSET_MM);
  const toLen = offset(wall.end, n, DIM_OFFSET_MM);

  const mid = midpoint(wall.start, wall.end);
  const halfT = wall.thicknessMm / 2;
  const fromThick: XY = { xMm: mid.xMm - n.xMm * halfT, yMm: mid.yMm - n.yMm * halfT };
  const toThick: XY = { xMm: mid.xMm + n.xMm * halfT, yMm: mid.yMm + n.yMm * halfT };

  return [
    {
      id: 'wall-length',
      label: 'Length',
      valueMm: len,
      fromPoint: fromLen,
      toPoint: toLen,
      onCommit: (newValueMm) => ({ type: 'updateWall', id: wall.id, lengthMm: newValueMm }),
    },
    {
      id: 'wall-thickness',
      label: 'Thickness',
      valueMm: wall.thicknessMm,
      fromPoint: fromThick,
      toPoint: toThick,
      onCommit: (newValueMm) => ({ type: 'updateWall', id: wall.id, thicknessMm: newValueMm }),
    },
  ];
}

function doorHelperDims(
  door: Door,
  elementsById: Record<string, Element>,
): HelperDimensionDescriptor[] {
  const wall = elementsById[door.wallId];
  if (!wall || wall.kind !== 'wall') return [];
  const len = wallLengthMm(wall);
  const n = wallNormal(wall);
  const dx = len > 0 ? (wall.end.xMm - wall.start.xMm) / len : 1;
  const dy = len > 0 ? (wall.end.yMm - wall.start.yMm) / len : 0;
  const centerX = wall.start.xMm + dx * door.alongT * len;
  const centerY = wall.start.yMm + dy * door.alongT * len;
  const half = door.widthMm / 2;

  const from = offset({ xMm: centerX - dx * half, yMm: centerY - dy * half }, n, DIM_OFFSET_MM);
  const to = offset({ xMm: centerX + dx * half, yMm: centerY + dy * half }, n, DIM_OFFSET_MM);

  return [
    {
      id: 'door-width',
      label: 'Width',
      valueMm: door.widthMm,
      fromPoint: from,
      toPoint: to,
      onCommit: (newValueMm) => ({ type: 'updateDoor', id: door.id, widthMm: newValueMm }),
    },
  ];
}

function windowHelperDims(
  win: Window,
  elementsById: Record<string, Element>,
): HelperDimensionDescriptor[] {
  const wall = elementsById[win.wallId];
  if (!wall || wall.kind !== 'wall') return [];
  const len = wallLengthMm(wall);
  const n = wallNormal(wall);
  const dx = len > 0 ? (wall.end.xMm - wall.start.xMm) / len : 1;
  const dy = len > 0 ? (wall.end.yMm - wall.start.yMm) / len : 0;
  const centerX = wall.start.xMm + dx * win.alongT * len;
  const centerY = wall.start.yMm + dy * win.alongT * len;
  const half = win.widthMm / 2;

  const fromWidth = offset(
    { xMm: centerX - dx * half, yMm: centerY - dy * half },
    n,
    DIM_OFFSET_MM,
  );
  const toWidth = offset({ xMm: centerX + dx * half, yMm: centerY + dy * half }, n, DIM_OFFSET_MM);

  const chipAnchor = offset({ xMm: centerX, yMm: centerY }, n, DIM_OFFSET_MM * 2);
  const chipAnchor2 = offset({ xMm: centerX, yMm: centerY }, n, DIM_OFFSET_MM * 2.8);

  return [
    {
      id: 'window-width',
      label: 'Width',
      valueMm: win.widthMm,
      fromPoint: fromWidth,
      toPoint: toWidth,
      onCommit: (newValueMm) => ({ type: 'updateWindow', id: win.id, widthMm: newValueMm }),
    },
    {
      id: 'window-sill',
      label: 'Sill height',
      valueMm: win.sillHeightMm,
      fromPoint: chipAnchor,
      toPoint: chipAnchor,
      onCommit: (newValueMm) => ({ type: 'updateWindow', id: win.id, sillHeightMm: newValueMm }),
    },
    {
      id: 'window-height',
      label: 'Height',
      valueMm: win.heightMm,
      fromPoint: chipAnchor2,
      toPoint: chipAnchor2,
      onCommit: (newValueMm) => ({ type: 'updateWindow', id: win.id, heightMm: newValueMm }),
    },
  ];
}

function floorHelperDims(floor: Floor): HelperDimensionDescriptor[] {
  let areaSqMm = 0;
  const pts = floor.boundaryMm;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    areaSqMm += pts[i].xMm * pts[j].yMm - pts[j].xMm * pts[i].yMm;
  }
  const areaM2 = Math.abs(areaSqMm) / 2 / 1_000_000;

  if (pts.length === 0) return [];
  const anchor = pts[0];

  return [
    {
      id: 'floor-area',
      label: 'Area',
      valueMm: areaM2 * 1_000_000,
      fromPoint: anchor,
      toPoint: anchor,
      readOnly: true,
      onCommit: () => ({}),
    },
  ];
}

function columnHelperDims(column: Column): HelperDimensionDescriptor[] {
  const rotRad = ((column.rotationDeg ?? 0) * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);
  const halfB = column.bMm / 2;
  const halfH = column.hMm / 2;

  const fromB: XY = {
    xMm: column.positionMm.xMm - cosR * halfB,
    yMm: column.positionMm.yMm - sinR * halfB,
  };
  const toB: XY = {
    xMm: column.positionMm.xMm + cosR * halfB,
    yMm: column.positionMm.yMm + sinR * halfB,
  };

  const fromH: XY = {
    xMm: column.positionMm.xMm + sinR * halfH,
    yMm: column.positionMm.yMm - cosR * halfH,
  };
  const toH: XY = {
    xMm: column.positionMm.xMm - sinR * halfH,
    yMm: column.positionMm.yMm + cosR * halfH,
  };

  return [
    {
      id: 'column-width',
      label: 'Width (b)',
      valueMm: column.bMm,
      fromPoint: fromB,
      toPoint: toB,
      onCommit: (newValueMm) => ({ type: 'updateColumn', id: column.id, bMm: newValueMm }),
    },
    {
      id: 'column-depth',
      label: 'Depth (h)',
      valueMm: column.hMm,
      fromPoint: fromH,
      toPoint: toH,
      onCommit: (newValueMm) => ({ type: 'updateColumn', id: column.id, hMm: newValueMm }),
    },
  ];
}

function beamHelperDims(beam: Beam): HelperDimensionDescriptor[] {
  const len = Math.hypot(beam.endMm.xMm - beam.startMm.xMm, beam.endMm.yMm - beam.startMm.yMm);
  return [
    {
      id: 'beam-length',
      label: 'Length',
      valueMm: len,
      fromPoint: beam.startMm,
      toPoint: beam.endMm,
      readOnly: true,
      onCommit: () => ({}),
    },
  ];
}

export function getHelperDimensions(
  elem: Element,
  elementsById: Record<string, Element>,
): HelperDimensionDescriptor[] {
  switch (elem.kind) {
    case 'wall':
      return wallHelperDims(elem);
    case 'door':
      return doorHelperDims(elem, elementsById);
    case 'window':
      return windowHelperDims(elem, elementsById);
    case 'floor':
      return floorHelperDims(elem);
    case 'column':
      return columnHelperDims(elem);
    case 'beam':
      return beamHelperDims(elem);
    default:
      return [];
  }
}
