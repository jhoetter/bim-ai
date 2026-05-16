import { beforeEach, describe, expect, it } from 'vitest';

import { useBimStore } from '../state/store';
import type { CameraPathElem } from '@bim-ai/core';

const makePath = (id: string, name = 'Test Path'): CameraPathElem => ({
  kind: 'camera_path',
  id,
  name,
  keyframes: [
    { positionMm: { x: 0, y: 0, z: 0 }, targetMm: { x: 1, y: 0, z: 0 }, fovDeg: 60, timeSec: 0 },
    {
      positionMm: { x: 10, y: 0, z: 0 },
      targetMm: { x: 11, y: 0, z: 0 },
      fovDeg: 60,
      timeSec: 5,
    },
  ],
});

beforeEach(() => {
  useBimStore.setState({ cameraPaths: [], selectedCameraPathId: null });
});

describe('selectedCameraPathId store field', () => {
  it('initialises as null', () => {
    expect(useBimStore.getState().selectedCameraPathId).toBeNull();
  });

  it('setSelectedCameraPathId sets the field', () => {
    useBimStore.getState().addCameraPath(makePath('cp-1'));
    useBimStore.getState().setSelectedCameraPathId('cp-1');
    expect(useBimStore.getState().selectedCameraPathId).toBe('cp-1');
  });

  it('setSelectedCameraPathId(null) clears the field', () => {
    useBimStore.getState().addCameraPath(makePath('cp-1'));
    useBimStore.getState().setSelectedCameraPathId('cp-1');
    useBimStore.getState().setSelectedCameraPathId(null);
    expect(useBimStore.getState().selectedCameraPathId).toBeNull();
  });
});

describe('renameCameraPath', () => {
  it('patches the name on the matching path', () => {
    useBimStore.getState().addCameraPath(makePath('cp-2', 'Old Name'));
    useBimStore.getState().renameCameraPath('cp-2', 'New Name');
    const found = useBimStore.getState().cameraPaths.find((p) => p.id === 'cp-2');
    expect(found?.name).toBe('New Name');
  });

  it('is a no-op for an unknown id', () => {
    useBimStore.getState().addCameraPath(makePath('cp-3', 'Keep'));
    useBimStore.getState().renameCameraPath('does-not-exist', 'Whatever');
    const found = useBimStore.getState().cameraPaths.find((p) => p.id === 'cp-3');
    expect(found?.name).toBe('Keep');
  });
});

describe('removeCameraPath', () => {
  it('removes the matching path', () => {
    useBimStore.getState().addCameraPath(makePath('cp-4'));
    useBimStore.getState().removeCameraPath('cp-4');
    expect(useBimStore.getState().cameraPaths.find((p) => p.id === 'cp-4')).toBeUndefined();
  });

  it('clears selectedCameraPathId when the selected path is removed', () => {
    useBimStore.getState().addCameraPath(makePath('cp-5'));
    useBimStore.getState().setSelectedCameraPathId('cp-5');
    useBimStore.getState().removeCameraPath('cp-5');
    expect(useBimStore.getState().selectedCameraPathId).toBeNull();
  });

  it('does not clear selectedCameraPathId when a different path is removed', () => {
    useBimStore.getState().addCameraPath(makePath('cp-6'));
    useBimStore.getState().addCameraPath(makePath('cp-7'));
    useBimStore.getState().setSelectedCameraPathId('cp-6');
    useBimStore.getState().removeCameraPath('cp-7');
    expect(useBimStore.getState().selectedCameraPathId).toBe('cp-6');
  });
});
