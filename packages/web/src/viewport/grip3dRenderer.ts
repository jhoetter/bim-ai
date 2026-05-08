/**
 * EDT-03 — 3D grip renderer (closeout).
 *
 * Pure scene-helper module — no React, no app state. Builds Three.js
 * meshes for the grip descriptors registered in `grip3d.ts` and a
 * coloured axis indicator that the Viewport's pointer handlers show
 * during a live drag. Kept separate so it is unit-testable without
 * the full Viewport wiring.
 */

import * as THREE from 'three';

import type { Grip3dAxis, Grip3dDescriptor } from './grip3d';

/** mm → m for Three.js scene coordinates (existing convention). */
const MM_PER_M = 1000;

/**
 * Visual size of the grip sphere in scene metres. Matches the size of
 * the existing 2D grip squares to keep direct-manipulation feel
 * consistent across the viewports.
 */
const GRIP_SPHERE_RADIUS_M = 0.06;

/**
 * Axis-indicator length default — long enough that the highlight is
 * obvious at typical building scales but short enough to not cross
 * the entire scene. Callers can override per-grip via `lengthMm`.
 */
const AXIS_INDICATOR_DEFAULT_LENGTH_MM = 1500;

/** Axis tint table — RGB, matches conventional colouring. */
const AXIS_COLOURS: Record<Grip3dAxis, number> = {
  x: 0xff5050,
  y: 0x50ff50,
  z: 0x50a0ff,
  xy: 0xc0c0c0,
  xyz: 0xffffff,
};

export type GripMeshHandle = {
  /** Tear down all meshes added by the call. */
  dispose(): void;
  /** Pickable objects (raycaster targets). */
  pickables: THREE.Object3D[];
};

export type AxisIndicatorHandle = {
  /** Update the indicator's preview length (mm) along its axis. */
  update(deltaMm: number): void;
  dispose(): void;
};

function vecMmToScene(p: { xMm: number; yMm: number; zMm: number }): THREE.Vector3 {
  // Existing scene convention: world-Y is up; semantic-Z (elevation)
  // maps to scene-Y; semantic-Y (depth) maps to scene-Z. This matches
  // OrbitViewpointPersistedHud + Viewport.tsx (~L472).
  return new THREE.Vector3(p.xMm / MM_PER_M, p.zMm / MM_PER_M, p.yMm / MM_PER_M);
}

/**
 * Build a small sphere + sprite per grip descriptor, attach the
 * descriptor to userData so a raycast hit maps back. Returns the
 * pickables list (for `raycaster.intersectObjects`) plus a disposer.
 */
export function buildGripMeshes(scene: THREE.Scene, grips: Grip3dDescriptor[]): GripMeshHandle {
  const pickables: THREE.Object3D[] = [];
  const disposers: Array<() => void> = [];

  const sphereGeom = new THREE.SphereGeometry(GRIP_SPHERE_RADIUS_M, 16, 12);
  disposers.push(() => sphereGeom.dispose());

  for (const descriptor of grips) {
    const colour = AXIS_COLOURS[descriptor.axis] ?? 0xffffff;
    const mat = new THREE.MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    disposers.push(() => mat.dispose());

    const mesh = new THREE.Mesh(sphereGeom, mat);
    mesh.position.copy(vecMmToScene(descriptor.position));
    mesh.renderOrder = 1000;
    mesh.userData = {
      ...mesh.userData,
      grip3dDescriptor: descriptor,
      bimGripId: descriptor.id,
    };
    scene.add(mesh);
    pickables.push(mesh);
    disposers.push(() => {
      scene.remove(mesh);
    });

    // Sprite halo so the grip stands out against opaque surfaces.
    const spriteMat = new THREE.SpriteMaterial({
      color: colour,
      opacity: 0.35,
      transparent: true,
      depthTest: false,
    });
    disposers.push(() => spriteMat.dispose());
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(GRIP_SPHERE_RADIUS_M * 3, GRIP_SPHERE_RADIUS_M * 3, 1);
    sprite.position.copy(mesh.position);
    sprite.renderOrder = 999;
    sprite.userData = {
      ...sprite.userData,
      grip3dDescriptor: descriptor,
      grip3dHaloFor: descriptor.id,
    };
    scene.add(sprite);
    disposers.push(() => {
      scene.remove(sprite);
    });
  }

  return {
    pickables,
    dispose() {
      while (disposers.length) {
        const d = disposers.pop();
        if (d) {
          try {
            d();
          } catch {
            /* ignore — best-effort teardown */
          }
        }
      }
    },
  };
}

