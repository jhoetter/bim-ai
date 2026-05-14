/**
 * Shared XZ-plane orientation helpers.
 *
 * Three.js Y-rotation is right-handed: a positive rotation maps local +X
 * toward world -Z. BIM plan coordinates map semantic +Y directly to world +Z,
 * so a plan segment from (x,z) delta (dx,dz) needs the negated atan2 angle.
 */
export function yawForPlanSegment(dx: number, dz: number): number {
  return Math.atan2(-dz, dx);
}

export function localPlanOffsetToWorld(
  yaw: number,
  alongM: number,
  perpendicularM: number,
): { xM: number; zM: number } {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  return {
    xM: cosY * alongM + sinY * perpendicularM,
    zM: -sinY * alongM + cosY * perpendicularM,
  };
}
