/**
 * FAM-02 — sweep geometry builder.
 *
 * Produces a Three.js BufferGeometry by extruding a closed 2D profile
 * along a 2D path. The path's first segment defines the orientation
 * for the profile when ``profilePlane === 'normal_to_path_start'``; in
 * that mode, the profile sits perpendicular to the path so a
 * window-handle path with a circular profile yields a cylinder.
 *
 * For ``profilePlane === 'work_plane'``, the profile is interpreted
 * in the X/Z plane (work-plane = ground) and the path provides the
 * extrusion direction — useful when the path is itself in 3D.
 *
 * Pure function, no Three.js scene side effects. The geometry is
 * unit-mm; callers apply scene-scale at the mesh level.
 */

import * as THREE from 'three';
import type { SketchLine, SweepGeometryNode } from './types';

/** Convert chained sketch lines into an ordered vertex list. */
export function sketchLinesToPath(lines: SketchLine[]): { x: number; y: number }[] {
  if (lines.length === 0) return [];
  const out: { x: number; y: number }[] = [{ x: lines[0].startMm.xMm, y: lines[0].startMm.yMm }];
  for (const line of lines) {
    out.push({ x: line.endMm.xMm, y: line.endMm.yMm });
  }
  return out;
}

/** Convert a closed polyline of sketch lines into a Three.Shape. */
export function sketchLinesToShape(lines: SketchLine[]): THREE.Shape {
  const pts = sketchLinesToPath(lines);
  if (pts.length < 3) {
    throw new Error('sweepGeometry: profile needs at least 3 vertices');
  }
  // Close the loop by ignoring a duplicate trailing vertex.
  const closed =
    pts.length > 1 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y;
  const usable = closed ? pts.slice(0, -1) : pts;
  const shape = new THREE.Shape();
  shape.moveTo(usable[0].x, usable[0].y);
  for (let i = 1; i < usable.length; i++) {
    shape.lineTo(usable[i].x, usable[i].y);
  }
  shape.closePath();
  return shape;
}

/**
 * Build a Three.js BufferGeometry for a sweep node.
 *
 * Implementation notes:
 *   - For a single straight path segment we use ``ExtrudeGeometry``
 *     with a depth equal to the segment length, then orient the
 *     extrusion along the path tangent.
 *   - For a multi-segment path we build a ``CatmullRomCurve3`` and
 *     extrude along it (Three's ExtrudeGeometry supports an
 *     ``extrudePath`` option).
 *   - When ``profilePlane === 'work_plane'`` the profile is placed
 *     in the X/Y plane and the path provides the direction vector.
 */
export function meshFromSweep(node: SweepGeometryNode): THREE.BufferGeometry {
  const pathPts = sketchLinesToPath(node.pathLines);
  if (pathPts.length < 2) {
    throw new Error('sweepGeometry: path needs at least 2 vertices');
  }
  const shape = sketchLinesToShape(node.profile);

  // Single straight segment fast path → simple extrude
  if (pathPts.length === 2) {
    const dx = pathPts[1].x - pathPts[0].x;
    const dy = pathPts[1].y - pathPts[0].y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      throw new Error('sweepGeometry: zero-length path');
    }
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: length,
      bevelEnabled: false,
      steps: 1,
    });
    // ExtrudeGeometry extrudes along +Z. Rotate so the extrusion
    // aligns with the 2D path direction in the X/Y plane.
    const angle = Math.atan2(dy, dx);
    if (node.profilePlane === 'normal_to_path_start') {
      // Profile is perpendicular to the path. Map +Z (extrusion axis)
      // to the path direction in the X/Y plane.
      geom.rotateY(Math.PI / 2);
      geom.rotateZ(angle);
    } else {
      // Profile lives in the work plane; +Z extrusion is "up".
      // Translate the start to (pathPts[0].x, pathPts[0].y, 0).
    }
    geom.translate(pathPts[0].x, pathPts[0].y, 0);
    return geom;
  }

  // Multi-segment path → curve-driven extrusion.
  const curve = new THREE.CatmullRomCurve3(
    pathPts.map((p) => new THREE.Vector3(p.x, p.y, 0)),
    false,
    'catmullrom',
    0.0,
  );
  const geom = new THREE.ExtrudeGeometry(shape, {
    extrudePath: curve,
    bevelEnabled: false,
    steps: Math.max(2, pathPts.length * 8),
  });
  return geom;
}

/** Bounding-box helper that's stable across Three.js versions. */
export function sweepBoundingBox(node: SweepGeometryNode): {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
} {
  const geom = meshFromSweep(node);
  geom.computeBoundingBox();
  const bb = geom.boundingBox!;
  const result = {
    min: { x: bb.min.x, y: bb.min.y, z: bb.min.z },
    max: { x: bb.max.x, y: bb.max.y, z: bb.max.z },
  };
  geom.dispose();
  return result;
}
