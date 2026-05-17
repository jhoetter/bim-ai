/**
 * §12.2.2 — DXF Contour Line Importer
 *
 * Minimal DXF parser targeting only POLYLINE/LWPOLYLINE/LINE entities.
 * Returns an array of polylines, each with elevation (Z) and a list of 2D points.
 */

import type { ToposolidElem } from '@bim-ai/core';

export type DxfPolyline = {
  elevationMm: number; // Z from the entity, scaled ×1000 if DXF is in metres
  points: { xMm: number; yMm: number }[];
};

type DxfToken = { code: number; value: string };

/** Parse a DXF text file into an array of code/value token pairs. */
function tokenizeDxf(dxfText: string): DxfToken[] {
  const lines = dxfText.split(/\r?\n/);
  const tokens: DxfToken[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i]!.trim(), 10);
    const value = lines[i + 1]!.trim();
    if (!isNaN(code)) {
      tokens.push({ code, value });
    }
  }
  return tokens;
}

/**
 * Detect whether the DXF coordinates are in metres (all coords < 1000) and
 * return the scale factor to apply (1000 if metres, 1 if already mm).
 */
function detectScaleFactor(allX: number[], allY: number[], allZ: number[]): number {
  const allCoords = [...allX.map(Math.abs), ...allY.map(Math.abs), ...allZ.map(Math.abs)].filter(
    (v) => v !== 0,
  );
  if (allCoords.length === 0) return 1;
  const maxCoord = Math.max(...allCoords);
  // If the largest coordinate is less than 1000, assume metres and scale up
  return maxCoord < 1000 ? 1000 : 1;
}

/**
 * Minimal DXF parser targeting only POLYLINE/LWPOLYLINE/LINE entities.
 * Returns an array of polylines, each with elevation (Z) and a list of 2D points.
 */
export function parseDxfContours(dxfText: string): DxfPolyline[] {
  if (!dxfText || dxfText.trim().length === 0) return [];

  const tokens = tokenizeDxf(dxfText);

  // Find ENTITIES section bounds
  let inEntities = false;
  const rawPolylines: Array<{
    type: 'lwpolyline' | 'polyline' | 'line';
    elevation: number;
    points: { x: number; y: number; z: number }[];
  }> = [];

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i]!;

    // Track section boundaries
    if (tok.code === 0 && tok.value === 'SECTION') {
      const next = tokens[i + 1];
      if (next?.code === 2 && next.value === 'ENTITIES') {
        inEntities = true;
        i += 2;
        continue;
      }
    }
    if (tok.code === 0 && tok.value === 'ENDSEC') {
      inEntities = false;
      i++;
      continue;
    }
    if (tok.code === 0 && tok.value === 'EOF') {
      break;
    }

    if (!inEntities) {
      i++;
      continue;
    }

    // LWPOLYLINE entity
    if (tok.code === 0 && tok.value === 'LWPOLYLINE') {
      i++;
      let elevation = 0;
      const pts: { x: number; y: number; z: number }[] = [];
      let curX: number | null = null;

      while (i < tokens.length) {
        const t = tokens[i]!;
        if (t.code === 0) break; // next entity
        if (t.code === 38) {
          elevation = parseFloat(t.value);
        } else if (t.code === 10) {
          // Flush previous X if Y follows later
          if (curX !== null) {
            // orphan X — shouldn't happen, but skip
          }
          curX = parseFloat(t.value);
        } else if (t.code === 20) {
          const y = parseFloat(t.value);
          if (curX !== null) {
            pts.push({ x: curX, y, z: elevation });
            curX = null;
          }
        }
        i++;
      }
      if (pts.length > 0) {
        rawPolylines.push({ type: 'lwpolyline', elevation, points: pts });
      }
      continue;
    }

    // POLYLINE entity (old-style, followed by VERTEX entities)
    if (tok.code === 0 && tok.value === 'POLYLINE') {
      i++;
      let polylineElevation = 0;
      const pts: { x: number; y: number; z: number }[] = [];

      // Read POLYLINE header attributes
      while (i < tokens.length) {
        const t = tokens[i]!;
        if (t.code === 0) break;
        if (t.code === 38 || t.code === 30) {
          polylineElevation = parseFloat(t.value);
        }
        i++;
      }

      // Now consume VERTEX entities
      while (i < tokens.length) {
        const t = tokens[i]!;
        if (t.code === 0 && t.value === 'VERTEX') {
          i++;
          let vx = 0,
            vy = 0,
            vz = polylineElevation;
          while (i < tokens.length) {
            const vt = tokens[i]!;
            if (vt.code === 0) break;
            if (vt.code === 10) vx = parseFloat(vt.value);
            else if (vt.code === 20) vy = parseFloat(vt.value);
            else if (vt.code === 30) vz = parseFloat(vt.value);
            i++;
          }
          pts.push({ x: vx, y: vy, z: vz });
          continue;
        }
        if (t.code === 0 && t.value === 'SEQEND') {
          i++;
          break;
        }
        // Some other entity — stop consuming VERTEX
        break;
      }

      if (pts.length > 0) {
        rawPolylines.push({ type: 'polyline', elevation: polylineElevation, points: pts });
      }
      continue;
    }

    // LINE entity — treat as 2-point degenerate polyline
    if (tok.code === 0 && tok.value === 'LINE') {
      i++;
      let x1 = 0,
        y1 = 0,
        z1 = 0,
        x2 = 0,
        y2 = 0,
        z2 = 0;
      while (i < tokens.length) {
        const t = tokens[i]!;
        if (t.code === 0) break;
        if (t.code === 10) x1 = parseFloat(t.value);
        else if (t.code === 20) y1 = parseFloat(t.value);
        else if (t.code === 30) z1 = parseFloat(t.value);
        else if (t.code === 11) x2 = parseFloat(t.value);
        else if (t.code === 21) y2 = parseFloat(t.value);
        else if (t.code === 31) z2 = parseFloat(t.value);
        i++;
      }
      const avgZ = (z1 + z2) / 2;
      rawPolylines.push({
        type: 'line',
        elevation: avgZ,
        points: [
          { x: x1, y: y1, z: z1 },
          { x: x2, y: y2, z: z2 },
        ],
      });
      continue;
    }

    i++;
  }

  if (rawPolylines.length === 0) return [];

  // Detect unit scale
  const allX = rawPolylines.flatMap((p) => p.points.map((pt) => pt.x));
  const allY = rawPolylines.flatMap((p) => p.points.map((pt) => pt.y));
  const allZ = rawPolylines.flatMap((p) => p.points.map((pt) => pt.z));
  const elevations = rawPolylines.map((p) => p.elevation);
  const scale = detectScaleFactor(allX, allY, [...allZ, ...elevations]);

  return rawPolylines.map((pl) => ({
    elevationMm: pl.elevation * scale,
    points: pl.points.map((pt) => ({ xMm: pt.x * scale, yMm: pt.y * scale })),
  }));
}