/**
 * Emissive line-segments indicator along an axis. Used while a grip
 * drag is in progress. The indicator scales as the user drags so they
 * see the live delta. For free axes ('xy' / 'xyz') we render a small
 * cross — there's no single direction to show.
 */
export function buildAxisIndicator(
  scene: THREE.Scene,
  origin: { xMm: number; yMm: number; zMm: number },
  axis: Grip3dAxis,
  lengthMm: number = AXIS_INDICATOR_DEFAULT_LENGTH_MM,
): AxisIndicatorHandle {
  const colour = AXIS_COLOURS[axis] ?? 0xffffff;
  const mat = new THREE.LineBasicMaterial({
    color: colour,
    transparent: true,
    opacity: 0.85,
    depthTest: false,
  });
  const geom = new THREE.BufferGeometry();
  const originVec = vecMmToScene(origin);
  const halfLenM = lengthMm / MM_PER_M / 2;

  function axisVector(a: Grip3dAxis): THREE.Vector3[] {
    if (a === 'x') {
      return [
        new THREE.Vector3(originVec.x - halfLenM, originVec.y, originVec.z),
        new THREE.Vector3(originVec.x + halfLenM, originVec.y, originVec.z),
      ];
    }
    if (a === 'y') {
      // Semantic-Y maps to scene-Z.
      return [
        new THREE.Vector3(originVec.x, originVec.y, originVec.z - halfLenM),
        new THREE.Vector3(originVec.x, originVec.y, originVec.z + halfLenM),
      ];
    }
    if (a === 'z') {
      // Semantic-Z (elevation) maps to scene-Y.
      return [
        new THREE.Vector3(originVec.x, originVec.y - halfLenM, originVec.z),
        new THREE.Vector3(originVec.x, originVec.y + halfLenM, originVec.z),
      ];
    }
    // Free axes: render a tiny 3-axis cross at the origin.
    return [
      new THREE.Vector3(originVec.x - halfLenM / 3, originVec.y, originVec.z),
      new THREE.Vector3(originVec.x + halfLenM / 3, originVec.y, originVec.z),
      new THREE.Vector3(originVec.x, originVec.y - halfLenM / 3, originVec.z),
      new THREE.Vector3(originVec.x, originVec.y + halfLenM / 3, originVec.z),
      new THREE.Vector3(originVec.x, originVec.y, originVec.z - halfLenM / 3),
      new THREE.Vector3(originVec.x, originVec.y, originVec.z + halfLenM / 3),
    ];
  }

  const points = axisVector(axis);
  geom.setFromPoints(points);
  const lines = new THREE.LineSegments(geom, mat);
  lines.renderOrder = 998;
  lines.userData.grip3dAxisIndicator = true;
  scene.add(lines);

  return {
    update(deltaMm: number): void {
      // Re-layout to start at origin and extend by deltaMm along the axis.
      const dM = deltaMm / MM_PER_M;
      let updated: THREE.Vector3[];
      if (axis === 'x') {
        updated = [
          originVec.clone(),
          new THREE.Vector3(originVec.x + dM, originVec.y, originVec.z),
        ];
      } else if (axis === 'y') {
        updated = [
          originVec.clone(),
          new THREE.Vector3(originVec.x, originVec.y, originVec.z + dM),
        ];
      } else if (axis === 'z') {
        updated = [
          originVec.clone(),
          new THREE.Vector3(originVec.x, originVec.y + dM, originVec.z),
        ];
      } else {
        updated = points;
      }
      geom.setFromPoints(updated);
      geom.attributes.position.needsUpdate = true;
    },
    dispose(): void {
      scene.remove(lines);
      geom.dispose();
      mat.dispose();
    },
  };
}
