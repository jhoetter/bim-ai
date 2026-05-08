/**
 * EDT-03 — 3D grip providers (closeout).
 *
 * Per-kind grip providers for floor, roof, column, beam, door, and
 * window. Each provider is a pure function `element → descriptors`,
 * mirroring the wall provider in `grip3d.ts`. They register at module
 * load via `register3dGripProvider`.
 *
 * Slice command shape — same as the wall provider:
 *   `{ type, payload: { ... } }`
 *
 * The Viewport's grip dispatcher (see `Viewport.tsx`) translates the
 * slice payload to the appropriate engine command. We deliberately
 * stick to existing kernel commands (`updateElementProperty`,
 * `moveBeamEndpoints`) and do not invent new ones; complex edits like
 * floor-vertex moves emit `updateElementProperty key=boundaryMm` with
 * the next array as a JSON-stringifiable value.
 */

import {
  Grip3dCommitSpec,
  Grip3dDescriptor,
  Grip3dProvider,
  clampDragDelta,
  register3dGripProvider,
} from './grip3d';

type XY = { xMm: number; yMm: number };

// ---------- Floor ----------------------------------------------------------

type FloorElementShape = {
  id: string;
  kind: 'floor';
  levelId: string;
  boundaryMm: XY[];
  thicknessMm: number;
};

const FLOOR_MIN_THICKNESS_MM = 50;
const FLOOR_MAX_THICKNESS_MM = 1000;
const FLOOR_VERTEX_FREE_RANGE_MM = 5000;

function replaceVertex(boundary: XY[], index: number, next: XY): XY[] {
  return boundary.map((v, i) => (i === index ? next : v));
}

function replaceVertices(boundary: XY[], updates: Map<number, XY>): XY[] {
  return boundary.map((v, i) => updates.get(i) ?? v);
}

function levelElevationLookup(
  elementsById: Record<string, { kind?: string; elevationMm?: number }> | undefined,
  levelId: string,
): number {
  if (!elementsById) return 0;
  const lvl = elementsById[levelId];
  if (lvl && lvl.kind === 'level' && typeof lvl.elevationMm === 'number') {
    return lvl.elevationMm;
  }
  return 0;
}

