import { describe, expect, it } from 'vitest';
import {
  allViewCubePicks,
  nearestViewCubeSnapTarget,
  poseFromDrag,
  VIEWCUBE_ORBIT_SENSITIVITY,
} from './orientation';

describe('ViewCube orientation contract', () => {
  it('defines the 26 face/edge/corner views', () => {
    const picks = allViewCubePicks();
    expect(picks).toHaveLength(26);
    expect(picks.filter((pick) => pick.kind === 'face')).toHaveLength(6);
    expect(picks.filter((pick) => pick.kind === 'edge')).toHaveLength(12);
    expect(picks.filter((pick) => pick.kind === 'corner')).toHaveLength(8);
  });

  it('uses the same drag sign and sensitivity as CameraRig.orbit', () => {
    const pose = poseFromDrag({
      startAzimuth: 0.45,
      startElevation: 0.32,
      dxPx: 25,
      dyPx: -10,
    });

    expect(pose.azimuth).toBeCloseTo(0.45 + 25 * VIEWCUBE_ORBIT_SENSITIVITY, 6);
    expect(pose.elevation).toBeCloseTo(0.32 + 10 * VIEWCUBE_ORBIT_SENSITIVITY, 6);
  });

  it('snaps near a fixed face view within the 10 degree snap window', () => {
    const target = nearestViewCubeSnapTarget({ azimuth: 0.04, elevation: 0.03 });
    expect(target?.pick).toEqual({ kind: 'face', face: 'FRONT' });
  });

  it('does not snap far away from fixed views', () => {
    expect(nearestViewCubeSnapTarget({ azimuth: 0.31, elevation: 0.23 })).toBeNull();
  });
});
