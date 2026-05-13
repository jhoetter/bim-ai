export interface DraftLevel {
  id: string;
  elevationMm: number;
}

export interface SceneVec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlanPointMm {
  xMm: number;
  yMm: number;
}

export function resolve3dDraftLevel(
  levels: readonly DraftLevel[],
  preferredLevelId?: string | null,
): DraftLevel | null {
  if (levels.length === 0) return null;
  if (preferredLevelId) {
    const preferred = levels.find((level) => level.id === preferredLevelId);
    if (preferred) return preferred;
  }
  return levels.reduce((best, level) => (level.elevationMm < best.elevationMm ? level : best));
}

export function projectSceneRayToLevelPlaneMm(
  rayOrigin: SceneVec3,
  rayDirection: SceneVec3,
  levelElevationMm: number,
): PlanPointMm | null {
  const denom = rayDirection.y;
  if (Math.abs(denom) < 1e-6) return null;
  const t = levelElevationMm / 1000 / denom - rayOrigin.y / denom;
  if (!Number.isFinite(t) || t <= 0) return null;
  return {
    xMm: (rayOrigin.x + rayDirection.x * t) * 1000,
    yMm: (rayOrigin.z + rayDirection.z * t) * 1000,
  };
}