export function floorGripProvider3d(
  floor: FloorElementShape,
  ctx?: { elementsById?: Record<string, { kind?: string; elevationMm?: number }> },
): Grip3dDescriptor[] {
  const elev = levelElevationLookup(ctx?.elementsById, floor.levelId);
  const grips: Grip3dDescriptor[] = [];

  // (1) One vertex grip per boundary point — xy drag.
  floor.boundaryMm.forEach((vertex, i) => {
    const range = { minMm: -FLOOR_VERTEX_FREE_RANGE_MM, maxMm: FLOOR_VERTEX_FREE_RANGE_MM };
    grips.push({
      id: `${floor.id}/vertex/${i}`,
      role: 'boundaryMm',
      position: { xMm: vertex.xMm, yMm: vertex.yMm, zMm: elev },
      axis: 'xy',
      rangeMm: range,
      onDrag: (delta) => ({
        elementId: floor.id,
        property: 'boundaryMm',
        valueMm: clampDragDelta(delta, range),
      }),
      onCommit: (delta): Grip3dCommitSpec | null => {
        const clamped = clampDragDelta(delta, range);
        if (clamped === 0) return null;
        const next: XY = { xMm: vertex.xMm + clamped, yMm: vertex.yMm + clamped };
        return {
          type: 'updateElementProperty',
          payload: {
            elementId: floor.id,
            property: 'boundaryMm',
            vertexIndex: i,
            value: replaceVertex(floor.boundaryMm, i, next),
          },
        };
      },
    });
  });

  // (2) One corner-extrusion grip per boundary corner — xy drag both
  // adjacent vertices together (handy for rectangular floor expansion).
  floor.boundaryMm.forEach((vertex, i) => {
    const prev = (i - 1 + floor.boundaryMm.length) % floor.boundaryMm.length;
    const range = { minMm: -FLOOR_VERTEX_FREE_RANGE_MM, maxMm: FLOOR_VERTEX_FREE_RANGE_MM };
    grips.push({
      id: `${floor.id}/corner/${i}`,
      role: 'boundaryCorner',
      position: { xMm: vertex.xMm, yMm: vertex.yMm, zMm: elev },
      axis: 'xy',
      rangeMm: range,
      onDrag: (delta) => ({
        elementId: floor.id,
        property: 'boundaryMm',
        valueMm: clampDragDelta(delta, range),
      }),
      onCommit: (delta): Grip3dCommitSpec | null => {
        const clamped = clampDragDelta(delta, range);
        if (clamped === 0) return null;
        const updates = new Map<number, XY>();
        updates.set(i, { xMm: vertex.xMm + clamped, yMm: vertex.yMm + clamped });
        const prevVertex = floor.boundaryMm[prev];
        updates.set(prev, {
          xMm: prevVertex.xMm + clamped,
          yMm: prevVertex.yMm + clamped,
        });
        return {
          type: 'updateElementProperty',
          payload: {
            elementId: floor.id,
            property: 'boundaryMm',
            value: replaceVertices(floor.boundaryMm, updates),
          },
        };
      },
    });
  });

  // (3) Thickness handle — z drag on a representative cut edge.
  const cut = floor.boundaryMm[0] ?? { xMm: 0, yMm: 0 };
  const thickRange = {
    minMm: FLOOR_MIN_THICKNESS_MM - floor.thicknessMm,
    maxMm: FLOOR_MAX_THICKNESS_MM - floor.thicknessMm,
  };
  grips.push({
    id: `${floor.id}/thickness`,
    role: 'thicknessMm',
    position: { xMm: cut.xMm, yMm: cut.yMm, zMm: elev - floor.thicknessMm },
    axis: 'z',
    rangeMm: thickRange,
    onDrag: (delta) => ({
      elementId: floor.id,
      property: 'thicknessMm',
      valueMm: floor.thicknessMm + clampDragDelta(delta, thickRange),
    }),
    onCommit: (delta) => {
      const clamped = clampDragDelta(delta, thickRange);
      if (clamped === 0) return null;
      return {
        type: 'updateElementProperty',
        payload: {
          elementId: floor.id,
          property: 'thicknessMm',
          valueMm: floor.thicknessMm + clamped,
        },
      };
    },
  });

  return grips;
}

// ---------- Roof -----------------------------------------------------------

type RoofElementShape = {
  id: string;
  kind: 'roof';
  referenceLevelId: string;
  footprintMm: XY[];
  overhangMm?: number;
  eaveHeightLeftMm?: number;
  eaveHeightRightMm?: number;
  slopeDeg?: number | null;
};

const ROOF_HEIGHT_DRAG_RANGE_MM = 5000;

