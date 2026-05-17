/**
 * §8.6.3 — multi-run stair shape detector.
 *
 * Given a sequence of 2 or 3 points placed by the user (in plan mm),
 * detects whether the segments form a straight run, an L-shape (~90°
 * turn between two segments) or a U-shape (~180° turn / parallel
 * return). Returns the `shape` string and the `runs[]` array to
 * attach to the created stair element.
 *
 * All co-ordinate maths is in plan mm; elevation is not considered here.
 */

export type XY = { xMm: number; yMm: number };

export type DetectedStairShape = 'straight' | 'l_shape' | 'u_shape';

export interface StairRunDescriptor {
  id: string;
  startMm: XY;
  endMm: XY;
  widthMm: number;
  riserCount: number;
}

export interface MultiRunDetectionResult {
  shape: DetectedStairShape;
  runs: StairRunDescriptor[];
  /** Landing boundary polygon at the corner (empty for straight stairs). */
  landingBoundaryMm: XY[];
}

function dot(a: XY, b: XY): number {
  return a.xMm * b.xMm + a.yMm * b.yMm;
}

function normalise(v: XY): XY {
  const len = Math.hypot(v.xMm, v.yMm);
  if (len < 1e-9) return { xMm: 0, yMm: 0 };
  return { xMm: v.xMm / len, yMm: v.yMm / len };
}

function sub(a: XY, b: XY): XY {
  return { xMm: a.xMm - b.xMm, yMm: a.yMm - b.yMm };
}

/**
 * Returns the angle (degrees) between two directed segment vectors.
 * 0° = same direction; 90° = perpendicular; 180° = reversed (U-turn).
 */
