import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ADDITION, Brush, Evaluator } from 'three-bvh-csg';
import type { Element } from '@bim-ai/core';

import { makeRoofMassMesh } from './meshBuilders';

/**
 * MF-rendering-X (#65) — CSG-union the two solids referenced by a RoofJoinElem
 * into a single merged geometry so cross-gables / Zwerchgiebel read as a
 * continuous roof body instead of a flat-topped box sitting on top of the
 * main roof.
 *
 * Mirrors the {@link applyDormerCutsToRoofGeom} pattern: imported lazily by
 * the viewport bootstrap (Viewport.tsx) so jsdom-based unit tests never load
 * `three-bvh-csg`, which crashes in that environment. Returns ``null`` on any
 * failure so the caller can fall back to the seam-line preview that we used
 * to ship as the only behaviour.
 */
export function buildRoofJoinUnionGeometry(
  primaryRoof: Extract<Element, { kind: 'roof' }>,
  secondaryRoof: Extract<Element, { kind: 'roof' }>,
  elementsById: Record<string, Element>,
): THREE.BufferGeometry | null {
  try {
    const primaryMesh = makeRoofMassMesh(primaryRoof, elementsById, null);
    const secondaryMesh = makeRoofMassMesh(secondaryRoof, elementsById, null);
    const primaryGeom = bakeWorldTransform(primaryMesh);
    const secondaryGeom = bakeWorldTransform(secondaryMesh);

    const evaluator = new Evaluator();
    // The roof builders emit position + normal, no uv. Match three-bvh-csg's
    // relevant-attribute set to those (the lib's default ['position', 'uv',
    // 'normal'] crashes on missing uv with
    //   "Cannot read properties of undefined (reading 'array')")
    evaluator.attributes = ['position', 'normal'];

    const a = new Brush(normaliseForCsg(primaryGeom));
    a.updateMatrixWorld();
    const b = new Brush(normaliseForCsg(secondaryGeom));
    b.updateMatrixWorld();

    const merged = evaluator.evaluate(a, b, ADDITION);
    merged.updateMatrixWorld();
    const out = merged.geometry;
    out.computeVertexNormals();
    return out;
  } catch (err) {
    console.warn(
      `[roofJoin] CSG union failed for primary=${primaryRoof.id} secondary=${secondaryRoof.id}; falling back to seam line.`,
      err,
    );
    return null;
  }
}

function bakeWorldTransform(mesh: THREE.Mesh): THREE.BufferGeometry {
  mesh.updateMatrixWorld(true);
  const clone = mesh.geometry.clone();
  if (!mesh.matrixWorld.equals(new THREE.Matrix4())) {
    clone.applyMatrix4(mesh.matrixWorld);
  }
  return clone;
}

function normaliseForCsg(input: THREE.BufferGeometry): THREE.BufferGeometry {
  // three-bvh-csg requires both operands to share an indexed position +
  // normal attribute set. Strip everything else, re-index, recompute
  // normals — same recipe used by applyDormerCutsToRoofGeom.
  const g = new THREE.BufferGeometry();
  const pos = input.getAttribute('position');
  g.setAttribute('position', pos);
  if (input.index) g.setIndex(input.index);
  const indexed = g.index ? g : mergeVertices(g);
  indexed.computeVertexNormals();
  return indexed;
}
