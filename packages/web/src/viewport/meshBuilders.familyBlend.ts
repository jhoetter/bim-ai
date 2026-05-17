import * as THREE from 'three';

type FamilyBlendEl = Extract<import('@bim-ai/core').Element, { kind: 'family_blend' }>;

/**
 * §15.1.2 — Builds a lofted solid by linearly interpolating between
 * bottomProfileMm and topProfileMm.
 *
 * If both profiles have the same vertex count N, builds N quads (2 triangles
 * each) connecting bottom[i] → top[i] → top[i+1] → bottom[i+1].
 * Top and bottom caps use fan triangulation.
 */
export function buildFamilyBlendMesh(el: FamilyBlendEl): THREE.Mesh {
  const { bottomProfileMm: bot, topProfileMm: top, heightMm, baseElevationMm } = el;

  if (bot.length < 3 || top.length < 3 || heightMm <= 0) {
    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ color: '#b08860', roughness: 0.6 }),
    );
    mesh.userData.bimPickId = el.id;
    return mesh;
  }

  const n = bot.length;
  const m = top.length;
  const h = heightMm / 1000;
  const base = (baseElevationMm ?? 0) / 1000;

  const positions: number[] = [];
  const normals: number[] = [];

  function addTri(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
  ) {
    const ax = x1 - x0;
    const ay = y1 - y0;
    const az = z1 - z0;
    const bx = x2 - x0;
    const by = y2 - y0;
    const bz = z2 - z0;
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    positions.push(x0, y0, z0, x1, y1, z1, x2, y2, z2);
    normals.push(
      nx / len,
      ny / len,
      nz / len,
      nx / len,
      ny / len,
      nz / len,
      nx / len,
      ny / len,
      nz / len,
    );
  }

  // Side faces: N quads connecting bottom ring to top ring
  for (let i = 0; i < n; i++) {
    const b0 = bot[i]!;
    const b1 = bot[(i + 1) % n]!;
    const t0 = top[i % m]!;
    const t1 = top[(i + 1) % m]!;

    addTri(
      b0.xMm / 1000,
      b0.yMm / 1000,
      base,
      b1.xMm / 1000,
      b1.yMm / 1000,
      base,
      t0.xMm / 1000,
      t0.yMm / 1000,
      base + h,
    );
    addTri(
      b1.xMm / 1000,
      b1.yMm / 1000,
      base,
      t1.xMm / 1000,
      t1.yMm / 1000,
      base + h,
      t0.xMm / 1000,
      t0.yMm / 1000,
      base + h,
    );
  }

  // Bottom cap (fan triangulation, reversed winding for outward normal)
  for (let i = 1; i < n - 1; i++) {
    addTri(
      bot[0]!.xMm / 1000,
      bot[0]!.yMm / 1000,
      base,
      bot[i + 1]!.xMm / 1000,
      bot[i + 1]!.yMm / 1000,
      base,
      bot[i]!.xMm / 1000,
      bot[i]!.yMm / 1000,
      base,
    );
  }

  // Top cap (fan triangulation)
  for (let i = 1; i < m - 1; i++) {
    addTri(
      top[0]!.xMm / 1000,
      top[0]!.yMm / 1000,
      base + h,
      top[i]!.xMm / 1000,
      top[i]!.yMm / 1000,
      base + h,
      top[i + 1]!.xMm / 1000,
      top[i + 1]!.yMm / 1000,
      base + h,
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

  const mat = new THREE.MeshStandardMaterial({ color: '#b08860', roughness: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.bimPickId = el.id;
  return mesh;
}
