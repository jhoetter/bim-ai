import * as THREE from 'three';
import type { FamilySweptBlend } from '@bim-ai/core';

/**
 * Builds a swept-blend mesh by interpolating between startProfile and endProfile
 * at each path segment, creating N-1 lofted quad strips connecting consecutive profile slices.
 * §15.1.2
 */
export function buildFamilySweptBlendMesh(form: FamilySweptBlend): THREE.Mesh | null {
  const { startProfileMm, endProfileMm, pathMm } = form;
  if (!pathMm || pathMm.length < 2) return null;
  if (!startProfileMm || startProfileMm.length < 3) return null;
  if (!endProfileMm || endProfileMm.length < 3) return null;

  const N = pathMm.length;
  const positions: number[] = [];
  const indices: number[] = [];

  // Build one "slice" of profile per path point by lerping between start and end profiles
  // Use the vertex count of startProfile (simplify: match counts)
  const vCount = Math.min(startProfileMm.length, endProfileMm.length);
  const SCALE = 0.001; // mm → m

  for (let pathIdx = 0; pathIdx < N; pathIdx++) {
    const t = pathIdx / (N - 1);
    const pathPt = pathMm[pathIdx]!;

    for (let vi = 0; vi < vCount; vi++) {
      const sp = startProfileMm[vi % startProfileMm.length]!;
      const ep = endProfileMm[vi % endProfileMm.length]!;
      const lx = sp.xMm + (ep.xMm - sp.xMm) * t;
      const ly = sp.yMm + (ep.yMm - sp.yMm) * t;
      positions.push(
        (pathPt.xMm + lx) * SCALE,
        (pathPt.yMm + ly) * SCALE,
        (pathPt.zMm ?? 0) * SCALE,
      );
    }
  }

  // Quad strips between consecutive slices
  for (let si = 0; si < N - 1; si++) {
    for (let vi = 0; vi < vCount; vi++) {
      const a = si * vCount + vi;
      const b = si * vCount + ((vi + 1) % vCount);
      const c = (si + 1) * vCount + ((vi + 1) % vCount);
      const d = (si + 1) * vCount + vi;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color: '#b0c4de', side: THREE.DoubleSide });
  return new THREE.Mesh(geo, mat);
}
