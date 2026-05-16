import * as THREE from 'three';
import type { FamilySweep } from '@bim-ai/core';

/** §15.1.3 — extrudes a 2D profile along a 3D CatmullRom path. */
export function familySweepMesh(form: FamilySweep): THREE.Mesh {
  if (form.pathPoints.length < 2 || form.profilePoints.length < 3) {
    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ color: '#c8a882', side: THREE.DoubleSide }),
    );
    mesh.userData = { kind: form.kind };
    return mesh;
  }

  const pathCurve = new THREE.CatmullRomCurve3(
    form.pathPoints.map((p) => new THREE.Vector3(p.x / 1000, p.y / 1000, p.z / 1000)),
  );

  const shape = new THREE.Shape();
  const first = form.profilePoints[0]!;
  shape.moveTo(first.x / 1000, first.y / 1000);
  for (let i = 1; i < form.profilePoints.length; i++) {
    const p = form.profilePoints[i]!;
    shape.lineTo(p.x / 1000, p.y / 1000);
  }
  shape.closePath();

  const steps = Math.max(12, form.pathPoints.length * 4);
  const geo = new THREE.ExtrudeGeometry(shape, {
    extrudePath: pathCurve,
    steps,
    bevelEnabled: false,
  });

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: '#c8a882', side: THREE.DoubleSide }),
  );
  mesh.userData = { kind: form.kind };
  return mesh;
}
