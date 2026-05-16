import * as THREE from 'three';

import type { Element } from '@bim-ai/core';
import type { GroupDefinition, GroupInstance } from '../groups/groupTypes';
import type { ViewportPaintBundle } from './materials';
import {
  makeWallMesh,
  elevationMForLevel,
  makeDoorMesh,
  makeWindowMesh,
  makeColumnMesh,
  makeBeamMesh,
  type WallElem,
} from './meshBuilders';

/**
 * Builds a Three.js Group containing transformed 3D meshes for all member
 * elements of a group definition placed at the given instance offset.
 *
 * The insertion offset is (instance.insertionX/Y - definition.originX/Y).
 * Each child mesh is translated by that offset on the XZ plane.
 */
export function buildGroupInstance3d(
  instance: GroupInstance,
  definition: GroupDefinition,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const root = new THREE.Group();
  root.userData.bimPickId = instance.id;

  const offsetXM = (instance.insertionXMm - definition.originXMm) / 1000;
  const offsetZM = (instance.insertionYMm - definition.originYMm) / 1000;

  for (const elId of definition.elementIds) {
    const el = elementsById[elId];
    if (!el) continue;

    let obj: THREE.Object3D | null = null;

    try {
      if (el.kind === 'wall') {
        const elev = elevationMForLevel(el.levelId, elementsById);
        obj = makeWallMesh(el as WallElem, elev, paint, elementsById);
      } else if (el.kind === 'door') {
        const wall = elementsById[el.wallId];
        if (wall?.kind === 'wall') {
          const elev = elevationMForLevel(wall.levelId, elementsById);
          obj = makeDoorMesh(el, wall as WallElem, elev, paint, elementsById);
        }
      } else if (el.kind === 'window') {
        const wall = elementsById[el.wallId];
        if (wall?.kind === 'wall') {
          const elev = elevationMForLevel(wall.levelId, elementsById);
          obj = makeWindowMesh(el, wall as WallElem, elev, paint, elementsById);
        }
      } else if (el.kind === 'column') {
        const elev = elevationMForLevel(el.levelId, elementsById);
        obj = makeColumnMesh(el, elev, paint);
      } else if (el.kind === 'beam') {
        const elev = elevationMForLevel(el.levelId, elementsById);
        obj = makeBeamMesh(el, elev, paint);
      }
    } catch {
      // Skip elements that fail to build rather than crashing the whole group.
    }

    if (obj) {
      obj.position.x += offsetXM;
      obj.position.z += offsetZM;
      root.add(obj);
    }
  }

  return root;
}
