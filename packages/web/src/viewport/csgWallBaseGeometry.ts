import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type CsgBaseFootprintPoint = { xM: number; zM: number };

/**
 * Issue #109 — gable-shaped wall profile for CSG.
 *
 * Per-sample heights (metres, relative to the wall base) along the wall's
 * length, including the upper triangular ("gable") portion above the
 * rectangular wall top. ``len(topProfileM) >= 2``; samples are evenly
 * distributed from `xM = -len/2` (start) to `xM = +len/2` (end).
 *
 * When supplied — and when the profile actually rises above the
 * rectangular wall ``height`` at any sample — the geometry is built as
 * a sloped-top prism that fills the gable triangle so window/door CSG
 * cutters can host openings (Giebelverglasung) in the gable zone.
 */
export type CsgTopProfile = number[];

export function wallBaseGeometryForCsg(
  len: number,
  height: number,
  thick: number,
  baseFootprints?: CsgBaseFootprintPoint[][],
  topProfileM?: CsgTopProfile,
): THREE.BufferGeometry {
  const cleanFootprints = baseFootprints
    ?.map((footprint) => footprint.filter((point) => Number.isFinite(point.xM + point.zM)))
    .filter((footprint) => footprint.length >= 3);

  // Issue #109 — sloped-top prism for gable-shaped walls. Only kicks in
  // when at least one sample rises above the rectangular wall top by a
  // visible margin (1 mm); otherwise we fall through to the existing
  // box / extruded-footprint paths so the box-CSG fast path stays intact
  // for plain rectangular walls.
  const hasGableTriangle =
    Array.isArray(topProfileM) &&
    topProfileM.length >= 2 &&
    topProfileM.some((h) => Number.isFinite(h) && h > height + 0.001);

  if (hasGableTriangle) {
    return buildGableProfilePrismGeometry(len, height, thick, topProfileM!);
  }

  if (!cleanFootprints || cleanFootprints.length === 0) {
    return new THREE.BoxGeometry(len, height, thick);
  }

  const geometries = cleanFootprints.map((footprint) => {
    const first = footprint[0]!;
    const shape = new THREE.Shape();
    shape.moveTo(first.xM, -first.zM);
    for (let i = 1; i < footprint.length; i += 1) {
      const point = footprint[i]!;
      shape.lineTo(point.xM, -point.zM);
    }
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    geom.translate(0, -height / 2, 0);
    return geom;
  });

  const merged = mergeGeometries(geometries, false);
  for (const geom of geometries) geom.dispose();
  return merged ?? new THREE.BoxGeometry(len, height, thick);
}

/**
 * Issue #109 — build a sloped-top prism geometry whose top edge follows
 * ``topProfileM`` (per-sample absolute height in metres relative to the
 * wall base) and whose cross-section is a simple thick rectangle of
 * width ``thick``. Wall-local frame:
 *
 *   - x: along the wall, from ``-len/2`` to ``+len/2``
 *   - y: 0 at the wall base, but the geometry is centred on
 *     ``y = -height/2`` so that for a flat-top wall this exactly matches
 *     ``new THREE.BoxGeometry(len, height, thick)``. The gable peak
 *     samples raise the top edge above ``y = +height/2``.
 *   - z: across the wall thickness, from ``-thick/2`` to ``+thick/2``
 *
 * The CSG worker positions the resulting mesh at the wall midpoint at
 * world y = ``yBase + height/2`` (its existing convention). Keeping the
 * box-aligned cross-section means door / window cutters whose
 * ``localY = sill + cutH/2 - wallHeight/2`` continue to land correctly
 * relative to the wall base regardless of whether the gable triangle is
 * present — the CSG subtraction simply has more wall mass to remove
 * when an opening sits in the gable zone.
 */
function buildGableProfilePrismGeometry(
  len: number,
  height: number,
  thick: number,
  topProfileM: CsgTopProfile,
): THREE.BufferGeometry {
  const N = topProfileM.length - 1;
  const halfL = len / 2;
  const halfT = thick / 2;
  // Local origin is the rectangular wall centre (matches BoxGeometry frame).
  const baseY = -height / 2;

  const positions: number[] = [];
  // 4 verts per column: front-base, back-base, front-top, back-top.
  for (let i = 0; i <= N; i += 1) {
    const x = -halfL + (i / N) * len;
    // Clamp the profile to at least the rectangular wall height so the
    // sloped top never dips below the eave (would create non-manifold
    // wall geometry that CSG can't subtract cleanly).
    const topH = Math.max(height, Number.isFinite(topProfileM[i]) ? topProfileM[i]! : height);
    const yTop = baseY + topH;
    positions.push(x, baseY, +halfT); // 4i+0 front-base
    positions.push(x, baseY, -halfT); // 4i+1 back-base
    positions.push(x, yTop, +halfT); // 4i+2 front-top
    positions.push(x, yTop, -halfT); // 4i+3 back-top
  }

  const indices: number[] = [];
  for (let i = 0; i < N; i += 1) {
    const a = i * 4;
    const b = (i + 1) * 4;
    // front face (z = +halfT): outward normal +Z
    indices.push(a + 0, b + 0, b + 2);
    indices.push(a + 0, b + 2, a + 2);
    // back face (z = -halfT): outward normal -Z (reverse winding)
    indices.push(a + 1, a + 3, b + 3);
    indices.push(a + 1, b + 3, b + 1);
    // top face (sloped): outward normal +Y
    indices.push(a + 2, b + 2, b + 3);
    indices.push(a + 2, b + 3, a + 3);
    // bottom face (flat at y = baseY): outward normal -Y (reverse winding)
    indices.push(a + 0, a + 1, b + 1);
    indices.push(a + 0, b + 1, b + 0);
  }
  // Start cap (-X normal): front-base, top-front, top-back, back-base
  indices.push(0, 2, 3);
  indices.push(0, 3, 1);
  // End cap (+X normal): at i=N
  const e = N * 4;
  indices.push(e + 0, e + 1, e + 3);
  indices.push(e + 0, e + 3, e + 2);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}
