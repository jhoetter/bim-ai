import * as THREE from 'three';
import type { FamilyBlend } from '@bim-ai/core';

/** §15.1.4 — lofts between two 2D profiles at z=0 and z=heightMm/1000. */
export function familyBlendMesh(form: FamilyBlend): THREE.Mesh {
  const { bottomProfilePoints: bot, topProfilePoints: top, heightMm } = form;

  if (bot.length < 3 || top.length < 3 || heightMm <= 0) {
    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ color: '#c8a882', side: THREE.DoubleSide }),
    );
    mesh.userData = { kind: form.kind };
    return mesh;
  }

  const n = bot.length;
  const m = top.length;
  const h = heightMm / 1000;

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

  // Side faces connecting bottom ring to top ring
  for (let i = 0; i < n; i++) {
    const b0 = bot[i]!;
    const b1 = bot[(i + 1) % n]!;
    const t0 = top[i % m]!;
    const t1 = top[(i + 1) % m]!;

    addTri(b0.x / 1000, b0.y / 1000, 0, b1.x / 1000, b1.y / 1000, 0, t0.x / 1000, t0.y / 1000, h);
    addTri(b1.x / 1000, b1.y / 1000, 0, t1.x / 1000, t1.y / 1000, h, t0.x / 1000, t0.y / 1000, h);
  }

  // Bottom cap (fan triangulation with reversed winding for outward normal)
  for (let i = 1; i < n - 1; i++) {
    addTri(
      bot[0]!.x / 1000,
      bot[0]!.y / 1000,
      0,
      bot[i + 1]!.x / 1000,
      bot[i + 1]!.y / 1000,
      0,
      bot[i]!.x / 1000,
      bot[i]!.y / 1000,
      0,
    );
  }

  // Top cap
  for (let i = 1; i < m - 1; i++) {
    addTri(
      top[0]!.x / 1000,
      top[0]!.y / 1000,
      h,
      top[i]!.x / 1000,
      top[i]!.y / 1000,
      h,
      top[i + 1]!.x / 1000,
      top[i + 1]!.y / 1000,
      h,
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: '#c8a882', side: THREE.DoubleSide }),
  );
  mesh.userData = { kind: form.kind };
  return mesh;
}
