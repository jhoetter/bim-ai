import type { Element } from '@bim-ai/core';
import * as THREE from 'three';

import { useBimStore } from '../state/store';
import { classifyPointerStart } from './planCanvasState';

type PointerClickEvent = {
  button: number;
  clientX: number;
  clientY: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
};

export function handleSelectClick({
  renderer,
  camera,
  group,
  event,
  elementsById,
  selectLinkedEnabled,
  selectElement,
  onSemanticCommand,
}: {
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  group: THREE.Group;
  event: PointerClickEvent;
  elementsById: Record<string, Element>;
  selectLinkedEnabled: boolean;
  selectElement: (id: string | undefined) => void;
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
  const eqHit = hits.find((x) => (x.object.userData as { eqToggle?: boolean }).eqToggle === true);
  if (eqHit) {
    const dimId = (eqHit.object.userData as { bimPickId?: string }).bimPickId;
    if (dimId) {
      void onSemanticCommand({ type: 'toggle_dim_eq', dimensionId: dimId });
      return;
    }
  }

  const h = hits.find(
    (x) => typeof (x.object.userData as { bimPickId?: unknown }).bimPickId === 'string',
  );
  const rawPickId =
    typeof (h?.object.userData as { bimPickId?: unknown }).bimPickId === 'string'
      ? (h!.object.userData as { bimPickId: string }).bimPickId
      : undefined;
  const id =
    rawPickId && !selectLinkedEnabled && elementsById[rawPickId]?.kind === 'link_model'
      ? undefined
      : rawPickId;
  const clickIntent = classifyPointerStart({
    button: event.button,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    activeTool: 'select',
    dragDirection: null,
  });
  if ((clickIntent === 'add-to-selection' || clickIntent === 'toggle-selection') && id) {
    useBimStore.getState().toggleSelectedId(id);
  } else if (clickIntent === 'add-to-selection' || clickIntent === 'toggle-selection') {
    return;
  } else {
    selectElement(id);
  }
}
