import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

type Pt2D = { xMm: number; yMm: number };

/**
 * §2.4.2: builds a profiled edge skirt around the floor slab perimeter.
 * The edgeProfileMm points define the cross-section in (outward, downward) space:
 *   x=0 is at the slab face, x>0 protrudes outward
 *   y=0 is at slab top, y>0 goes downward
 *
 * Returns null if edgeProfileMm has fewer than 2 points.
 */
export function buildFloorEdgeProfileMesh(
  floor: Extract<Element, { kind: 'floor' }>,
  thicknessMm: number,
  posY: number,
): THREE.Group | null {
  const profile = floor.edgeProfileMm;
  if (!profile || profile.length < 2) return null;

  const boundary = floor.boundaryMm ?? [];
  if (boundary.length < 3) return null;

  // Build the 2D cross-section shape in (outward, downward) coordinates.
  // In Three.js shape space: x = outward offset (metres), y = downward offset (negated).
  const shape = new THREE.Shape(profile.map((p) => new THREE.Vector2(p.xMm / 1000, -p.yMm / 1000)));

  const material = new THREE.MeshStandardMaterial({ color: '#cccccc', roughness: 0.8 });
  const group = new THREE.Group();
  group.userData.bimPickId = floor.id;
  group.userData.isEdgeProfile = true;

  // Walk the floor perimeter boundary (closed polygon) and extrude the profile along each edge.
  // Coordinate system: plan-X = world-X, plan-Y = world-Z (via negation in boundary map).
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i];
    const b = boundary[(i + 1) % boundary.length];
    // Plan Y is negated for world-Z (same convention as makeFloorSlabMesh shape construction).
    const dx = (b.xMm - a.xMm) / 1000;
    const dz = (b.yMm - a.yMm) / 1000;
    const segLen = Math.hypot(dx, dz);
    if (segLen < 1e-6) continue;

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: segLen,
      bevelEnabled: false,
    });

    const mesh = new THREE.Mesh(geom, material);

    // Rotate to align extrusion direction with the segment direction in the XZ plane.
    const angle = Math.atan2(dz, dx);
    mesh.rotation.y = -angle;
    // Position at segment start; posY is the world-Y of the top face of the slab.
    mesh.position.set(a.xMm / 1000, posY, a.yMm / 1000);
    group.add(mesh);
  }

  if (group.children.length === 0) return null;

  return group;
}
