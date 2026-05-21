import * as THREE from 'three';
import type { Element, ToposolidExcavationElem } from '@bim-ai/core';

import { buildWindowFrameMesh, buildGlazingMesh } from './meshBuilders.windowFrame';

/**
 * WP-D §5.1.5 — Build a 3D pit mesh for a toposolid_excavation element.
 *
 * Coordinate system: plan xMm → world X, plan yMm → world -Z, elevation → world Y.
 * The pit sits at Y=0 (terrain surface) and carves down to Y = −depthMm/1000.
 *
 * Returns a Group with two children:
 *  0 — walls (ExtrudeGeometry along the boundary, extruded downward)
 *  1 — floor (ShapeGeometry at Y = −depthMm/1000)
 */
function cutterBoundaryMm(
  excav: ToposolidExcavationElem,
  elementsById?: Record<string, Element>,
): { xMm: number; yMm: number }[] {
  if (excav.boundaryMm && excav.boundaryMm.length >= 3) return excav.boundaryMm;
  const cutter = elementsById?.[excav.cutterElementId];
  if (!cutter) return [];
  if (
    (cutter.kind === 'floor' ||
      cutter.kind === 'roof' ||
      cutter.kind === 'site' ||
      cutter.kind === 'toposolid') &&
    Array.isArray((cutter as { boundaryMm?: unknown }).boundaryMm)
  ) {
    return (cutter as { boundaryMm: { xMm: number; yMm: number }[] }).boundaryMm;
  }
  if (cutter.kind === 'roof' && Array.isArray(cutter.footprintMm)) return cutter.footprintMm;
  return [];
}

function centroidMm(boundary: { xMm: number; yMm: number }[]): { xMm: number; yMm: number } {
  const sum = boundary.reduce(
    (acc, point) => ({ xMm: acc.xMm + point.xMm, yMm: acc.yMm + point.yMm }),
    { xMm: 0, yMm: 0 },
  );
  return { xMm: sum.xMm / boundary.length, yMm: sum.yMm / boundary.length };
}

function toposolidHeightAtPointMm(
  topo: Extract<Element, { kind: 'toposolid' }>,
  point: { xMm: number; yMm: number },
): number {
  const samples = topo.heightSamples ?? [];
  if (samples.length > 0) {
    let best = samples[0]!;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const sample of samples) {
      const dx = sample.xMm - point.xMm;
      const dy = sample.yMm - point.yMm;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        best = sample;
        bestDist = dist;
      }
    }
    return best.zMm;
  }
  return topo.baseElevationMm ?? 0;
}

export function buildExcavationMesh(
  excav: ToposolidExcavationElem,
  elementsById?: Record<string, Element>,
): THREE.Group {
  const group = new THREE.Group();
  const boundary = cutterBoundaryMm(excav, elementsById);
  if (boundary.length < 3) return group;

  const depthMm = excav.depthMm ?? (excav.customDepthMm != null ? excav.customDepthMm : 1500);
  if (typeof depthMm !== 'number' || depthMm <= 0) return group;
  const depthM = depthMm / 1000;

  const material = new THREE.MeshStandardMaterial({
    color: '#8B6914',
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0.0,
  });

  // Build 2D shape in XY using plan coords:
  //   shape X = xMm/1000, shape Y = -yMm/1000
  // After rotation.x = -Math.PI/2:
  //   shape X → world X, shape Y → world -Z (so -yMm/1000 → world Z = yMm/1000... wait)
  //   Actually: shape Y → world -Z (rotation by -PI/2 around X: Y → +Z under this transform)
  // Extrusion along shape Z → world -Y (downward) since shape Z → world -Y under rotation.x=-PI/2
  const shape = new THREE.Shape();
  const first = boundary[0]!;
  shape.moveTo(first.xMm / 1000, -first.yMm / 1000);
  for (let i = 1; i < boundary.length; i++) {
    const p = boundary[i]!;
    shape.lineTo(p.xMm / 1000, -p.yMm / 1000);
  }
  shape.closePath();

  // Walls — ExtrudeGeometry extruded along shape Z (→ world -Y after rotation)
  const wallGeom = new THREE.ExtrudeGeometry(shape, { depth: depthM, bevelEnabled: false });
  const wallMesh = new THREE.Mesh(wallGeom, material);
  wallMesh.rotation.x = -Math.PI / 2;
  group.add(wallMesh);

  // Floor — flat ShapeGeometry positioned at world Y = -depthM
  const floorGeom = new THREE.ShapeGeometry(shape);
  const floorMesh = new THREE.Mesh(floorGeom, material);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -depthM;
  group.add(floorMesh);

  group.userData.bimPickId = excav.id;
  const host = elementsById?.[excav.hostToposolidId];
  if (host?.kind === 'toposolid') {
    group.position.y = toposolidHeightAtPointMm(host, centroidMm(boundary)) / 1000;
  }
  return group;
}

/**
 * §15.1.2 — family editor extrusion mesh.
 * Extrudes profilePoints (mm, XY plane) by depthMm along Y.
 * If isGlazing is true, delegates to buildGlazingMesh.
 * If frameInnerWidthMm > 0, delegates to buildWindowFrameMesh.
 */
