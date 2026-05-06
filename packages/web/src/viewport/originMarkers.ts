import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

/**
 * KRN-06: small visual markers for the three origin element kinds.
 *
 * - `internal_origin` → yellow XYZ axis triad
 * - `project_base_point` → blue circled cross with PBP label
 * - `survey_point` → green triangle with SP label
 *
 * Markers are sized in screen-meaningful world units (~0.5 m) so they are visible
 * regardless of model extents. Visibility is gated by the "Site / Origin" VV toggle
 * (viewerCategoryHidden['site_origin']).
 */

const MARKER_SIZE_M = 0.5;
const PBP_COLOR = 0x2563eb; // blue
const SP_COLOR = 0x16a34a; // green
const ORIGIN_COLOR = 0xeab308; // yellow

function makeAxisLine(direction: THREE.Vector3, color: number): THREE.Line {
  const points = [new THREE.Vector3(0, 0, 0), direction.clone().multiplyScalar(MARKER_SIZE_M)];
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true });
  const line = new THREE.Line(geo, mat);
  line.renderOrder = 999;
  return line;
}

export function makeInternalOriginMarker(
  el: Extract<Element, { kind: 'internal_origin' }>,
): THREE.Group {
  const g = new THREE.Group();
  g.add(makeAxisLine(new THREE.Vector3(1, 0, 0), 0xff3333)); // X red
  g.add(makeAxisLine(new THREE.Vector3(0, 1, 0), 0x33ff33)); // Y green (world up)
  g.add(makeAxisLine(new THREE.Vector3(0, 0, 1), 0x3333ff)); // Z blue
  // Small yellow node sphere to make the origin point visible in clutter.
  const node = new THREE.Mesh(
    new THREE.SphereGeometry(MARKER_SIZE_M * 0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color: ORIGIN_COLOR, depthTest: false, transparent: true }),
  );
  node.renderOrder = 1000;
  g.add(node);
  g.position.set(0, 0, 0);
  g.userData.bimPickId = el.id;
  return g;
}

export function makeProjectBasePointMarker(
  el: Extract<Element, { kind: 'project_base_point' }>,
): THREE.Group {
  const g = new THREE.Group();

  // Circle outline (XZ plane = plan plane).
  const circleGeo = new THREE.RingGeometry(MARKER_SIZE_M * 0.85, MARKER_SIZE_M, 32);
  circleGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: PBP_COLOR,
    side: THREE.DoubleSide,
    depthTest: false,
    transparent: true,
  });
  g.add(new THREE.Mesh(circleGeo, ringMat));

  // Cross inside the circle.
  const crossMat = new THREE.LineBasicMaterial({
    color: PBP_COLOR,
    depthTest: false,
    transparent: true,
  });
  const crossA = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-MARKER_SIZE_M, 0, 0),
      new THREE.Vector3(MARKER_SIZE_M, 0, 0),
    ]),
    crossMat,
  );
  const crossB = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -MARKER_SIZE_M),
      new THREE.Vector3(0, 0, MARKER_SIZE_M),
    ]),
    crossMat,
  );
  g.add(crossA, crossB);

  // World position: model X→world X, model Y→world Z, model Z→world Y.
  g.position.set(el.positionMm.xMm / 1000, el.positionMm.zMm / 1000, el.positionMm.yMm / 1000);
  // angleToTrueNorthDeg → rotation around world Y.
  g.rotation.y = THREE.MathUtils.degToRad(el.angleToTrueNorthDeg ?? 0);
  g.userData.bimPickId = el.id;
  g.userData.markerLabel = 'PBP';
  for (const child of g.children) child.renderOrder = 999;
  return g;
}

export function makeSurveyPointMarker(el: Extract<Element, { kind: 'survey_point' }>): THREE.Group {
  const g = new THREE.Group();

  // Equilateral triangle in plan (XZ plane), pointing +Z.
  const s = MARKER_SIZE_M;
  const h = (s * Math.sqrt(3)) / 2;
  const pts = [
    new THREE.Vector3(0, 0, -h * (2 / 3)),
    new THREE.Vector3(s / 2, 0, h * (1 / 3)),
    new THREE.Vector3(-s / 2, 0, h * (1 / 3)),
    new THREE.Vector3(0, 0, -h * (2 / 3)),
  ];
  const triGeo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color: SP_COLOR,
    depthTest: false,
    transparent: true,
  });
  g.add(new THREE.Line(triGeo, mat));

  g.position.set(el.positionMm.xMm / 1000, el.positionMm.zMm / 1000, el.positionMm.yMm / 1000);
  g.userData.bimPickId = el.id;
  g.userData.markerLabel = 'SP';
  for (const child of g.children) child.renderOrder = 999;
  return g;
}
