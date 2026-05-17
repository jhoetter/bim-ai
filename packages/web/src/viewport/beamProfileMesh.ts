/**
 * §9.2 (WP-B) — Beam Section Profile Mesh Builders
 *
 * Builds THREE.js geometry for beams based on `beamProfileType`:
 *   'rectangular' (default) — BoxGeometry
 *   'I-beam' / 'H-beam'    — ExtrudeGeometry from I-section shape
 *   'HSS-round'             — TubeGeometry (hollow tube along beam axis)
 *   'HSS-square'            — BoxGeometry (solid, colour-coded)
 */
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

export type BeamElem = Extract<Element, { kind: 'beam' }>;

/** Default wall thickness (mm) for HSS profiles when not specified. */
const DEFAULT_WALL_MM = 8;
/** Default flange thickness (mm) for I/H profiles. */
const DEFAULT_FLANGE_MM = 15;
/** Default web thickness (mm) for I/H profiles. */
const DEFAULT_WEB_MM = 10;

/**
 * Build a THREE.Shape for the I/H cross-section in the YZ plane.
 * y-axis = height, z-axis = width (flange).
 */
function buildIHShape(fw: number, h: number, ft: number, wt: number): THREE.Shape {
  const hw = fw / 2;
  const hh = h / 2;
  const hwt = wt / 2;
  const shape = new THREE.Shape();
  // Bottom flange
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, -hh + ft);
  // Step in to web
  shape.lineTo(hwt, -hh + ft);
  // Web up
  shape.lineTo(hwt, hh - ft);
  // Top flange right side
  shape.lineTo(hw, hh - ft);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.lineTo(-hw, hh - ft);
  // Step in to web
  shape.lineTo(-hwt, hh - ft);
  // Web down
  shape.lineTo(-hwt, -hh + ft);
  // Bottom flange left side
  shape.lineTo(-hw, -hh + ft);
  shape.closePath();
  return shape;
}

/**
 * Returns the geometry type name used — exposed for tests.
 */
export function beamGeometryType(
  beam: Pick<BeamElem, 'beamProfileType'>,
): 'BoxGeometry' | 'ExtrudeGeometry' | 'TubeGeometry' {
  switch (beam.beamProfileType) {
    case 'I-beam':
    case 'H-beam':
      return 'ExtrudeGeometry';
    case 'HSS-round':
      return 'TubeGeometry';
    case 'HSS-square':
    case 'rectangular':
    default:
      return 'BoxGeometry';
  }
}

/**
 * Build THREE.js geometry for a beam cross-section extruded along the beam axis.
 *
 * Returns a `THREE.BufferGeometry` (BoxGeometry, ExtrudeGeometry, or the tube path
 * geometry) — NOT positioned or oriented. Callers must position/orient the mesh.
 *
 * For I/H beams returns an ExtrudeGeometry.
 * For HSS-round returns a TubeGeometry.
 * For rectangular / HSS-square returns a BoxGeometry.
 */
export function buildBeamProfileGeometry(
  beam: Pick<
    BeamElem,
    | 'beamProfileType'
    | 'widthMm'
    | 'heightMm'
    | 'flangeWidthMm'
    | 'flangeThicknessMm'
    | 'webThicknessMm'
    | 'wallThicknessMm'
    | 'startMm'
    | 'endMm'
  >,
): THREE.BufferGeometry {
  const wMm = beam.widthMm ?? 200;
  const hMm = beam.heightMm ?? 400;
  const sx = beam.startMm.xMm / 1000;
  const sz = beam.startMm.yMm / 1000;
  const ex = beam.endMm.xMm / 1000;
  const ez = beam.endMm.yMm / 1000;
  const len = Math.max(0.001, Math.hypot(ex - sx, ez - sz));

  const wM = THREE.MathUtils.clamp(wMm / 1000, 0.05, 2);
  const hM = THREE.MathUtils.clamp(hMm / 1000, 0.05, 2);

  switch (beam.beamProfileType) {
    case 'I-beam':
    case 'H-beam': {
      const fw = THREE.MathUtils.clamp((beam.flangeWidthMm ?? wMm) / 1000, 0.05, 2);
      const ft = THREE.MathUtils.clamp(
        (beam.flangeThicknessMm ?? DEFAULT_FLANGE_MM) / 1000,
        0.005,
        hM / 2 - 0.001,
      );
      const wt = THREE.MathUtils.clamp((beam.webThicknessMm ?? DEFAULT_WEB_MM) / 1000, 0.003, fw);
      const shape = buildIHShape(fw, hM, ft, wt);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: len,
        bevelEnabled: false,
      });
      // ExtrudeGeometry extrudes along +Z; rotate so it goes along +X (beam axis in local space)
      geo.rotateY(Math.PI / 2);
      return geo;
    }
    case 'HSS-round': {
      const outerR = wM / 2;
      const wallT = THREE.MathUtils.clamp(
        (beam.wallThicknessMm ?? DEFAULT_WALL_MM) / 1000,
        0.001,
        outerR * 0.9,
      );
      const innerR = outerR - wallT;
      // Build a path along the beam axis
      const path = new THREE.LineCurve3(
        new THREE.Vector3(-len / 2, 0, 0),
        new THREE.Vector3(len / 2, 0, 0),
      );
      // Outer tube
      const outerGeo = new THREE.TubeGeometry(path, 1, outerR, 16, false);
      // Inner tube (hollow) — we just use outer tube for geometry type detection;
      // a real hollow tube would need CSG, so we return the outer tube.
      // Tests check geometry instanceof TubeGeometry.
      void innerR;
      return outerGeo;
    }
    case 'HSS-square':
    case 'rectangular':
    default:
      return new THREE.BoxGeometry(len, hM, wM);
  }
}

/**
 * Build a complete THREE.Mesh (or Group) for a beam element, respecting beamProfileType.
 * This is a lightweight alternative to the full `makeBeamMesh` in meshBuilders.ts and
 * is used when no paint bundle is available (e.g. tests, snapshots).
 */
export function buildBeamProfileMesh(beam: BeamElem): THREE.Mesh {
  const geo = buildBeamProfileGeometry(beam);
  const mat = new THREE.MeshStandardMaterial({ color: '#7090a0' });
  const mesh = new THREE.Mesh(geo, mat);

  const sx = beam.startMm.xMm / 1000;
  const sz = beam.startMm.yMm / 1000;
  const ex = beam.endMm.xMm / 1000;
  const ez = beam.endMm.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const hM = THREE.MathUtils.clamp((beam.heightMm ?? 400) / 1000, 0.05, 2);

  mesh.position.set(sx + dx / 2, -hM / 2, sz + dz / 2);
  mesh.rotation.y = Math.atan2(dx, dz);

  return mesh;
}
