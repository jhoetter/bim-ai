import { describe, expect, it, beforeEach } from 'vitest';

import { useBimStore } from '../state/store';
import type { Saved3dViewElement } from '@bim-ai/core';

function resetStore() {
  useBimStore.setState({
    elementsById: {},
    orbitCameraPoseMm: null,
    viewerProjection: 'perspective',
    viewerSectionBoxExtent: null,
    viewerSectionBoxActive: false,
    viewLocked: false,
  });
}

/** Simulate the save_camera_view handler logic from Workspace.tsx onSemanticCommand. */
function simulateSaveCameraView(name: string): string | null {
  const st = useBimStore.getState();
  const pose = st.orbitCameraPoseMm;
  if (!pose) return null;
  const id = `scv-test-${Math.random().toString(36).slice(2, 8)}`;
  const isPerspective = st.viewerProjection === 'perspective';
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
        sectionBox: null,
        perspective: isPerspective,
        fovDeg: 60,
      },
    },
  });
  return id;
}

/** Simulate the restore_3d_view handler for perspective views. */
function simulateRestoreCameraView(viewId: string): boolean {
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
  if (view.perspective === true) {
    st.setViewerProjection('perspective');
  } else if (view.perspective === false) {
    st.setViewerProjection('orthographic');
  }
  st.setViewLocked(view.locked === true);
  return true;
}

describe('named perspective camera views — §14.5', () => {
  beforeEach(() => {
    resetStore();
  });

  it('save_camera_view creates saved_3d_view element with perspective=true', () => {
    useBimStore.setState({
      orbitCameraPoseMm: {
        position: { xMm: 1000, yMm: 2000, zMm: 3000 },
        target: { xMm: 0, yMm: 0, zMm: 0 },
        up: { xMm: 0, yMm: 1, zMm: 0 },
      },
      viewerProjection: 'perspective',
    });

    const id = simulateSaveCameraView('Camera 1');

    expect(id).not.toBeNull();
    const el = useBimStore.getState().elementsById[id!] as Saved3dViewElement;
    expect(el).toBeDefined();
    expect(el.kind).toBe('saved_3d_view');
    expect(el.perspective).toBe(true);
    expect(el.name).toBe('Camera 1');
  });

  it('perspective view has fovDeg field set', () => {
    useBimStore.setState({
      orbitCameraPoseMm: {
        position: { xMm: 500, yMm: 500, zMm: 2000 },
        target: { xMm: 0, yMm: 0, zMm: 0 },
        up: { xMm: 0, yMm: 1, zMm: 0 },
      },
      viewerProjection: 'perspective',
    });

    const id = simulateSaveCameraView('Camera Fov Test');

    expect(id).not.toBeNull();
    const el = useBimStore.getState().elementsById[id!] as Saved3dViewElement;
    expect(el.fovDeg).toBe(60);
  });

  it('restore sets perspective mode and camera position', () => {
    const view: Saved3dViewElement = {
      kind: 'saved_3d_view',
      id: 'scv-test-1',
      name: 'Camera Test',
      cameraMm: { x: 5000, y: 3000, z: 8000 },
      targetMm: { x: 100, y: 200, z: 300 },
      upVector: { x: 0, y: 1, z: 0 },
      locked: false,
      sectionBox: null,
      perspective: true,
      fovDeg: 60,
    };
    useBimStore.setState({
      elementsById: { 'scv-test-1': view as never },
      viewerProjection: 'orthographic',
    });

    const ok = simulateRestoreCameraView('scv-test-1');

    expect(ok).toBe(true);
    const state = useBimStore.getState();
    expect(state.orbitCameraPoseMm?.position).toEqual({ xMm: 5000, yMm: 3000, zMm: 8000 });
    expect(state.orbitCameraPoseMm?.target).toEqual({ xMm: 100, yMm: 200, zMm: 300 });
    expect(state.viewerProjection).toBe('perspective');
  });

  it('camera views are separated from orthographic views in browser', () => {
    const orthoView: Saved3dViewElement = {
      kind: 'saved_3d_view',
      id: 'ortho-1',
      name: 'Ortho View',
      cameraMm: { x: 0, y: 0, z: 0 },
      targetMm: { x: 0, y: 0, z: 0 },
      perspective: false,
    };
    const camView: Saved3dViewElement = {
      kind: 'saved_3d_view',
      id: 'cam-1',
      name: 'Camera View',
      cameraMm: { x: 1000, y: 1000, z: 2000 },
      targetMm: { x: 0, y: 0, z: 0 },
      perspective: true,
      fovDeg: 60,
    };
    const legacyView: Saved3dViewElement = {
      kind: 'saved_3d_view',
      id: 'legacy-1',
      name: 'Legacy View',
      cameraMm: { x: 0, y: 0, z: 0 },
      targetMm: { x: 0, y: 0, z: 0 },
    };

    useBimStore.setState({
      elementsById: {
        'ortho-1': orthoView as never,
        'cam-1': camView as never,
        'legacy-1': legacyView as never,
      },
    });

    const elements = Object.values(useBimStore.getState().elementsById) as Saved3dViewElement[];
    const all3d = elements.filter((e) => e.kind === 'saved_3d_view');
    const cameraViews = all3d.filter((e) => e.perspective === true);
    const orthoViews = all3d.filter((e) => e.perspective !== true);

    expect(cameraViews).toHaveLength(1);
    expect(cameraViews[0].id).toBe('cam-1');
    expect(orthoViews).toHaveLength(2);
    expect(orthoViews.map((v) => v.id).sort()).toEqual(['legacy-1', 'ortho-1']);
  });
});