export function buildFamilyExtrusionMesh(form: import('@bim-ai/core').FamilyExtrusion): THREE.Mesh {
  if (form.isGlazing) {
    return buildGlazingMesh(form);
  }
  if (form.frameInnerWidthMm !== undefined && form.frameInnerWidthMm > 0) {
    return buildWindowFrameMesh(form);
  }
  if (form.depthMm <= 0 || form.profilePoints.length < 3) {
    return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
  }
  const shape = new THREE.Shape();
  const first = form.profilePoints[0]!;
  shape.moveTo(first.x / 1000, first.y / 1000);
  for (let i = 1; i < form.profilePoints.length; i++) {
    const p = form.profilePoints[i]!;
    shape.lineTo(p.x / 1000, p.y / 1000);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: form.depthMm / 1000,
    bevelEnabled: false,
  });
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#d0c8bc', roughness: 0.7 }));
}

/**
 * §15.1.3 — family editor revolve mesh.
 * Revolves profilePoints (mm) around the Y axis by angleDeg.
 */
export function buildFamilyRevolveMesh(form: import('@bim-ai/core').FamilyRevolve): THREE.Mesh {
  const points = form.profilePoints.map((p) => new THREE.Vector2(Math.abs(p.x) / 1000, p.y / 1000));
  const segments = Math.max(8, Math.round(Math.abs(form.angleDeg) / 5));
  const phiLength = (form.angleDeg * Math.PI) / 180;
  const geo = new THREE.LatheGeometry(points, segments, 0, phiLength);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#d0c8bc', roughness: 0.7 }));
}

/** §15.1.x — family editor void cut mesh. Wireframe red to indicate a subtracted volume. */
export function buildFamilyVoidMesh(form: import('@bim-ai/core').FamilyVoid): THREE.Mesh {
  if (form.depthMm <= 0 || form.profilePoints.length < 3) {
    return new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ wireframe: true, color: '#ff4444' }),
    );
  }
  const shape = new THREE.Shape();
  const first = form.profilePoints[0]!;
  shape.moveTo(first.x / 1000, first.y / 1000);
  for (let i = 1; i < form.profilePoints.length; i++) {
    const p = form.profilePoints[i]!;
    shape.lineTo(p.x / 1000, p.y / 1000);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: form.depthMm / 1000,
    bevelEnabled: false,
  });
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ wireframe: true, color: '#ff4444' }));
}

/** §4.7 — spot elevation 3D viewport label (diamond marker + elevation sprite). */
export function spotElevationThree(
  el: Extract<import('@bim-ai/core').Element, { kind: 'spot_elevation' }>,
  levelElevationMm: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `spot-elevation:${el.id}`;
  group.position.set(el.positionMm.xMm / 1000, el.elevationMm / 1000, -el.positionMm.yMm / 1000);

  const diamond = new THREE.Mesh(
    new THREE.PlaneGeometry(0.15, 0.15),
    new THREE.MeshBasicMaterial({
      color: el.colour ?? '#1a56db',
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  diamond.rotation.z = Math.PI / 4;
  diamond.renderOrder = 1100;
  group.add(diamond);

  const displayElevM =
    el.elevationMode === 'relative-to-level'
      ? (el.elevationMm - levelElevationMm) / 1000
      : el.elevationMm / 1000;
  const labelText = el.textOverride
    ? el.textOverride
    : `${el.prefix ?? ''}${displayElevM.toFixed(3)} m${el.suffix ?? ''}`;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sprite.position.set(0, 0.28, 0);
  sprite.scale.set(1.6, 0.32, 1);
  sprite.renderOrder = 1100;
  sprite.userData.spotElevationLabel = true;
  sprite.userData.spotElevationText = labelText;

  if (typeof document !== 'undefined' && labelText.trim()) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = '500 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillRect(0, 8, canvas.width, 48);
      ctx.fillStyle = 'rgba(20,24,31,0.92)';
      ctx.fillText(labelText.slice(0, 36), canvas.width / 2, canvas.height / 2);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      (sprite.material as THREE.SpriteMaterial).map = tex;
      (sprite.material as THREE.SpriteMaterial).needsUpdate = true;
    }
  }

  group.add(sprite);
  return group;
}

/** §7.1.1: model_line 3D renderer — flat polyline at the level elevation. */
export function modelLineThree(
  el: Extract<import('@bim-ai/core').Element, { kind: 'model_line' }>,
  levelElevationMm: number,
): THREE.Object3D {
  const grp = new THREE.Group();
  if (el.pointsMm.length < 2) return grp;

  const colour = el.colourHex ?? '#333333';
  const y = levelElevationMm / 1000;
  const pts = el.pointsMm.map((v) => new THREE.Vector3(v.xMm / 1000, y, -v.yMm / 1000));

  let mat: THREE.LineBasicMaterial | THREE.LineDashedMaterial;
  if (el.lineStyle === 'dashed' || el.lineStyle === 'dotted') {
    const dashSize = el.lineStyle === 'dotted' ? 0.04 : 0.12;
    const gapSize = el.lineStyle === 'dotted' ? 0.08 : 0.06;
    mat = new THREE.LineDashedMaterial({ color: colour, dashSize, gapSize });
  } else {
    mat = new THREE.LineBasicMaterial({ color: colour });
  }

  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  if (mat instanceof THREE.LineDashedMaterial) line.computeLineDistances();
  line.userData.elementId = el.id;
  line.userData.kind = 'model_line';
  grp.add(line);
  return grp;
}