function angleBetweenDeg(dirA: XY, dirB: XY): number {
  const cosTheta = Math.max(-1, Math.min(1, dot(normalise(dirA), normalise(dirB))));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

/** Axis-aligned square landing polygon centred at `cornerMm`. */
function squareLandingMm(cornerMm: XY, depthMm: number): XY[] {
  const half = depthMm / 2;
  return [
    { xMm: cornerMm.xMm - half, yMm: cornerMm.yMm - half },
    { xMm: cornerMm.xMm + half, yMm: cornerMm.yMm - half },
    { xMm: cornerMm.xMm + half, yMm: cornerMm.yMm + half },
    { xMm: cornerMm.xMm - half, yMm: cornerMm.yMm + half },
  ];
}

const L_SHAPE_TOLERANCE_DEG = 20; // ±20° around 90°
const U_SHAPE_TOLERANCE_DEG = 20; // ±20° around 180°
const DEFAULT_LANDING_DEPTH_MM = 1200;

// ---------------------------------------------------------------------------
// Public API used by stairBySketch and tests (§8.6.3)
// ---------------------------------------------------------------------------

/**
 * Classify the stair shape from 3 user-placed points.
 * Uses the angle at the middle point (corner).
 * v1 = start-corner, v2 = end-corner (vectors pointing away from corner).
 */
export function classifyStairShape(
  start: XY,
  corner: XY,
  end: XY,
): 'straight' | 'l_shape' | 'u_shape' {
  const v1 = sub(start, corner); // vector from corner toward start
  const v2 = sub(end, corner); // vector from corner toward end
  const angleDeg = angleBetweenDeg(v1, v2);
  // When v1 and v2 point in nearly the same direction (small angle) → straight
  // When ~90° → l_shape
  // When ~180° → u_shape (parallel return)
  if (angleDeg > 160) return 'u_shape';
  if (angleDeg < 45) return 'straight';
  return 'l_shape';
}

export interface MultiRunStairConfig {
  shape: 'straight' | 'l_shape' | 'u_shape';
  runs: StairRunDescriptor[];
  /** Corner landing points (one per turn). Undefined for straight stairs. */
  landingMm?: XY[];
}

/**
 * Build a complete stair configuration from start, corner, and end points.
 */
export function buildMultiRunStairConfig(
  start: XY,
  corner: XY,
  end: XY,
  totalRiserCount: number,
): MultiRunStairConfig {
  const shape = classifyStairShape(start, corner, end);
  const half = Math.max(1, Math.floor(totalRiserCount / 2));
  const runWidthMm = 1200;

  if (shape === 'straight') {
    return {
      shape,
      runs: [
        {
          id: 'run-0',
          startMm: start,
          endMm: end,
          widthMm: runWidthMm,
          riserCount: totalRiserCount,
        },
      ],
    };
  }

  return {
    shape,
    runs: [
      { id: 'run-0', startMm: start, endMm: corner, widthMm: runWidthMm, riserCount: half },
      {
        id: 'run-1',
        startMm: corner,
        endMm: end,
        widthMm: runWidthMm,
        riserCount: totalRiserCount - half,
      },
    ],
    landingMm: [corner],
  };
}

/**
 * Detect the stair shape from a list of 2 or 3 user-placed points.
 *
 * - 2 points → always straight.
 * - 3 points → check angle at the middle point:
 *   - ~90°  → l_shape
 *   - ~180° → u_shape (parallel return)
 *   - other → straight (treat as single-run)
 *
 * `riserCount` is split evenly across runs for multi-run stairs.
 */
export function detectStairShape(
  points: XY[],
  opts: {
    riserCount: number;
    runWidthMm: number;
    landingDepthMm?: number;
  },
): MultiRunDetectionResult {
  const { riserCount, runWidthMm, landingDepthMm = DEFAULT_LANDING_DEPTH_MM } = opts;

  if (points.length < 2) {
    return { shape: 'straight', runs: [], landingBoundaryMm: [] };
  }

  if (points.length === 2) {
    const run: StairRunDescriptor = {
      id: 'run-0',
      startMm: points[0]!,
      endMm: points[1]!,
      widthMm: runWidthMm,
      riserCount,
    };
    return { shape: 'straight', runs: [run], landingBoundaryMm: [] };
  }

  // 3-point case — check the angle at points[1].
  const p0 = points[0]!;
  const p1 = points[1]!;
  const p2 = points[2]!;

  const dirAB = sub(p1, p0);
  const dirBC = sub(p2, p1);

  const angleDeg = angleBetweenDeg(dirAB, dirBC);

  const isLShape = Math.abs(angleDeg - 90) <= L_SHAPE_TOLERANCE_DEG;
  const isUShape = Math.abs(angleDeg - 180) <= U_SHAPE_TOLERANCE_DEG || angleDeg > 160;

  if (isUShape) {
    const halfCount = Math.max(1, Math.floor(riserCount / 2));
    const runs: StairRunDescriptor[] = [
      { id: 'run-0', startMm: p0, endMm: p1, widthMm: runWidthMm, riserCount: halfCount },
      {
        id: 'run-1',
        startMm: p1,
        endMm: p2,
        widthMm: runWidthMm,
        riserCount: riserCount - halfCount,
      },
    ];
    return {
      shape: 'u_shape',
      runs,
      landingBoundaryMm: squareLandingMm(p1, landingDepthMm),
    };
  }

  if (isLShape) {
    const halfCount = Math.max(1, Math.floor(riserCount / 2));
    const runs: StairRunDescriptor[] = [
      { id: 'run-0', startMm: p0, endMm: p1, widthMm: runWidthMm, riserCount: halfCount },
      {
        id: 'run-1',
        startMm: p1,
        endMm: p2,
        widthMm: runWidthMm,
        riserCount: riserCount - halfCount,
      },
    ];
    return {
      shape: 'l_shape',
      runs,
      landingBoundaryMm: squareLandingMm(p1, landingDepthMm),
    };
  }

  // Angle is neither ~90° nor ~180° — treat as straight single-run.
  const run: StairRunDescriptor = {
    id: 'run-0',
    startMm: p0,
    endMm: p2,
    widthMm: runWidthMm,
    riserCount,
  };
  return { shape: 'straight', runs: [run], landingBoundaryMm: [] };
}
