import { describe, expect, it, beforeEach } from 'vitest';

import { useBimStore } from '../state/store';
import type { Saved3dViewElement } from '@bim-ai/core';

function resetStore() {
  useBimStore.setState({
    elementsById: {},
    orbitCameraPoseMm: null,
    viewerSectionBoxExtent: null,
    viewerSectionBoxActive: false,
    viewLocked: false,
  });
}

/** Simulate the save_3d_view handler logic from Workspace.tsx onSemanticCommand. */
function simulateSave3dView(name: string): string | null {
  const st = useBimStore.getState();
  const pose = st.orbitCameraPoseMm;
  if (!pose) return null;
  const id = `s3v-test-${Math.random().toString(36).slice(2, 8)}`;
  const sectionBox = st.viewerSectionBoxExtent ?? undefined;
  useBimStore.setState({
    elementsById: {
      ...st.elementsById,
      [id]: {
        kind: 'saved_3d_view',
        id,
        name,
        cameraMm: { x: pose.position.xMm, y: pose.position.yMm, z: pose.position.zMm },
        targetMm: { x: pose.target.xMm, y: pose.target.yMm, z: pose.target.zMm },
        upVector: pose.up ? { x: pose.up.xMm, y: pose.up.yMm, z: pose.up.zMm } : null,
        locked: false,
        sectionBox: sectionBox ?? null,
      },
    },
  });
  return id;
}

/** Simulate the restore_3d_view handler logic. */
function simulateRestore3dView(viewId: string): boolean {
  const st = useBimStore.getState();
  const el = st.elementsById[viewId];
  if (!el || el.kind !== 'saved_3d_view') return false;
  const view = el as Saved3dViewElement;
  st.setOrbitCameraFromViewpointMm({
    position: { xMm: view.cameraMm.x, yMm: view.cameraMm.y, zMm: view.cameraMm.z },
    target: { xMm: view.targetMm.x, yMm: view.targetMm.y, zMm: view.targetMm.z },
    up: view.upVector
      ? { xMm: view.upVector.x, yMm: view.upVector.y, zMm: view.upVector.z }
      : { xMm: 0, yMm: 1, zMm: 0 },
  });
  if (view.sectionBox) {
    st.setViewerSectionBoxExtent(view.sectionBox);
    st.setViewerSectionBoxActive(true);
  }
  st.setViewLocked(view.locked === true);
  return true;
}

/** Simulate the delete_3d_view handler logic. */
function simulateDelete3dView(viewId: string): void {
  const st = useBimStore.getState();
  const { [viewId]: _removed, ...remaining } = st.elementsById;
  useBimStore.setState({ elementsById: remaining });
}

describe('saved 3D views — §6.1.3', () => {
  beforeEach(() => {
    resetStore();
  });

  it('save_3d_view adds a saved_3d_view element to elementsById', () => {
    useBimStore.setState({
      orbitCameraPoseMm: {
        position: { xMm: 1000, yMm: 2000, zMm: 3000 },
        target: { xMm: 0, yMm: 0, zMm: 0 },
        up: { xMm: 0, yMm: 1, zMm: 0 },
      },
    });

    const id = simulateSave3dView('My 3D View');

    expect(id).not.toBeNull();
    const elements = useBimStore.getState().elementsById;
    expect(id).not.toBeNull();
    const el = elements[id!];
    expect(el).toBeDefined();
    expect(el!.kind).toBe('saved_3d_view');
    const view = el as Saved3dViewElement;
    expect(view.name).toBe('My 3D View');
    expect(view.cameraMm).toEqual({ x: 1000, y: 2000, z: 3000 });
    expect(view.targetMm).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('restore_3d_view dispatches camera teleport', () => {
    const view: Saved3dViewElement = {
      kind: 'saved_3d_view',
      id: 'sv-test-1',
      name: 'Test View',
      cameraMm: { x: 5000, y: 3000, z: 8000 },
      targetMm: { x: 100, y: 200, z: 300 },
      upVector: { x: 0, y: 1, z: 0 },
      locked: false,
      sectionBox: null,
    };
    useBimStore.setState({ elementsById: { 'sv-test-1': view as never } });

    const ok = simulateRestore3dView('sv-test-1');

    expect(ok).toBe(true);
    const state = useBimStore.getState();
    expect(state.orbitCameraNonce).toBeGreaterThan(0);
    expect(state.orbitCameraPoseMm?.position).toEqual({ xMm: 5000, yMm: 3000, zMm: 8000 });
    expect(state.orbitCameraPoseMm?.target).toEqual({ xMm: 100, yMm: 200, zMm: 300 });
  });

  it('delete_3d_view removes the element', () => {
    const view: Saved3dViewElement = {
      kind: 'saved_3d_view',
      id: 'sv-del-1',
      name: 'To Delete',
      cameraMm: { x: 0, y: 0, z: 0 },
      targetMm: { x: 0, y: 0, z: 0 },
    };
    useBimStore.setState({ elementsById: { 'sv-del-1': view as never } });
    expect(useBimStore.getState().elementsById['sv-del-1']).toBeDefined();

    simulateDelete3dView('sv-del-1');

    expect(useBimStore.getState().elementsById['sv-del-1']).toBeUndefined();
  });

  it('save includes sectionBox when viewerSectionBoxExtent is set', () => {
    useBimStore.setState({
      orbitCameraPoseMm: {
        position: { xMm: 0, yMm: 0, zMm: 0 },
        target: { xMm: 0, yMm: 0, zMm: 0 },
        up: { xMm: 0, yMm: 1, zMm: 0 },
      },
      viewerSectionBoxExtent: {
        minX: -5,
        maxX: 5,
        minY: -1,
        maxY: 10,
        minZ: -5,
        maxZ: 5,
      },
    });

    const id = simulateSave3dView('Section View');

    expect(id).not.toBeNull();
    const el = useBimStore.getState().elementsById[id!] as Saved3dViewElement;
    expect(el.sectionBox).toEqual({
      minX: -5,
      maxX: 5,
      minY: -1,
      maxY: 10,
      minZ: -5,
      maxZ: 5,
    });
  });
});