export function roofGripProvider3d(
  roof: RoofElementShape,
  ctx?: { elementsById?: Record<string, { kind?: string; elevationMm?: number }> },
): Grip3dDescriptor[] {
  const elev = levelElevationLookup(ctx?.elementsById, roof.referenceLevelId);
  const cx = roof.footprintMm.reduce((s, p) => s + p.xMm, 0) / Math.max(1, roof.footprintMm.length);
  const cy = roof.footprintMm.reduce((s, p) => s + p.yMm, 0) / Math.max(1, roof.footprintMm.length);
  const eave = roof.eaveHeightLeftMm ?? 0;
  // Approximate a ridge elevation for grip placement: use slope * span/2
  // as a soft hint; this is purely visual since the commit only feeds
  // the slope property.
  const span = Math.max(
    1,
    Math.max(...roof.footprintMm.map((p) => p.xMm)) -
      Math.min(...roof.footprintMm.map((p) => p.xMm)),
  );
  const slopeDeg = roof.slopeDeg ?? 30;
  const ridgeRise = (span / 2) * Math.tan((slopeDeg * Math.PI) / 180);

  const ridgeRange = { minMm: -ROOF_HEIGHT_DRAG_RANGE_MM, maxMm: ROOF_HEIGHT_DRAG_RANGE_MM };
  const eaveRange = { minMm: -ROOF_HEIGHT_DRAG_RANGE_MM, maxMm: ROOF_HEIGHT_DRAG_RANGE_MM };
  const overhangRange = { minMm: -1500, maxMm: 1500 };

  return [
    {
      id: `${roof.id}/ridge`,
      role: 'ridgeHeight',
      position: { xMm: cx, yMm: cy, zMm: elev + eave + ridgeRise },
      axis: 'z',
      rangeMm: ridgeRange,
      onDrag: (delta) => ({
        elementId: roof.id,
        property: 'slopeDeg',
        valueMm: clampDragDelta(delta, ridgeRange),
      }),
      onCommit: (delta) => {
        const clamped = clampDragDelta(delta, ridgeRange);
        if (clamped === 0) return null;
        // Convert the dragged Z-rise into a slope delta via tan⁻¹.
        const newRise = ridgeRise + clamped;
        const newSlopeDeg = (Math.atan2(newRise, span / 2) * 180) / Math.PI;
        return {
          type: 'updateElementProperty',
          payload: {
            elementId: roof.id,
            property: 'slopeDeg',
            valueMm: newSlopeDeg,
          },
        };
      },
    },
    {
      id: `${roof.id}/eave`,
      role: 'eaveHeight',
      position: { xMm: cx, yMm: cy, zMm: elev + eave },
      axis: 'z',
      rangeMm: eaveRange,
      onDrag: (delta) => ({
        elementId: roof.id,
        property: 'eaveHeightLeftMm',
        valueMm: eave + clampDragDelta(delta, eaveRange),
      }),
      onCommit: (delta) => {
        const clamped = clampDragDelta(delta, eaveRange);
        if (clamped === 0) return null;
        return {
          type: 'updateElementProperty',
          payload: {
            elementId: roof.id,
            property: 'eaveHeightLeftMm',
            valueMm: eave + clamped,
          },
        };
      },
    },
    {
      id: `${roof.id}/gable-end`,
      role: 'gableOverhang',
      position: {
        xMm: cx,
        yMm: roof.footprintMm[0]?.yMm ?? cy,
        zMm: elev + eave + ridgeRise,
      },
      axis: 'xy',
      rangeMm: overhangRange,
      onDrag: (delta) => ({
        elementId: roof.id,
        property: 'overhangMm',
        valueMm: (roof.overhangMm ?? 0) + clampDragDelta(delta, overhangRange),
      }),
      onCommit: (delta) => {
        const clamped = clampDragDelta(delta, overhangRange);
        if (clamped === 0) return null;
        return {
          type: 'updateElementProperty',
          payload: {
            elementId: roof.id,
            property: 'overhangMm',
            valueMm: (roof.overhangMm ?? 0) + clamped,
          },
        };
      },
    },
  ];
}

// ---------- Column --------------------------------------------------------

type ColumnElementShape = {
  id: string;
  kind: 'column';
  levelId: string;
  positionMm: XY;
  heightMm: number;
  baseConstraintOffsetMm?: number;
  topConstraintOffsetMm?: number;
};

const COLUMN_OFFSET_RANGE_MM = 5000;

export function columnGripProvider3d(
  column: ColumnElementShape,
  ctx?: { elementsById?: Record<string, { kind?: string; elevationMm?: number }> },
): Grip3dDescriptor[] {
  const elev = levelElevationLookup(ctx?.elementsById, column.levelId);
  const baseOff = column.baseConstraintOffsetMm ?? 0;
  const topOff = column.topConstraintOffsetMm ?? 0;
  const baseZ = elev + baseOff;
  const topZ = elev + column.heightMm + topOff;
  const range = { minMm: -COLUMN_OFFSET_RANGE_MM, maxMm: COLUMN_OFFSET_RANGE_MM };
  return [
    {
      id: `${column.id}/top`,
      role: 'topConstraintOffsetMm',
      position: { xMm: column.positionMm.xMm, yMm: column.positionMm.yMm, zMm: topZ },
      axis: 'z',
      rangeMm: range,
      onDrag: (delta) => ({
        elementId: column.id,
        property: 'topConstraintOffsetMm',
        valueMm: topOff + clampDragDelta(delta, range),
      }),
      onCommit: (delta) => {
        const clamped = clampDragDelta(delta, range);
        if (clamped === 0) return null;
        return {
          type: 'updateElementProperty',
          payload: {
            elementId: column.id,
            property: 'topConstraintOffsetMm',
            valueMm: topOff + clamped,
          },
        };
      },
    },
    {
      id: `${column.id}/base`,
      role: 'baseConstraintOffsetMm',
      position: { xMm: column.positionMm.xMm, yMm: column.positionMm.yMm, zMm: baseZ },
      axis: 'z',
      rangeMm: range,
      onDrag: (delta) => ({
        elementId: column.id,
        property: 'baseConstraintOffsetMm',
        valueMm: baseOff + clampDragDelta(delta, range),
      }),
      onCommit: (delta) => {
        const clamped = clampDragDelta(delta, range);
        if (clamped === 0) return null;
        return {
          type: 'updateElementProperty',
          payload: {
            elementId: column.id,
            property: 'baseConstraintOffsetMm',
            valueMm: baseOff + clamped,
          },
        };
      },
    },
  ];
}

