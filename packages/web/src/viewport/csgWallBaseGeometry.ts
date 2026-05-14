import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type CsgBaseFootprintPoint = { xM: number; zM: number };

export function wallBaseGeometryForCsg(
  len: number,
  height: number,
  thick: number,
  baseFootprints?: CsgBaseFootprintPoint[][],
): THREE.BufferGeometry {
  const cleanFootprints = baseFootprints
    ?.map((footprint) => footprint.filter((point) => Number.isFinite(point.xM + point.zM)))
    .filter((footprint) => footprint.length >= 3);
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
