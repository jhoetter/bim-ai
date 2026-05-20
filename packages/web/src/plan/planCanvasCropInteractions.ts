import * as THREE from 'three';

import type { PlanTool } from '../state/store';
import {
  applyCropHandleDrag,
  cropDragCommands,
  pickCropHandle,
  pointInsideCrop,
  type CropBounds,
  type CropHandleId,
} from './cropRegionDragHandles';
import { applyCropGripDrag, getCropRegionGrips } from './cropRegionGrips';
import { rayToPlanMm } from './interaction/planCameraMath';

type MutableRef<T> = {
  current: T;
};

type PointerLike = {
  button?: number;
  clientX: number;
  clientY: number;
  shiftKey?: boolean;
};

type ActiveCropState = {
  planViewId: string;
  cropMinMm: { xMm: number; yMm: number };
  cropMaxMm: { xMm: number; yMm: number };
  cropEnabled: boolean;
  cropRegionVisible: boolean;
};

type CropDragState = {
  handle: CropHandleId;
  planViewId: string;
  startBounds: CropBounds;
  startPointerMm: { xMm: number; yMm: number };
  currentBounds: CropBounds;
};

type CropGripDragState = {
  gripId: string;
  startPlanPt: { xMm: number; yMm: number };
  cropAtStart: { minXMm: number; minYMm: number; maxXMm: number; maxYMm: number };
  planViewId: string;
};

export function handleCropPointerMove({
  renderer,
  camera,
  event,
  cropDragRef,
  cropGripDragRef,
  skipClickRef,
  onSemanticCommand,
  bumpGeom,
}: {
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  event: PointerLike;
  cropDragRef: MutableRef<CropDragState | undefined>;
  cropGripDragRef: MutableRef<CropGripDragState | null>;
  skipClickRef: MutableRef<boolean>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  bumpGeom: (updater: (value: number) => number) => void;
}): boolean {
  if (cropDragRef.current) {
    const ptr = rayToPlanMm(renderer, camera, event.clientX, event.clientY);
    if (ptr) {
      const dx = ptr.xMm - cropDragRef.current.startPointerMm.xMm;
      const dy = ptr.yMm - cropDragRef.current.startPointerMm.yMm;
      cropDragRef.current.currentBounds = applyCropHandleDrag(
        cropDragRef.current.handle,
        cropDragRef.current.startBounds,
        dx,
        dy,
      );
      bumpGeom((x) => x + 1);
      skipClickRef.current = true;
    }
    return true;
  }

  if (cropGripDragRef.current) {
    const ptr = rayToPlanMm(renderer, camera, event.clientX, event.clientY);
    if (ptr) {
      const deltaMm = {
        xMm: ptr.xMm - cropGripDragRef.current.startPlanPt.xMm,
        yMm: ptr.yMm - cropGripDragRef.current.startPlanPt.yMm,
      };
      const newCrop = applyCropGripDrag(
        cropGripDragRef.current.cropAtStart,
        cropGripDragRef.current.gripId,
        deltaMm,
      );
      void onSemanticCommand({
        type: 'updateCropRegion',
        planViewId: cropGripDragRef.current.planViewId,
        cropRegionMm: newCrop,
      });
      skipClickRef.current = true;
    }
    return true;
  }

  return false;
}

