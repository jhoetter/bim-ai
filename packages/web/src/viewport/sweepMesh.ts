import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { type ViewportPaintBundle } from './materials';
import { addEdges, categoryColorOr } from './sceneHelpers';
import { makeThreeMaterialForKey } from './threeMaterialFactory';

function elevationMForLevel(levelId: string, elementsById: Record<string, Element>): number {
  const lvl = elementsById[levelId];
  if (!lvl || lvl.kind !== 'level') return 0;
  return lvl.elevationMm / 1000;
}

type SweepElem = Extract<Element, { kind: 'sweep' }>;

/**
 * KRN-15 — build a swept-solid mesh by extruding a closed 2D profile
 * along an open or closed 3D polyline path.
 *
 * Convention. `pathMm` is in plan coords with optional `zMm` (height).
 * We map plan (x, y, z) → world (x, z, -y) in mm, then scale to metres
 * at the mesh level. The mesh is positioned vertically at the level's
 * elevation; `zMm` on path points is treated as world-Y offset on top
 * of that elevation.
 *
 * The profile is centred in a frame perpendicular to the path tangent.
 * `profilePlane: 'work_plane'` interprets `(uMm, vMm)` as `(world-X, world-Z)`
 * shift before being rotated into the path frame; for our piecewise-linear
 * frames we use parallel-transport with world-Y as the initial reference.
 */
/**
 * Fast path: when the sweep path is planar on a constant `yMm` (i.e. it
 * lies entirely on a south- or north-facing facade plane) AND the profile
 * is a rectangle, build the frame as an `ExtrudeGeometry` ring (outer
 * polygon minus an inward-offset inner polygon). This produces a clean
 * miter at every corner without the parallel-transport ribbon-twist
 * artifact that the general path-sweep exhibits at sharp corners on a
 * gable polygon — the artifact looked like a diagonal "kink" cutting
 * through the picture frame's interior.
 *
 * Profile rectangle is interpreted as:
 *   `uMm` (max - min) → frame depth perpendicular to facade (proud)
 *   `vMm` (max - min) → frame band width (perpendicular to path within
 *                       facade plane)
 */
function buildPlanarFrameRingGeometry(
  pathPtsMm: { xMm: number; yMm: number; zMm?: number }[],
  profilePtsMm: { uMm: number; vMm: number }[],
): THREE.BufferGeometry | null {
  // All path points must share the same yMm (planar on facade).
  const y0 = pathPtsMm[0].yMm;
  for (const p of pathPtsMm) {
    if (Math.abs(p.yMm - y0) > 1e-3) return null;
  }
  // Path must be a closed loop with ≥4 unique vertices + closure.
  const closed =
    pathPtsMm.length >= 4 &&
    Math.abs(pathPtsMm[0].xMm - pathPtsMm[pathPtsMm.length - 1].xMm) < 1e-3 &&
    Math.abs((pathPtsMm[0].zMm ?? 0) - (pathPtsMm[pathPtsMm.length - 1].zMm ?? 0)) < 1e-3;
  if (!closed) return null;
  // Profile must be a 4-vertex rectangle aligned to (u, v).
  if (profilePtsMm.length !== 4) return null;
  const us = profilePtsMm.map((p) => p.uMm);
  const vs = profilePtsMm.map((p) => p.vMm);
  const uMin = Math.min(...us);
  const uMax = Math.max(...us);
  const vMin = Math.min(...vs);
  const vMax = Math.max(...vs);
  const isRect = profilePtsMm.every(
    (p) =>
      (Math.abs(p.uMm - uMin) < 1e-3 || Math.abs(p.uMm - uMax) < 1e-3) &&
      (Math.abs(p.vMm - vMin) < 1e-3 || Math.abs(p.vMm - vMax) < 1e-3),
  );
  if (!isRect) return null;
  const frameWidthMm = vMax - vMin; // band width on facade
  const frameDepthMm = uMax - uMin; // depth proud of facade

  // Centerline path on facade plane (drop closure vertex).
  const path = pathPtsMm.slice(0, -1).map((p) => ({ x: p.xMm, z: p.zMm ?? 0 }));

  // Compute centroid for inward-offset direction sign.
  let cx = 0;
  let cz = 0;
  for (const p of path) {
    cx += p.x;
    cz += p.z;
  }
  cx /= path.length;
  cz /= path.length;

  // Inward-offset polygon: each vertex is moved toward the centroid by
  // half the frame width. (Approximate but visually correct for convex
  // gable pentagons; the alternative — true polygon offset — needs a
  // mitre solver and isn't worth it for this use case.)
  const halfBand = frameWidthMm / 2;
  const innerPath = path.map((p) => {
    const dx = cx - p.x;
    const dz = cz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3) return { ...p };
    return { x: p.x + (dx / d) * halfBand, z: p.z + (dz / d) * halfBand };
  });

  // Outer-offset polygon analogously (away from centroid by half band).
  const outerPath = path.map((p) => {
    const dx = p.x - cx;
    const dz = p.z - cz;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3) return { ...p };
    return { x: p.x + (dx / d) * halfBand, z: p.z + (dz / d) * halfBand };
  });

  const shape = new THREE.Shape(outerPath.map((p) => new THREE.Vector2(p.x, p.z)));
  const hole = new THREE.Path(innerPath.map((p) => new THREE.Vector2(p.x, p.z)));
  shape.holes.push(hole);

  // Extrude along the perpendicular-to-facade axis (= world Z given the
  // viewport convention). After extrusion ExtrudeGeometry places the
  // shape in (x, y) plane extruded along +z. We rotate so:
  //   shape plane (x, y) → world (x, y_height = +z), extrusion axis → world -z
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: frameDepthMm,
    bevelEnabled: false,
    steps: 1,
  });
  // ExtrudeGeometry leaves vertices in (shape.x, shape.y, 0..depth). For
  // our picture-frame: shape.x = planX, shape.y = planZ_height. We want
  // worldX = planX, worldY = planZ_height, worldZ centred on facade
  // plane y0 (= 0 for our south-face frame). Already aligned; just
  // recentre Z so the frame straddles the facade plane (-depth/2..+depth/2)
  // instead of starting at 0 and going +depth.
  geom.translate(0, 0, -frameDepthMm / 2);
  return geom;
}

