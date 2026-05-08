/**
 * EDT-03 — grip3dRenderer tests (closeout).
 */

import { describe, expect, test } from 'vitest';
import * as THREE from 'three';

import type { Grip3dDescriptor } from './grip3d';
import { buildAxisIndicator, buildGripMeshes } from './grip3dRenderer';

function stubGrip(
  id: string,
  position: { xMm: number; yMm: number; zMm: number },
): Grip3dDescriptor {
  return {
    id,
    role: 'topConstraintOffsetMm',
    position,
    axis: 'z',
    rangeMm: { minMm: -100, maxMm: 100 },
    onDrag: () => ({ elementId: id, property: 'topConstraintOffsetMm', valueMm: 0 }),
    onCommit: () => null,
  };
}

describe('buildGripMeshes', () => {
  test('emits one pickable per descriptor', () => {
    const scene = new THREE.Scene();
    const grips = [
      stubGrip('w1/top', { xMm: 0, yMm: 0, zMm: 3000 }),
      stubGrip('w1/base', { xMm: 0, yMm: 0, zMm: 0 }),
    ];
    const handle = buildGripMeshes(scene, grips);
    expect(handle.pickables).toHaveLength(2);
    expect(handle.pickables.every((p) => p instanceof THREE.Mesh)).toBe(true);
  });

  test('descriptor round-trips via mesh userData', () => {
    const scene = new THREE.Scene();
    const desc = stubGrip('roof/ridge', { xMm: 1000, yMm: 2000, zMm: 5000 });
    const handle = buildGripMeshes(scene, [desc]);
    const round = handle.pickables[0].userData.grip3dDescriptor as Grip3dDescriptor;
    expect(round.id).toBe('roof/ridge');
    expect(round.role).toBe(desc.role);
  });

  test('raycast against pickable hits the grip mesh', () => {
    const scene = new THREE.Scene();
    const desc = stubGrip('hit-me', { xMm: 0, yMm: 0, zMm: 0 });
    const handle = buildGripMeshes(scene, [desc]);
    const ray = new THREE.Raycaster();
    // Aim the ray at the origin (where vec(0,0,0) sits in scene space).
    ray.set(new THREE.Vector3(2, 0, 0), new THREE.Vector3(-1, 0, 0));
    const hits = ray.intersectObjects(handle.pickables, false);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].object).toBe(handle.pickables[0]);
  });

  test('dispose removes meshes from the scene', () => {
    const scene = new THREE.Scene();
    const before = scene.children.length;
    const handle = buildGripMeshes(scene, [stubGrip('w/top', { xMm: 0, yMm: 0, zMm: 3000 })]);
    expect(scene.children.length).toBeGreaterThan(before);
    handle.dispose();
    expect(scene.children.length).toBe(before);
  });
});

describe('buildAxisIndicator', () => {
  test('adds emissive LineSegments to the scene', () => {
    const scene = new THREE.Scene();
    const before = scene.children.length;
    const handle = buildAxisIndicator(scene, { xMm: 0, yMm: 0, zMm: 0 }, 'z', 2000);
    expect(scene.children.length).toBe(before + 1);
    const line = scene.children[scene.children.length - 1] as THREE.LineSegments;
    expect(line).toBeInstanceOf(THREE.LineSegments);
    handle.dispose();
    expect(scene.children.length).toBe(before);
  });

  test('update mutates the geometry positions for non-zero delta', () => {
    const scene = new THREE.Scene();
    const handle = buildAxisIndicator(scene, { xMm: 0, yMm: 0, zMm: 0 }, 'z', 2000);
    const line = scene.children[scene.children.length - 1] as THREE.LineSegments;
    handle.update(500);
    const positions = line.geometry.attributes.position.array as Float32Array;
    // After update: segment runs from origin -> origin+500mm on Y axis;
    // element[4] = end.y in scene metres.
    expect(Math.abs(positions[4] - 0.5)).toBeLessThan(1e-3);
    handle.dispose();
  });

  test('xy / xyz axes render a 3-axis cross', () => {
    const scene = new THREE.Scene();
    const handle = buildAxisIndicator(scene, { xMm: 0, yMm: 0, zMm: 0 }, 'xy', 1000);
    const line = scene.children[scene.children.length - 1] as THREE.LineSegments;
    // 3 axes × 2 endpoints × 3 components = 18 floats.
    expect((line.geometry.attributes.position.array as Float32Array).length).toBe(18);
    handle.dispose();
  });
});
