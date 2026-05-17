import * as THREE from 'three';

type FamilySweepEl = Extract<import('@bim-ai/core').Element, { kind: 'family_sweep' }>;

/**
 * §15.1.2 — Builds a swept solid by extruding a 2D profile along a 3D path.
 *
 * Uses THREE.ExtrudeGeometry with a CatmullRomCurve3 built from pathMm points.
 * The profile is built from profileMm (local XY plane at path start).
 */
export function buildFamilySweepMesh(el: FamilySweepEl): THREE.Mesh {
  const emptyMesh = () => {
    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ color: '#7a9a7a', roughness: 0.6 }),
    );
    mesh.userData.bimPickId = el.id;
    return mesh;
  };

  if (el.pathMm.length < 2 || el.profileMm.length < 3) {
    return emptyMesh();
  }

  const pathCurve = new THREE.CatmullRomCurve3(
    el.pathMm.map((p) => new THREE.Vector3(p.xMm / 1000, p.yMm / 1000, p.zMm / 1000)),
  );

  const shape = new THREE.Shape();
  const first = el.profileMm[0]!;
  shape.moveTo(first.xMm / 1000, first.yMm / 1000);
  for (let i = 1; i < el.profileMm.length; i++) {
    const p = el.profileMm[i]!;
    shape.lineTo(p.xMm / 1000, p.yMm / 1000);
  }
  shape.closePath();

  const steps = Math.max(12, el.pathMm.length * 4);
  const geo = new THREE.ExtrudeGeometry(shape, {
    extrudePath: pathCurve,
    steps,
    bevelEnabled: false,
  });

  const mat = new THREE.MeshStandardMaterial({ color: '#7a9a7a', roughness: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.bimPickId = el.id;
  return mesh;
}
