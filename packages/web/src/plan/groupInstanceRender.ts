import * as THREE from 'three';

import type { Element } from '@bim-ai/core';
import type { GroupDefinition, GroupInstance } from '../groups/groupTypes';
import { PLAN_Y, ux, uz } from './symbology';

const GROUP_DASH_COLOR = 0x6366f1;
const GROUP_SELECTED_COLOR = 0xf59e0b;
const GROUP_DASH_SIZE = 0.12;
const GROUP_GAP_SIZE = 0.06;

function elementBoundsXY(
  el: Element,
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (el.kind === 'wall') {
    return {
      minX: Math.min(el.start.xMm, el.end.xMm),
      maxX: Math.max(el.start.xMm, el.end.xMm),
      minY: Math.min(el.start.yMm, el.end.yMm),
      maxY: Math.max(el.start.yMm, el.end.yMm),
    };
  }
  if ('xMm' in el && 'yMm' in el) {
    const x = (el as { xMm: number }).xMm;
    const y = (el as { yMm: number }).yMm;
    return { minX: x - 200, maxX: x + 200, minY: y - 200, maxY: y + 200 };
  }
  if ('insertionPoint' in el) {
    const ip = (el as { insertionPoint: { xMm: number; yMm: number } }).insertionPoint;
    return { minX: ip.xMm - 200, maxX: ip.xMm + 200, minY: ip.yMm - 200, maxY: ip.yMm + 200 };
  }
  return null;
}

/**
 * Builds a dashed-rectangle plan glyph for a group instance.
 * The rectangle is the axis-aligned bounding box of the definition's member
 * elements, transformed by the instance insertion offset.
 */
export function buildGroupInstancePlanMesh(
  instance: GroupInstance,
  definition: GroupDefinition,
  elementsById: Record<string, Element>,
  selectedId: string | undefined,
): THREE.Object3D {
  const group = new THREE.Group();
  group.userData.bimPickId = instance.id;

  // Compute bounding box of definition members in world coords.
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  const offsetX = instance.insertionXMm - definition.originXMm;
  const offsetY = instance.insertionYMm - definition.originYMm;

  for (const elId of definition.elementIds) {
    const el = elementsById[elId];
    if (!el) continue;
    const b = elementBoundsXY(el);
    if (!b) continue;
    minX = Math.min(minX, b.minX + offsetX);
    maxX = Math.max(maxX, b.maxX + offsetX);
    minY = Math.min(minY, b.minY + offsetY);
    maxY = Math.max(maxY, b.maxY + offsetY);
  }

  // Fall back to a 1000 mm box at the insertion point when no members resolve.
  if (!isFinite(minX)) {
    const cx = instance.insertionXMm;
    const cy = instance.insertionYMm;
    minX = cx - 500;
    maxX = cx + 500;
    minY = cy - 500;
    maxY = cy + 500;
  }

  const pad = 150;
  minX -= pad;
  maxX += pad;
  minY -= pad;
  maxY += pad;

  const isSelected = instance.id === selectedId;
  const color = isSelected ? GROUP_SELECTED_COLOR : GROUP_DASH_COLOR;

  const corners = [
    new THREE.Vector3(ux(minX), PLAN_Y + 0.008, uz(minY)),
    new THREE.Vector3(ux(maxX), PLAN_Y + 0.008, uz(minY)),
    new THREE.Vector3(ux(maxX), PLAN_Y + 0.008, uz(maxY)),
    new THREE.Vector3(ux(minX), PLAN_Y + 0.008, uz(maxY)),
    new THREE.Vector3(ux(minX), PLAN_Y + 0.008, uz(minY)),
  ];

  const geo = new THREE.BufferGeometry().setFromPoints(corners);
  const mat = new THREE.LineDashedMaterial({
    color,
    dashSize: GROUP_DASH_SIZE,
    gapSize: GROUP_GAP_SIZE,
    depthTest: false,
  });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  line.renderOrder = 8;
  line.userData.bimPickId = instance.id;
  group.add(line);

  return group;
}