export function buildSweepGeometry(
  pathPtsMm: { xMm: number; yMm: number; zMm?: number }[],
  profilePtsMm: { uMm: number; vMm: number }[],
): THREE.BufferGeometry {
  if (pathPtsMm.length < 2) {
    throw new Error('sweep: path needs ≥2 points');
  }
  if (profilePtsMm.length < 3) {
    throw new Error('sweep: profile needs ≥3 points');
  }
  // Try planar-frame fast path first (eliminates parallel-transport
  // artifacts at sharp corners on closed gable polygons).
  const planar = buildPlanarFrameRingGeometry(pathPtsMm, profilePtsMm);
  if (planar) return planar;

  // Convert path to world-mm Vector3s.
  const pts = pathPtsMm.map((p) => new THREE.Vector3(p.xMm, p.zMm ?? 0, -p.yMm));

  // Detect closed loop (first === last vertex within 1 mm).
  const closed = pts.length >= 4 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-3;
  const ringPts = closed ? pts.slice(0, -1) : pts;
  const N = ringPts.length;

  // Edge tangents.
  const edgeTangents: THREE.Vector3[] = [];
  for (let i = 0; i < N; i++) {
    const next = closed ? (i + 1) % N : Math.min(i + 1, N - 1);
    const cur = i;
    if (cur === next) {
      // Open path final vertex copies the previous tangent.
      edgeTangents.push(
        edgeTangents[edgeTangents.length - 1]?.clone() ?? new THREE.Vector3(1, 0, 0),
      );
    } else {
      edgeTangents.push(ringPts[next].clone().sub(ringPts[cur]).normalize());
    }
  }

  // Vertex tangents = average of incoming + outgoing edge (for closed) or edge endpoints.
  const vertexTangents: THREE.Vector3[] = [];
  for (let i = 0; i < N; i++) {
    if (closed) {
      const prev = (i - 1 + N) % N;
      const cur = i;
      const t = edgeTangents[prev].clone().add(edgeTangents[cur]).normalize();
      vertexTangents.push(t);
    } else if (i === 0) {
      vertexTangents.push(edgeTangents[0].clone());
    } else if (i === N - 1) {
      vertexTangents.push(edgeTangents[N - 2].clone());
    } else {
      const t = edgeTangents[i - 1].clone().add(edgeTangents[i]).normalize();
      vertexTangents.push(t);
    }
  }

  // Parallel-transport frames. Initial reference is world-Y; if first
  // tangent is parallel to Y we fall back to world-X.
  const upY = new THREE.Vector3(0, 1, 0);
  const upX = new THREE.Vector3(1, 0, 0);
  const frames: { tangent: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3 }[] = [];

  let refUp = Math.abs(vertexTangents[0].dot(upY)) > 0.95 ? upX.clone() : upY.clone();
  let prevU = new THREE.Vector3().crossVectors(vertexTangents[0], refUp).normalize();
  // For our use-case the south-facade picture-frame path lies in the world
  // X-Y plane (Z=0), so the initial cross is well-defined.
  if (prevU.lengthSq() < 1e-6) {
    refUp = upX.clone();
    prevU = new THREE.Vector3().crossVectors(vertexTangents[0], refUp).normalize();
  }
  let prevV = new THREE.Vector3().crossVectors(prevU, vertexTangents[0]).normalize();

  for (let i = 0; i < N; i++) {
    const t = vertexTangents[i];
    if (i === 0) {
      frames.push({ tangent: t.clone(), u: prevU.clone(), v: prevV.clone() });
      continue;
    }
    // Project previous v onto plane perpendicular to current tangent.
    const tPrev = vertexTangents[i - 1];
    const rotAxis = new THREE.Vector3().crossVectors(tPrev, t);
    const rotLen = rotAxis.length();
    let u = prevU.clone();
    let v = prevV.clone();
    if (rotLen > 1e-6) {
      const angle = Math.atan2(rotLen, tPrev.dot(t));
      rotAxis.normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(rotAxis, angle);
      u = u.applyQuaternion(q);
      v = v.applyQuaternion(q);
    }
    frames.push({ tangent: t.clone(), u, v });
    prevU = u;
    prevV = v;
  }

  // For closed loop with miters, scale u/v by 1/cos(angle/2) to keep
  // profile cross-section in miter plane. We approximate by leaving as-is
  // (good enough for thin profiles and gentle corner angles).

  const M = profilePtsMm.length;
  // Detect closed-loop profile (first === last) and trim duplicate.
  const closedProfile =
    M >= 4 &&
    Math.abs(profilePtsMm[0].uMm - profilePtsMm[M - 1].uMm) < 1e-3 &&
    Math.abs(profilePtsMm[0].vMm - profilePtsMm[M - 1].vMm) < 1e-3;
  const usableProfile = closedProfile ? profilePtsMm.slice(0, -1) : profilePtsMm;
  const Mp = usableProfile.length;

  const positions: number[] = [];
  const ringStart: number[] = [];
  const totalRings = closed ? N + 1 : N;
  for (let i = 0; i < totalRings; i++) {
    const idx = closed ? i % N : i;
    ringStart.push(positions.length / 3);
    const f = frames[idx];
    const origin = ringPts[idx];
    for (const p of usableProfile) {
      const offset = f.u.clone().multiplyScalar(p.uMm).add(f.v.clone().multiplyScalar(p.vMm));
      const v = origin.clone().add(offset);
      positions.push(v.x, v.y, v.z);
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < totalRings - 1; i++) {
    const aRing = ringStart[i];
    const bRing = ringStart[i + 1];
    for (let j = 0; j < Mp; j++) {
      const j2 = (j + 1) % Mp;
      const a = aRing + j;
      const b = aRing + j2;
      const c = bRing + j2;
      const d = bRing + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  // End caps for open paths.
  if (!closed) {
    // Triangulate profile via fan (assumes profile is convex).
    const startRing = ringStart[0];
    const endRing = ringStart[totalRings - 1];
    for (let j = 1; j < Mp - 1; j++) {
      // Reverse winding for start cap
      indices.push(startRing, startRing + j + 1, startRing + j);
      indices.push(endRing, endRing + j, endRing + j + 1);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

export function makeSweepMesh(
  sweep: SweepElem,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Object3D {
  const elev = elevationMForLevel(sweep.levelId, elementsById);

  let geom: THREE.BufferGeometry;
  try {
    geom = buildSweepGeometry(sweep.pathMm, sweep.profileMm);
  } catch {
    return new THREE.Group();
  }

  const material = makeThreeMaterialForKey(
    sweep.materialKey ?? null,
    categoryColorOr(paint, 'wall'),
    {
      fallbackRoughness: paint?.categories.wall.roughness ?? 0.7,
    },
  );

  const mesh = new THREE.Mesh(geom, material);
  mesh.scale.setScalar(0.001);
  mesh.position.y = elev;
  mesh.userData.bimPickId = sweep.id;
  addEdges(mesh, 30);
  return mesh;
}
