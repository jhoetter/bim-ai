import * as THREE from 'three';

export type OpeningClearanceSpan = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

export function openingSpanFromBoxCutter(cutter: {
  cutW: number;
  cutH: number;
  localX: number;
  localY: number;
}): OpeningClearanceSpan {
  return {
    xMin: cutter.localX - cutter.cutW / 2,
    xMax: cutter.localX + cutter.cutW / 2,
    yMin: cutter.localY - cutter.cutH / 2,
    yMax: cutter.localY + cutter.cutH / 2,
  };
}

export function frontBackWallFaceTrianglesInsideOpening(
  geometry: THREE.BufferGeometry,
  wallThickM: number,
  span: OpeningClearanceSpan,
  marginM = 0.06,
): number {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return 0;
  const index = geometry.index;
  const triCount = index ? index.count / 3 : pos.count / 3;
  let count = 0;

  for (let tri = 0; tri < triCount; tri++) {
    const vertexIndices = index
      ? [index.getX(tri * 3), index.getX(tri * 3 + 1), index.getX(tri * 3 + 2)]
      : [tri * 3, tri * 3 + 1, tri * 3 + 2];
    const vertices = vertexIndices.map(
      (i) => new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)),
    );
    const onFrontOrBackFace = vertices.every(
      (v) => Math.abs(Math.abs(v.z) - wallThickM / 2) < 1e-4,
    );
    const xs = vertices.map((v) => v.x);
    const ys = vertices.map((v) => v.y);
    const triMinX = Math.min(...xs);
    const triMaxX = Math.max(...xs);
    const triMinY = Math.min(...ys);
    const triMaxY = Math.max(...ys);
    const overlapsX = triMaxX > span.xMin + marginM && triMinX < span.xMax - marginM;
    const overlapsY = triMaxY > span.yMin + marginM && triMinY < span.yMax - marginM;
    if (onFrontOrBackFace && overlapsX && overlapsY) count += 1;
  }

  return count;
}