// ---------- Beam ----------------------------------------------------------

type BeamElementShape = {
  id: string;
  kind: 'beam';
  levelId: string;
  startMm: XY;
  endMm: XY;
};

const BEAM_FREE_RANGE_MM = 10_000;

export function beamGripProvider3d(
  beam: BeamElementShape,
  ctx?: { elementsById?: Record<string, { kind?: string; elevationMm?: number }> },
): Grip3dDescriptor[] {
  const elev = levelElevationLookup(ctx?.elementsById, beam.levelId);
  const range = { minMm: -BEAM_FREE_RANGE_MM, maxMm: BEAM_FREE_RANGE_MM };

  function makeEndpoint(name: 'start' | 'end', point: XY): Grip3dDescriptor {
    return {
      id: `${beam.id}/${name}`,
      role: name === 'start' ? 'startMm' : 'endMm',
      position: { xMm: point.xMm, yMm: point.yMm, zMm: elev },
      axis: 'xyz',
      rangeMm: range,
      onDrag: (delta) => ({
        elementId: beam.id,
        property: name === 'start' ? 'startMm' : 'endMm',
        valueMm: clampDragDelta(delta, range),
      }),
      onCommit: (delta) => {
        const clamped = clampDragDelta(delta, range);
        if (clamped === 0) return null;
        const next: XY = { xMm: point.xMm + clamped, yMm: point.yMm + clamped };
        return {
          type: 'moveBeamEndpoints',
          payload: {
            beamId: beam.id,
            startMm: name === 'start' ? next : beam.startMm,
            endMm: name === 'end' ? next : beam.endMm,
          },
        };
      },
    };
  }

  return [makeEndpoint('start', beam.startMm), makeEndpoint('end', beam.endMm)];
}

// ---------- Door ----------------------------------------------------------

type DoorElementShape = {
  id: string;
  kind: 'door';
  wallId: string;
  alongT: number;
  widthMm: number;
};

const DOOR_WIDTH_RANGE_MM = 2000;
const DOOR_HEIGHT_RANGE_MM = 2000;
const DOOR_DEFAULT_HEIGHT_MM = 2100;

export function doorGripProvider3d(door: DoorElementShape): Grip3dDescriptor[] {
  const widthRange = { minMm: 200 - door.widthMm, maxMm: DOOR_WIDTH_RANGE_MM };
  const heightRange = { minMm: 200 - DOOR_DEFAULT_HEIGHT_MM, maxMm: DOOR_HEIGHT_RANGE_MM };
  return [
    {
      id: `${door.id}/width`,
      role: 'widthMm',
      // Door grips have no inherent world position; the renderer projects
      // them onto the host wall in elevation view.
      position: { xMm: 0, yMm: 0, zMm: 0 },
      axis: 'x',
      rangeMm: widthRange,
      visibleIn: 'elevation',
      onDrag: (delta) => ({
        elementId: door.id,
        property: 'widthMm',
        valueMm: door.widthMm + clampDragDelta(delta, widthRange),
      }),
      onCommit: (delta) => {
        const clamped = clampDragDelta(delta, widthRange);
        if (clamped === 0) return null;
        return {
          type: 'updateElementProperty',
          payload: {
            elementId: door.id,
            property: 'widthMm',
            valueMm: door.widthMm + clamped,
          },
        };
      },
    },
    {
      id: `${door.id}/height`,
      role: 'heightMm',
      position: { xMm: 0, yMm: 0, zMm: DOOR_DEFAULT_HEIGHT_MM },
      axis: 'z',
      rangeMm: heightRange,
      visibleIn: 'elevation',
      onDrag: (delta) => ({
        elementId: door.id,
        property: 'heightMm',
        valueMm: DOOR_DEFAULT_HEIGHT_MM + clampDragDelta(delta, heightRange),
      }),
      onCommit: (delta) => {
        const clamped = clampDragDelta(delta, heightRange);
        if (clamped === 0) return null;
        return {
          type: 'updateElementProperty',
          payload: {
            elementId: door.id,
            property: 'heightMm',
            valueMm: DOOR_DEFAULT_HEIGHT_MM + clamped,
          },
        };
      },
    },
  ];
}

