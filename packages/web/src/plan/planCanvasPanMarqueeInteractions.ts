import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { useBimStore, type PlanTool } from '../state/store';
import { elementInSelectionBoxMm } from './boxSelection';
import { rayToPlanMm } from './interaction/planCameraMath';
import { classifyPointerStart } from './planCanvasState';

type MutableRef<T> = {
  current: T;
};

type PointerLike = {
  button: number;
  clientX: number;
  clientY: number;
  shiftKey: boolean;
  altKey: boolean;
};

type CameraState = {
  camX: number;
  camZ: number;
  half: number;
};

type DragState = {
  dragging: boolean;
  lastXmm: number;
  lastZmm: number;
  camX: number;
  camZ: number;
};

type MarqueeState = {
  active: boolean;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  direction: 'left-to-right' | 'right-to-left' | null;
};

const EMPTY_MARQUEE: MarqueeState = {
  active: false,
  sx: 0,
  sy: 0,
  ex: 0,
  ey: 0,
  direction: null,
};

function startPan({
  renderer,
  camera,
  event,
  dragRef,
  camRef,
}: {
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  event: PointerLike;
  dragRef: MutableRef<DragState>;
  camRef: MutableRef<CameraState>;
}) {
  const rr = rayToPlanMm(renderer, camera, event.clientX, event.clientY);
  if (!rr) return;
  dragRef.current = {
    dragging: true,
    lastXmm: rr.xMm,
    lastZmm: rr.yMm,
    camX: camRef.current.camX,
    camZ: camRef.current.camZ,
  };
}

export function handlePanMarqueePointerMove({
  renderer,
  camera,
  event,
  dragRef,
  camRef,
  marqueeRef,
  redrawMarqueeRect,
  resizeCam,
  skipClickRef,
}: {
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  event: PointerLike;
  dragRef: MutableRef<DragState>;
  camRef: MutableRef<CameraState>;
  marqueeRef: MutableRef<MarqueeState>;
  redrawMarqueeRect: (
    x0Mm: number,
    y0Mm: number,
    x1Mm: number,
    y1Mm: number,
    crossing: boolean,
  ) => void;
  resizeCam: () => void;
  skipClickRef: MutableRef<boolean>;
}): boolean {
  if (dragRef.current.dragging) {
    const rr = rayToPlanMm(renderer, camera, event.clientX, event.clientY);
    if (!rr) return true;
    camRef.current.camX = dragRef.current.camX - (rr.xMm - dragRef.current.lastXmm) / 1000;
    camRef.current.camZ = dragRef.current.camZ - (rr.yMm - dragRef.current.lastZmm) / 1000;
    resizeCam();
    skipClickRef.current = true;
    return true;
  }

  if (marqueeRef.current.active) {
    const rr = rayToPlanMm(renderer, camera, event.clientX, event.clientY);
    if (rr) {
      const dir = rr.xMm > marqueeRef.current.sx ? 'left-to-right' : 'right-to-left';
      marqueeRef.current.direction = dir;
      marqueeRef.current.ex = rr.xMm;
      marqueeRef.current.ey = rr.yMm;
      redrawMarqueeRect(
        marqueeRef.current.sx,
        marqueeRef.current.sy,
        rr.xMm,
        rr.yMm,
        dir === 'right-to-left',
      );
      skipClickRef.current = true;
    }
    return true;
  }

  return false;
}

export function handlePanMarqueePointerDown({
  renderer,
  camera,
  group,
  event,
  planTool,
  spaceDownRef,
  dragRef,
  camRef,
  marqueeRef,
  skipClickRef,
}: {
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  group: THREE.Group;
  event: PointerLike;
  planTool: PlanTool;
  spaceDownRef: MutableRef<boolean>;
  dragRef: MutableRef<DragState>;
  camRef: MutableRef<CameraState>;
  marqueeRef: MutableRef<MarqueeState>;
  skipClickRef: MutableRef<boolean>;
}) {
  const intent = classifyPointerStart({
    button: event.button,
    spacePressed: spaceDownRef.current,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    activeTool: planTool === 'select' ? 'select' : planTool ? 'wall' : undefined,
    dragDirection: null,
  });

  if (intent === 'pan' || event.button === 2) {
    startPan({ renderer, camera, event, dragRef, camRef });
  } else if (intent === 'drag-move' && planTool === 'select') {
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
    const hasHit = hits.some(
      (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
    );
    if (hasHit) {
      startPan({ renderer, camera, event, dragRef, camRef });
    } else {
      const rr = rayToPlanMm(renderer, camera, event.clientX, event.clientY);
      if (rr) {
        marqueeRef.current = {
          active: true,
          sx: rr.xMm,
          sy: rr.yMm,
          ex: rr.xMm,
          ey: rr.yMm,
          direction: null,
        };
      }
    }
  }

  skipClickRef.current = false;
}

export function handleMarqueePointerUp({
  marqueeRef,
  clearMarqueeLine,
  elementsById,
  displayLevelId,
  selectLinkedEnabled,
  selectElement,
}: {
  marqueeRef: MutableRef<MarqueeState>;
  clearMarqueeLine: () => void;
  elementsById: Record<string, Element>;
  displayLevelId: string | undefined;
  selectLinkedEnabled: boolean;
  selectElement: (id: string) => void;
}): boolean {
  if (marqueeRef.current.active && marqueeRef.current.direction) {
    const { sx, sy, ex, ey, direction } = marqueeRef.current;
    clearMarqueeLine();
    marqueeRef.current = { ...EMPTY_MARQUEE };

    const boxMin = { xMm: Math.min(sx, ex), yMm: Math.min(sy, ey) };
    const boxMax = { xMm: Math.max(sx, ex), yMm: Math.max(sy, ey) };
    const selMode = direction === 'left-to-right' ? 'window' : 'crossing';

    const ids: string[] = [];
    for (const el of Object.values(elementsById)) {
      if (displayLevelId && (el as { levelId?: string }).levelId !== displayLevelId) continue;
      if (!selectLinkedEnabled && el.kind === 'link_model') continue;
      if (elementInSelectionBoxMm(el, boxMin, boxMax, selMode)) ids.push(el.id);
    }
    if (ids.length >= 1) {
      selectElement(ids[0]!);
      for (const id of ids.slice(1)) {
        useBimStore.getState().toggleSelectedId(id);
      }
    }
    return true;
  }

  clearMarqueeLine();
  marqueeRef.current = { ...EMPTY_MARQUEE };
  return false;
}
