import { afterEach, describe, expect, it } from 'vitest';

import { useBimStore } from '../state/store';
import { VIEWER_CATEGORY_KEYS } from '../viewport/sceneUtils';
import './defaultCommands';
import { getRegistry, queryPalette, type PaletteContext } from './registry';

const PLAN_CTX: PaletteContext = { selectedElementIds: [], activeViewId: null, activeMode: 'plan' };
const THREE_D_CTX: PaletteContext = {
  selectedElementIds: [],
  activeViewId: null,
  activeMode: '3d',
};

afterEach(() => {
  useBimStore.setState({
    viewerCameraAction: null,
    viewerProjection: 'perspective',
    viewerSectionBoxActive: false,
    viewerWalkModeActive: false,
    viewerCategoryHidden: { site_origin: true },
  });
});

function command(id: string) {
  const entry = getRegistry().find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Missing command ${id}`);
  return entry;
}

describe('default Cmd+K commands', () => {
  it('scopes 3D view commands to active 3D contexts', () => {
    const planEntry = queryPalette('fit model', PLAN_CTX, {}).find(
      (entry) => entry.id === 'view.3d.fit',
    );
    expect(planEntry?.disabledReason).toContain('unavailable');
    expect(
      queryPalette('fit model', THREE_D_CTX, {}).some((entry) => entry.id === 'view.3d.fit'),
    ).toBe(true);
  });

  it('dispatches 3D camera and projection commands through the viewer runtime store', () => {
    command('view.3d.fit').invoke(THREE_D_CTX);
    expect(useBimStore.getState().viewerCameraAction?.kind).toBe('fit');

    command('view.3d.reset-camera').invoke(THREE_D_CTX);
    expect(useBimStore.getState().viewerCameraAction?.kind).toBe('reset');

    command('view.3d.projection.orthographic').invoke(THREE_D_CTX);
    expect(useBimStore.getState().viewerProjection).toBe('orthographic');
  });

  it('can hide and show every registered 3D visibility category', () => {
    command('visibility.3d.hide-all-categories').invoke(THREE_D_CTX);
    for (const key of VIEWER_CATEGORY_KEYS) {
      expect(useBimStore.getState().viewerCategoryHidden[key]).toBe(true);
    }

    command('visibility.3d.show-all-categories').invoke(THREE_D_CTX);
    for (const key of VIEWER_CATEGORY_KEYS) {
      expect(useBimStore.getState().viewerCategoryHidden[key]).toBe(false);
    }
  });

  it('toggles 3D walk mode and section box from Cmd+K commands', () => {
    command('view.3d.walk.toggle').invoke(THREE_D_CTX);
    command('view.3d.section-box.toggle').invoke(THREE_D_CTX);
    expect(useBimStore.getState().viewerWalkModeActive).toBe(true);
    expect(useBimStore.getState().viewerSectionBoxActive).toBe(true);
  });
});
