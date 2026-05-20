import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import type { PlanTool } from '../state/store';
import type { SplitWallState } from '../tools/toolGrammar';
import { reduceSplitWall } from '../tools/toolGrammar';
import { buildComponentGhost } from './componentGhost';
import { rayToPlanMm } from './interaction/planCameraMath';
import { nearestWallAt } from './selection/nearestWall';

type MutableRef<T> = {
  current: T;
};

type PointerLike = {
  clientX: number;
  clientY: number;
};

export function updateSplitWallHover({
  planTool,
  elementsById,
  displayLevelId,
  cursorMm,
  splitWallStateRef,
  bumpGeom,
}: {
  planTool: PlanTool;
  elementsById: Record<string, Element>;
  displayLevelId: string | undefined;
  cursorMm: { xMm: number; yMm: number };
  splitWallStateRef: MutableRef<SplitWallState>;
  bumpGeom: (updater: (value: number) => number) => void;
}) {
  if (planTool !== 'split-wall') return;

  const nearest = nearestWallAt(
    elementsById,
    displayLevelId || undefined,
    cursorMm.xMm,
    cursorMm.yMm,
  );
  if (nearest && nearest.distMm < 900 && nearest.alongT > 0.001 && nearest.alongT < 0.999) {
    const hoverPt = {
      xMm:
        nearest.wall.start.xMm + (nearest.wall.end.xMm - nearest.wall.start.xMm) * nearest.alongT,
      yMm:
        nearest.wall.start.yMm + (nearest.wall.end.yMm - nearest.wall.start.yMm) * nearest.alongT,
    };
    const { state } = reduceSplitWall(splitWallStateRef.current, {
      kind: 'hoverWall',
      wallId: nearest.wall.id,
      pointMm: hoverPt,
    });
    splitWallStateRef.current = state;
  } else {
    const { state } = reduceSplitWall(splitWallStateRef.current, { kind: 'hoverClear' });
    splitWallStateRef.current = state;
  }
  bumpGeom((x) => x + 1);
}

export function updateComponentGhostHover({
  planTool,
  renderer,
  camera,
  group,
  event,
  componentGhostRef,
  elementsById,
  activeLevelResolvedId,
  activeComponentAssetId,
  activeComponentFamilyTypeId,
  activeComponentAssetPreviewEntry,
  pendingComponentRotationDeg,
}: {
  planTool: PlanTool;
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  group: THREE.Group;
  event: PointerLike;
  componentGhostRef: MutableRef<THREE.Group | null>;
  elementsById: Record<string, Element>;
  activeLevelResolvedId: string;
  activeComponentAssetId: string | null;
  activeComponentFamilyTypeId: string | null;
  activeComponentAssetPreviewEntry: Extract<Element, { kind: 'asset_library_entry' }> | null;
  pendingComponentRotationDeg: number;
}) {
  if (planTool !== 'component') {
    if (componentGhostRef.current) {
      group.remove(componentGhostRef.current);
      componentGhostRef.current = null;
    }
    return;
  }

  const entry = activeComponentAssetId
    ? (Object.values(elementsById).find(
        (el): el is Extract<Element, { kind: 'asset_library_entry' }> =>
          el.kind === 'asset_library_entry' && el.id === activeComponentAssetId,
      ) ??
      (activeComponentAssetPreviewEntry?.id === activeComponentAssetId
        ? activeComponentAssetPreviewEntry
        : undefined))
    : undefined;
  const familyType = activeComponentFamilyTypeId
    ? elementsById[activeComponentFamilyTypeId]
    : undefined;
  const familyParams =
    familyType?.kind === 'family_type'
      ? (familyType.parameters as Record<string, unknown>)
      : undefined;
  const widthMm =
    entry?.thumbnailWidthMm ??
    Number(familyParams?.widthMm ?? familyParams?.Width ?? familyParams?.lengthMm ?? 1000);
  const heightMm =
    entry?.thumbnailHeightMm ??
    Number(familyParams?.depthMm ?? familyParams?.Depth ?? familyParams?.heightMm ?? 600);
  const pointerMm = rayToPlanMm(renderer, camera, event.clientX, event.clientY);
  if (!pointerMm) return;

  if (componentGhostRef.current) {
    group.remove(componentGhostRef.current);
    componentGhostRef.current = null;
  }
  const ghost = buildComponentGhost({
    activeLevelId: activeLevelResolvedId,
    entry,
    widthMm,
    heightMm,
    rotDeg: pendingComponentRotationDeg,
  });
  ghost.position.set(pointerMm.xMm / 1000, ghost.position.y, pointerMm.yMm / 1000);
  group.add(ghost);
  componentGhostRef.current = ghost;
}

export function updateColumnAtGridsHover({
  planTool,
  renderer,
  camera,
  group,
  event,
  elementsById,
  columnAtGridsHoverRef,
  bumpGeom,
}: {
  planTool: PlanTool;
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  group: THREE.Group;
  event: PointerLike;
  elementsById: Record<string, Element>;
  columnAtGridsHoverRef: MutableRef<string | null>;
  bumpGeom: (updater: (value: number) => number) => void;
}) {
  if (planTool !== 'column-at-grids') {
    columnAtGridsHoverRef.current = null;
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  const ray = new THREE.Raycaster();
  ray.setFromCamera(
    new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    ),
    camera,
  );
  const hits = ray.intersectObjects(group.children, true);
  const hit = hits.find(
    (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
  );
  const hoverId = hit ? ((hit.object.userData as { bimPickId: string }).bimPickId ?? null) : null;
  const el = hoverId ? elementsById[hoverId] : null;
  const nextHoverId = el?.kind === 'grid_line' ? hoverId : null;
  if (nextHoverId !== columnAtGridsHoverRef.current) {
    columnAtGridsHoverRef.current = nextHoverId;
    bumpGeom((x) => x + 1);
  }
}