// ---------- Window --------------------------------------------------------

type WindowElementShape = {
  id: string;
  kind: 'window';
  wallId: string;
  alongT: number;
  widthMm: number;
  heightMm: number;
  sillHeightMm: number;
};

const WINDOW_WIDTH_RANGE_MM = 3000;
const WINDOW_HEIGHT_RANGE_MM = 3000;
const WINDOW_SILL_RANGE_MM = 2500;

export function windowGripProvider3d(win: WindowElementShape): Grip3dDescriptor[] {
  const widthRange = { minMm: 200 - win.widthMm, maxMm: WINDOW_WIDTH_RANGE_MM };
  const heightRange = { minMm: 200 - win.heightMm, maxMm: WINDOW_HEIGHT_RANGE_MM };
  const sillRange = { minMm: -win.sillHeightMm, maxMm: WINDOW_SILL_RANGE_MM };
  return [
    {
      id: `${win.id}/width`,
      role: 'widthMm',
      position: { xMm: 0, yMm: 0, zMm: win.sillHeightMm + win.heightMm / 2 },
      axis: 'x',
      rangeMm: widthRange,
      visibleIn: 'elevation',
      onDrag: (delta) => ({
        elementId: win.id,
        property: 'widthMm',
        valueMm: win.widthMm + clampDragDelta(delta, widthRange),
      }),
      onCommit: (delta) => {
        const clamped = clampDragDelta(delta, widthRange);
        if (clamped === 0) return null;
        return {
          type: 'updateElementProperty',
          payload: {
            elementId: win.id,
            property: 'widthMm',
            valueMm: win.widthMm + clamped,
          },
        };
      },
    },
    {
      id: `${win.id}/height`,
      role: 'heightMm',
      position: { xMm: 0, yMm: 0, zMm: win.sillHeightMm + win.heightMm },
      axis: 'z',
      rangeMm: heightRange,
      visibleIn: 'elevation',
      onDrag: (delta) => ({
        elementId: win.id,
        property: 'heightMm',
        valueMm: win.heightMm + clampDragDelta(delta, heightRange),
      }),
      onCommit: (delta) => {
        const clamped = clampDragDelta(delta, heightRange);
        if (clamped === 0) return null;
        return {
          type: 'updateElementProperty',
          payload: {
            elementId: win.id,
            property: 'heightMm',
            valueMm: win.heightMm + clamped,
          },
        };
      },
    },
    {
      id: `${win.id}/sill`,
      role: 'sillHeightMm',
      position: { xMm: 0, yMm: 0, zMm: win.sillHeightMm },
      axis: 'z',
      rangeMm: sillRange,
      visibleIn: 'elevation',
      onDrag: (delta) => ({
        elementId: win.id,
        property: 'sillHeightMm',
        valueMm: win.sillHeightMm + clampDragDelta(delta, sillRange),
      }),
      onCommit: (delta) => {
        const clamped = clampDragDelta(delta, sillRange);
        if (clamped === 0) return null;
        return {
          type: 'updateElementProperty',
          payload: {
            elementId: win.id,
            property: 'sillHeightMm',
            valueMm: win.sillHeightMm + clamped,
          },
        };
      },
    },
  ];
}

// ---------- Registration -------------------------------------------------

register3dGripProvider('floor', floorGripProvider3d as Grip3dProvider);
register3dGripProvider('roof', roofGripProvider3d as Grip3dProvider);
register3dGripProvider('column', columnGripProvider3d as Grip3dProvider);
register3dGripProvider('beam', beamGripProvider3d as Grip3dProvider);
register3dGripProvider('door', doorGripProvider3d as Grip3dProvider);
register3dGripProvider('window', windowGripProvider3d as Grip3dProvider);