/**
 * Converts parsed DXF contour polylines into HeightSamples for a toposolid.
 * Each polyline vertex becomes a height sample using its elevation.
 */
export function dxfContoursToHeightSamples(
  polylines: DxfPolyline[],
): { xMm: number; yMm: number; zMm: number }[] {
  return polylines.flatMap((pl) =>
    pl.points.map((pt) => ({ xMm: pt.xMm, yMm: pt.yMm, zMm: pl.elevationMm })),
  );
}

/**
 * High-level: parse DXF text → create a toposolid element ready to insert.
 */
export function createToposolidFromDxf(dxfText: string, levelId: string | null): ToposolidElem {
  const polylines = parseDxfContours(dxfText);
  const heightSamples = dxfContoursToHeightSamples(polylines);

  // Compute bounding box of all points for the boundary
  const xs = heightSamples.map((s) => s.xMm);
  const ys = heightSamples.map((s) => s.yMm);

  let boundaryMm: { xMm: number; yMm: number }[];
  if (xs.length === 0) {
    boundaryMm = [
      { xMm: 0, yMm: 0 },
      { xMm: 0, yMm: 0 },
      { xMm: 0, yMm: 0 },
      { xMm: 0, yMm: 0 },
    ];
  } else {
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    boundaryMm = [
      { xMm: minX, yMm: minY },
      { xMm: maxX, yMm: minY },
      { xMm: maxX, yMm: maxY },
      { xMm: minX, yMm: maxY },
    ];
  }

  const elem: ToposolidElem = {
    kind: 'toposolid',
    id: crypto.randomUUID(),
    boundaryMm,
    thicknessMm: 300,
    heightSamples,
  };

  if (levelId !== null) {
    // ToposolidElem doesn't have levelId in the type — store as baseElevationMm if needed
    // The type does not expose levelId, so we skip it here
  }

  return elem;
}