export function handleCropPointerDown({
  renderer,
  camera,
  group,
  event,
  activeCropState,
  spaceDownRef,
  planTool,
  cameraHalf,
  cropDragRef,
  cropGripDragRef,
  skipClickRef,
}: {
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  group: THREE.Group;
  event: PointerLike;
  activeCropState: ActiveCropState | null;
  spaceDownRef: MutableRef<boolean>;
  planTool: PlanTool;
  cameraHalf: number;
  cropDragRef: MutableRef<CropDragState | undefined>;
  cropGripDragRef: MutableRef<CropGripDragState | null>;
  skipClickRef: MutableRef<boolean>;
}): boolean {
  if (
    event.button !== 0 ||
    spaceDownRef.current ||
    !activeCropState ||
    (!activeCropState.cropRegionVisible && !activeCropState.cropEnabled)
  ) {
    return false;
  }

  const ptr = rayToPlanMm(renderer, camera, event.clientX, event.clientY);
  if (!ptr) return false;
  const pixH = renderer.domElement.clientHeight || 1;
  const handleToleranceMm = (14 / pixH) * 2 * cameraHalf * 1000;
  const handleId = pickCropHandle(
    activeCropState.cropMinMm,
    activeCropState.cropMaxMm,
    ptr.xMm,
    ptr.yMm,
    handleToleranceMm,
  );
  if (handleId) {
    cropDragRef.current = {
      handle: handleId,
      planViewId: activeCropState.planViewId,
      startBounds: {
        cropMinMm: activeCropState.cropMinMm,
        cropMaxMm: activeCropState.cropMaxMm,
      },
      startPointerMm: ptr,
      currentBounds: {
        cropMinMm: activeCropState.cropMinMm,
        cropMaxMm: activeCropState.cropMaxMm,
      },
    };
    skipClickRef.current = true;
    return true;
  }

  const cropMinMax = {
    minXMm: activeCropState.cropMinMm.xMm,
    minYMm: activeCropState.cropMinMm.yMm,
    maxXMm: activeCropState.cropMaxMm.xMm,
    maxYMm: activeCropState.cropMaxMm.yMm,
  };
  const hit = getCropRegionGrips(cropMinMax).find(
    (g) => Math.hypot(g.positionMm.xMm - ptr.xMm, g.positionMm.yMm - ptr.yMm) < handleToleranceMm,
  );
  if (hit) {
    cropGripDragRef.current = {
      gripId: hit.id,
      startPlanPt: ptr,
      cropAtStart: cropMinMax,
      planViewId: activeCropState.planViewId,
    };
    skipClickRef.current = true;
    return true;
  }

  if (
    planTool === 'select' &&
    pointInsideCrop(activeCropState.cropMinMm, activeCropState.cropMaxMm, ptr.xMm, ptr.yMm)
  ) {
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
    const hasElementHit = hits.some(
      (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
    );
    if (!hasElementHit && event.shiftKey) {
      cropDragRef.current = {
        handle: 'body',
        planViewId: activeCropState.planViewId,
        startBounds: {
          cropMinMm: activeCropState.cropMinMm,
          cropMaxMm: activeCropState.cropMaxMm,
        },
        startPointerMm: ptr,
        currentBounds: {
          cropMinMm: activeCropState.cropMinMm,
          cropMaxMm: activeCropState.cropMaxMm,
        },
      };
      skipClickRef.current = true;
      return true;
    }
  }

  return false;
}

export function handleCropPointerUp({
  cropDragRef,
  cropGripDragRef,
  onSemanticCommand,
  bumpGeom,
}: {
  cropDragRef: MutableRef<CropDragState | undefined>;
  cropGripDragRef: MutableRef<CropGripDragState | null>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  bumpGeom: (updater: (value: number) => number) => void;
}): boolean {
  if (cropDragRef.current) {
    const drag = cropDragRef.current;
    cropDragRef.current = undefined;
    const sameMin =
      drag.currentBounds.cropMinMm.xMm === drag.startBounds.cropMinMm.xMm &&
      drag.currentBounds.cropMinMm.yMm === drag.startBounds.cropMinMm.yMm;
    const sameMax =
      drag.currentBounds.cropMaxMm.xMm === drag.startBounds.cropMaxMm.xMm &&
      drag.currentBounds.cropMaxMm.yMm === drag.startBounds.cropMaxMm.yMm;
    if (!(sameMin && sameMax)) {
      for (const cmd of cropDragCommands(drag.planViewId, drag.currentBounds)) {
        onSemanticCommand(cmd);
      }
    }
    bumpGeom((x) => x + 1);
    return true;
  }

  if (cropGripDragRef.current) {
    cropGripDragRef.current = null;
    return true;
  }

  return false;
}
