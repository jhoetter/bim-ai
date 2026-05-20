import type { Element } from '@bim-ai/core';
import * as THREE from 'three';

import type { CategoryOverride } from '../state/storeTypes';
import {
  dxfViewOverrideKey,
  queryDxfPrimitiveAtPoint,
  selectDxfUnderlaysForLevel,
  type DxfPrimitiveQueryHit,
} from './dxfUnderlay';
import { placeTagByCategoryCommand } from './manualTags';
import { nearestWallAt } from './selection/nearestWall';

type MmPoint = {
  xMm: number;
  yMm: number;
};

export function handleQueryToolClick({
  renderer,
  cameraHalf,
  event,
  pointMm,
  elementsById,
  activeLevelResolvedId,
  displayLevelId,
  activePlanViewId,
  setDxfQueryHover,
  setDxfQueryDialog,
}: {
  renderer: THREE.WebGLRenderer;
  cameraHalf: number;
  event: { clientX: number; clientY: number };
  pointMm: MmPoint;
  elementsById: Record<string, Element>;
  activeLevelResolvedId: string;
  displayLevelId: string | null | undefined;
  activePlanViewId: string | null | undefined;
  setDxfQueryHover: (hit: DxfPrimitiveQueryHit | null) => void;
  setDxfQueryDialog: (
    dialog: { hit: DxfPrimitiveQueryHit; position: { x: number; y: number } } | null,
  ) => void;
}): void {
  const dxfLevelId = displayLevelId || activeLevelResolvedId;
  const dxfUnderlays = selectDxfUnderlaysForLevel(elementsById, dxfLevelId || undefined);
  const activePlanView = activePlanViewId ? elementsById[activePlanViewId] : undefined;
  const viewOverrides =
    activePlanView?.kind === 'plan_view'
      ? ((activePlanView.categoryOverrides ?? {}) as Record<string, CategoryOverride>)
      : {};
  const rect = renderer.domElement.getBoundingClientRect();
  const toleranceMm = (12 / Math.max(1, rect.height)) * 2 * cameraHalf * 1000;
  const hit = queryDxfPrimitiveAtPoint(dxfUnderlays, pointMm, {
    toleranceMm,
    elementsById,
    viewOverridesByLinkId: Object.fromEntries(
      dxfUnderlays.map((link) => [link.id, viewOverrides[dxfViewOverrideKey(link.id)]]),
    ),
  });
  setDxfQueryHover(hit);
  setDxfQueryDialog(hit ? { hit, position: { x: event.clientX, y: event.clientY } } : null);
}

export function handleTagToolClick({
  renderer,
  camera,
  group,
  event,
  pointMm,
  elementsById,
  activePlanViewId,
  onSemanticCommand,
}: {
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  group: THREE.Group;
  event: { clientX: number; clientY: number };
  pointMm: MmPoint;
  elementsById: Record<string, Element>;
  activePlanViewId: string | null | undefined;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
}): void {
  const rectBox = renderer.domElement.getBoundingClientRect();
  const ray = new THREE.Raycaster();
  ray.setFromCamera(
    new THREE.Vector2(
      ((event.clientX - rectBox.left) / rectBox.width) * 2 - 1,
      -(((event.clientY - rectBox.top) / rectBox.height) * 2 - 1),
    ),
    camera,
  );
  const hits = ray.intersectObjects(group.children, true);
  const h = hits.find(
    (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
  );
  const id =
    typeof (h?.object.userData as { bimPickId?: unknown }).bimPickId === 'string'
      ? (h!.object.userData as { bimPickId: string }).bimPickId
      : undefined;
  const cmd = placeTagByCategoryCommand(elementsById, activePlanViewId, id, pointMm);
  if (cmd) {
    void onSemanticCommand(cmd);
  }
}

export function handleDoorWindowToolClick({
  tool,
  pointMm,
  elementsById,
  displayLevelId,
  activeComponentFamilyTypeId,
  onSemanticCommand,
}: {
  tool: 'door' | 'window';
  pointMm: MmPoint;
  elementsById: Record<string, Element>;
  displayLevelId: string | null | undefined;
  activeComponentFamilyTypeId: string | null | undefined;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
}): void {
  const n = nearestWallAt(elementsById, displayLevelId || undefined, pointMm.xMm, pointMm.yMm);
  if (!n || n.distMm > 900) return;
  if (tool === 'door') {
    void onSemanticCommand({
      type: 'insertDoorOnWall',
      wallId: n.wall.id,
      alongT: n.alongT,
      widthMm: 900,
      ...(activeComponentFamilyTypeId ? { familyTypeId: activeComponentFamilyTypeId } : {}),
    });
    return;
  }
  void onSemanticCommand({
    type: 'insertWindowOnWall',
    wallId: n.wall.id,
    alongT: n.alongT,
    widthMm: 1200,
    sillHeightMm: 900,
    heightMm: 1500,
    ...(activeComponentFamilyTypeId ? { familyTypeId: activeComponentFamilyTypeId } : {}),
  });
}
