import {
  alignmentForPick,
  type ViewCubeCorner,
  type ViewCubeEdge,
  type ViewCubeFace,
  type ViewCubePick,
} from '../viewCubeAlignment';

export const VIEWCUBE_ORBIT_SENSITIVITY = 0.006;
export const VIEWCUBE_SNAP_ANGLE_RAD = (10 * Math.PI) / 180;
export const VIEWCUBE_MIN_ELEVATION = -Math.PI / 2 + 0.04;
export const VIEWCUBE_MAX_ELEVATION = Math.PI / 2 - 0.04;

export interface ViewCubePose {
  azimuth: number;
  elevation: number;
}

export interface ViewCubeDragState {
  startAzimuth: number;
  startElevation: number;
  dxPx: number;
  dyPx: number;
}

export interface ViewCubeSnapTarget {
  pick: Exclude<ViewCubePick, { kind: 'home' }>;
  distanceRad: number;
}

export const VIEWCUBE_FACES: ViewCubeFace[] = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM'];

export const VIEWCUBE_EDGES: ViewCubeEdge[] = [
  'FRONT-TOP',
  'BACK-TOP',
  'LEFT-TOP',
  'RIGHT-TOP',
  'FRONT-BOTTOM',
  'BACK-BOTTOM',
  'LEFT-BOTTOM',
  'RIGHT-BOTTOM',
  'FRONT-LEFT',
  'FRONT-RIGHT',
  'BACK-LEFT',
  'BACK-RIGHT',
];

export const VIEWCUBE_CORNERS: ViewCubeCorner[] = [
  'TOP-NE',
  'TOP-NW',
  'TOP-SE',
  'TOP-SW',
  'BOTTOM-NE',
  'BOTTOM-NW',
  'BOTTOM-SE',
  'BOTTOM-SW',
];

export function allViewCubePicks(): Exclude<ViewCubePick, { kind: 'home' }>[] {
  return [
    ...VIEWCUBE_FACES.map((face) => ({ kind: 'face' as const, face })),
    ...VIEWCUBE_EDGES.map((edge) => ({ kind: 'edge' as const, edge })),
    ...VIEWCUBE_CORNERS.map((corner) => ({ kind: 'corner' as const, corner })),
  ];
}

export function poseFromDrag(state: ViewCubeDragState): ViewCubePose {
  return {
    azimuth: state.startAzimuth + state.dxPx * VIEWCUBE_ORBIT_SENSITIVITY,
    elevation: clamp(
      state.startElevation - state.dyPx * VIEWCUBE_ORBIT_SENSITIVITY,
      VIEWCUBE_MIN_ELEVATION,
      VIEWCUBE_MAX_ELEVATION,
    ),
  };
}

export function nearestViewCubeSnapTarget(
  pose: ViewCubePose,
  thresholdRad = VIEWCUBE_SNAP_ANGLE_RAD,
): ViewCubeSnapTarget | null {
  let best: ViewCubeSnapTarget | null = null;
  for (const pick of allViewCubePicks()) {
    const alignment = alignmentForPick(pick);
    const distanceRad = angularDistance(pose, {
      azimuth: alignment.azimuth,
      elevation: alignment.elevation,
    });
    if (distanceRad <= thresholdRad && (!best || distanceRad < best.distanceRad)) {
      best = { pick, distanceRad };
    }
  }
  return best;
}

export function isExactViewCubePose(pose: ViewCubePose, epsilonRad = (3 * Math.PI) / 180): boolean {
  return nearestViewCubeSnapTarget(pose, epsilonRad) !== null;
}

export function hoverTargetFromPick(
  pick: Exclude<ViewCubePick, { kind: 'home' }> | null,
):
  | { kind: 'face'; face: ViewCubeFace }
  | { kind: 'edge'; edge: ViewCubeEdge }
  | { kind: 'corner'; corner: ViewCubeCorner }
  | null {
  if (!pick) return null;
  return pick;
}

function angularDistance(a: ViewCubePose, b: ViewCubePose): number {
  const va = poseToUnitVector(a);
  const vb = poseToUnitVector(b);
  return Math.acos(clamp(va.x * vb.x + va.y * vb.y + va.z * vb.z, -1, 1));
}

function poseToUnitVector(pose: ViewCubePose): { x: number; y: number; z: number } {
  const cosElevation = Math.cos(pose.elevation);
  return {
    x: Math.sin(pose.azimuth) * cosElevation,
    y: Math.sin(pose.elevation),
    z: Math.cos(pose.azimuth) * cosElevation,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
