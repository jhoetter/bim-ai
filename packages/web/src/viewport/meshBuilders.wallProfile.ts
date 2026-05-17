import * as THREE from 'three';

type ProfilePoint = { xPct: number; yPct: number };

/**
 * §3.5.5 — Builds a wall mesh from a custom profile polygon.
 * profilePoints: array of { xPct, yPct } where xPct ∈ [0,1] (wall length ratio), yPct ∈ [0,1] (height ratio).
 * Wall is extruded from the profile in the perpendicular direction for wallThicknessMm.
 */
export function buildProfiledWallMesh(
  lengthMm: number,
  heightMm: number,
  thicknessMm: number,
  profilePoints: ProfilePoint[],
  color = '#d0c8b0',
): THREE.Mesh {
  if (profilePoints.length < 3) return new THREE.Mesh();

  const shape = new THREE.Shape();
  const first = profilePoints[0];
  shape.moveTo((first.xPct * lengthMm) / 1000, (first.yPct * heightMm) / 1000);
  for (let i = 1; i < profilePoints.length; i++) {
    shape.lineTo(
      (profilePoints[i].xPct * lengthMm) / 1000,
      (profilePoints[i].yPct * heightMm) / 1000,
    );
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thicknessMm / 1000,
    bevelEnabled: false,
  });
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}
