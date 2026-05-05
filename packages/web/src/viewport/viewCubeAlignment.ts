/**
 * ViewCube — spec §15.4.
 *
 * Pure-math module: maps a face / edge / corner pick on the 96 × 96 px
 * cube widget to a target {azimuth, elevation, up} for the camera rig.
 * Rendering itself (Three.js scene or CSS-3D) lives in `ViewCube.tsx`;
 * this module isolates the numerical contract so it can be unit-tested
 * without a renderer.
 */

export type ViewCubeFace = 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';

export type ViewCubeCornerSide = 'TOP' | 'BOTTOM';
export type ViewCubeCorner = `${ViewCubeCornerSide}-${'NE' | 'NW' | 'SE' | 'SW'}`;

export type ViewCubeEdge =
  | 'FRONT-TOP'
  | 'BACK-TOP'
  | 'LEFT-TOP'
  | 'RIGHT-TOP'
  | 'FRONT-BOTTOM'
  | 'BACK-BOTTOM'
  | 'LEFT-BOTTOM'
  | 'RIGHT-BOTTOM'
  | 'FRONT-LEFT'
  | 'FRONT-RIGHT'
  | 'BACK-LEFT'
  | 'BACK-RIGHT';

export type ViewCubePick =
  | { kind: 'face'; face: ViewCubeFace }
  | { kind: 'edge'; edge: ViewCubeEdge }
  | { kind: 'corner'; corner: ViewCubeCorner }
  | { kind: 'home' };

export interface ViewCubeAlignment {
  azimuth: number;
  elevation: number;
  up: { x: number; y: number; z: number };
}

const PI = Math.PI;
const ELEVATION_FACE = 0; // looking straight at a side face
const ELEVATION_TOP = PI / 2 - 0.001;
const ELEVATION_BOTTOM = -ELEVATION_TOP;
const ELEVATION_EDGE = PI / 4;
const ELEVATION_CORNER = Math.atan(1 / Math.SQRT2);

const FACE_AZIMUTH: Record<ViewCubeFace, number> = {
  FRONT: 0,
  BACK: PI,
  RIGHT: PI / 2,
  LEFT: -PI / 2,
  TOP: 0,
  BOTTOM: 0,
};

const CORNER_AZIMUTH: Record<'NE' | 'NW' | 'SE' | 'SW', number> = {
  NE: PI / 4,
  SE: (3 * PI) / 4,
  SW: -(3 * PI) / 4,
  NW: -PI / 4,
};

const EDGE_AZIMUTH_VERTICAL: Record<'FRONT' | 'BACK' | 'LEFT' | 'RIGHT', number> = {
  FRONT: 0,
  BACK: PI,
  RIGHT: PI / 2,
  LEFT: -PI / 2,
};

const FACE_DIAGONAL_AZIMUTH: Record<
  'FRONT-LEFT' | 'FRONT-RIGHT' | 'BACK-LEFT' | 'BACK-RIGHT',
  number
> = {
  'FRONT-LEFT': -PI / 4,
  'FRONT-RIGHT': PI / 4,
  'BACK-LEFT': -(3 * PI) / 4,
  'BACK-RIGHT': (3 * PI) / 4,
};

const Y_UP = { x: 0, y: 1, z: 0 };
const Z_UP = { x: 0, y: 0, z: 1 };

/** Resolve a ViewCube pick into a camera alignment. */
export function alignmentForPick(pick: ViewCubePick): ViewCubeAlignment {
  switch (pick.kind) {
    case 'face':
      return alignmentForFace(pick.face);
    case 'corner':
      return alignmentForCorner(pick.corner);
    case 'edge':
      return alignmentForEdge(pick.edge);
    case 'home':
      return { azimuth: PI / 4, elevation: 0.45, up: Y_UP };
  }
}

function alignmentForFace(face: ViewCubeFace): ViewCubeAlignment {
  if (face === 'TOP') {
    return { azimuth: 0, elevation: ELEVATION_TOP, up: Z_UP };
  }
  if (face === 'BOTTOM') {
    return { azimuth: 0, elevation: ELEVATION_BOTTOM, up: Z_UP };
  }
  return { azimuth: FACE_AZIMUTH[face], elevation: ELEVATION_FACE, up: Y_UP };
}

function alignmentForCorner(corner: ViewCubeCorner): ViewCubeAlignment {
  const [side, dir] = corner.split('-') as [ViewCubeCornerSide, 'NE' | 'NW' | 'SE' | 'SW'];
  const elevation = side === 'TOP' ? ELEVATION_CORNER : -ELEVATION_CORNER;
  return {
    azimuth: CORNER_AZIMUTH[dir],
    elevation,
    up: Y_UP,
  };
}

function alignmentForEdge(edge: ViewCubeEdge): ViewCubeAlignment {
  if (edge.endsWith('-TOP') || edge.endsWith('-BOTTOM')) {
    const [side, edgeKind] = edge.split('-') as [
      'FRONT' | 'BACK' | 'LEFT' | 'RIGHT',
      'TOP' | 'BOTTOM',
    ];
    const azimuth = EDGE_AZIMUTH_VERTICAL[side];
    const elevation = edgeKind === 'TOP' ? ELEVATION_EDGE : -ELEVATION_EDGE;
    return { azimuth, elevation, up: Y_UP };
  }
  const azimuth = FACE_DIAGONAL_AZIMUTH[edge as keyof typeof FACE_DIAGONAL_AZIMUTH];
  return { azimuth, elevation: 0, up: Y_UP };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Face-label compass — the small ring under the cube                      */
/* ────────────────────────────────────────────────────────────────────── */

/** Returns the cardinal label for a given azimuth (radians). */
export function compassLabelFromAzimuth(azimuth: number): 'N' | 'E' | 'S' | 'W' {
  // Normalize to (-π, π].
  let a = azimuth % (2 * PI);
  if (a > PI) a -= 2 * PI;
  if (a <= -PI) a += 2 * PI;
  // Bucket into quadrants centered on cardinal directions.
  if (a >= -PI / 4 && a < PI / 4) return 'N';
  if (a >= PI / 4 && a < (3 * PI) / 4) return 'E';
  if (a >= -(3 * PI) / 4 && a < -PI / 4) return 'W';
  return 'S';
}
