type HeightSample = { xMm: number; yMm: number; zMm: number };
type Point2D = { xMm: number; yMm: number };

function nearestNeighbourHeight(samples: HeightSample[], point: Point2D): number {
  let best = samples[0]!;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const s of samples) {
    const dx = s.xMm - point.xMm;
    const dy = s.yMm - point.yMm;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best.zMm;
}

function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  const n = polygon.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i]!.xMm;
    const yi = polygon[i]!.yMm;
    const xj = polygon[j]!.xMm;
    const yj = polygon[j]!.yMm;
    const intersect =
      yi > point.yMm !== yj > point.yMm &&
      point.xMm < ((xj - xi) * (point.yMm - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function terrainContourLinesMm(
  heightSamples: HeightSample[],
  boundary: Point2D[],
  contourIntervalMm: number,
): Array<Array<Point2D>> {
  if (heightSamples.length < 3) return [];
  if (contourIntervalMm <= 0) return [];
  if (boundary.length < 3) return [];

  // AABB of boundary
  let minX = boundary[0]!.xMm;
  let maxX = minX;
  let minY = boundary[0]!.yMm;
  let maxY = minY;
  for (const p of boundary) {
    if (p.xMm < minX) minX = p.xMm;
    if (p.xMm > maxX) maxX = p.xMm;
    if (p.yMm < minY) minY = p.yMm;
    if (p.yMm > maxY) maxY = p.yMm;
  }

  const step = Math.max(500, contourIntervalMm / 2);

  // Build regular sampling grid
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxY - minY) / step) + 1;

  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const x = minX + c * step;
      const y = minY + r * step;
      grid[r]![c] = nearestNeighbourHeight(heightSamples, { xMm: x, yMm: y });
    }
  }

  // Elevation range
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const s of heightSamples) {
    if (s.zMm < minZ) minZ = s.zMm;
    if (s.zMm > maxZ) maxZ = s.zMm;
  }

  const firstLevel = Math.ceil(minZ / contourIntervalMm) * contourIntervalMm;
  const polylines: Array<Array<Point2D>> = [];

  for (let z = firstLevel; z <= maxZ; z += contourIntervalMm) {
    // Marching squares: for each cell collect edge-crossing midpoints
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const x0 = minX + c * step;
        const y0 = minY + r * step;
        const x1 = x0 + step;
        const y1 = y0 + step;

        const h00 = grid[r]![c]!;
        const h10 = grid[r]![c + 1]!;
        const h01 = grid[r + 1]![c]!;
        const h11 = grid[r + 1]![c + 1]!;

        // Collect crossing points on each edge (linear interpolation)
        const pts: Point2D[] = [];

        // Bottom edge: (x0,y0) -> (x1,y0)
        if (h00 < z !== h10 < z) {
          const t = (z - h00) / (h10 - h00);
          pts.push({ xMm: x0 + t * step, yMm: y0 });
        }
        // Right edge: (x1,y0) -> (x1,y1)
        if (h10 < z !== h11 < z) {
          const t = (z - h10) / (h11 - h10);
          pts.push({ xMm: x1, yMm: y0 + t * step });
        }
        // Top edge: (x1,y1) -> (x0,y1)
        if (h11 < z !== h01 < z) {
          const t = (z - h11) / (h01 - h11);
          pts.push({ xMm: x1 - t * step, yMm: y1 });
        }
        // Left edge: (x0,y1) -> (x0,y0)
        if (h01 < z !== h00 < z) {
          const t = (z - h01) / (h00 - h01);
          pts.push({ xMm: x0, yMm: y1 - t * step });
        }

        if (pts.length >= 2) {
          const filtered = pts.filter((p) => pointInPolygon(p, boundary));
          if (filtered.length >= 2) {
            polylines.push(filtered);
          }
        }
      }
    }
  }

  return polylines;
}
