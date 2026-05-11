import { afterEach, describe, expect, it, vi } from 'vitest';

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
const SELECTED_WALL_CTX: PaletteContext = {
  selectedElementIds: ['wall-1'],
  activeViewId: null,
  activeMode: '3d',
};

afterEach(() => {
  useBimStore.setState({
    elementsById: {},
    selectedId: undefined,
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

  it('surfaces selected-wall 3D edit commands and dispatches through palette context', () => {
    const dispatchCommand = vi.fn();
    useBimStore.setState({
      elementsById: {
        'wall-1': {
          kind: 'wall',
          id: 'wall-1',
          name: 'Wall 1',
          wallTypeId: 'wt-1',
          levelId: 'lvl-1',
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 6000, yMm: 0 },
          thicknessMm: 200,
          heightMm: 3000,
        },
      },
    });

    const withoutWall = queryPalette('selected wall door', THREE_D_CTX, {}).find(
      (entry) => entry.id === 'view.3d.wall.insert-door',
    );
    expect(withoutWall?.disabledReason).toContain('Requires');

    const withWall = queryPalette('selected wall door', SELECTED_WALL_CTX, {}).find(
      (entry) => entry.id === 'view.3d.wall.insert-door',
    );
    expect(withWall?.disabledReason).toBeUndefined();
    withWall?.invoke({ ...SELECTED_WALL_CTX, dispatchCommand });
    expect(dispatchCommand).toHaveBeenCalledWith({
      type: 'insertDoorOnWall',
      wallId: 'wall-1',
      alongT: 0.5,
      widthMm: 900,
    });
  });

  it('routes language commands through the palette host context', () => {
    const setLanguage = vi.fn();
    command('settings.language.de').invoke({ ...PLAN_CTX, setLanguage });
    expect(setLanguage).toHaveBeenCalledWith('de');

    command('settings.language.en').invoke({ ...PLAN_CTX, setLanguage });
    expect(setLanguage).toHaveBeenCalledWith('en');
  });

  it('routes shell rail toggles through the palette host context', () => {
    const toggleLeftRail = vi.fn();
    const toggleRightRail = vi.fn();

    command('shell.toggle-left-rail').invoke({ ...PLAN_CTX, toggleLeftRail });
    expect(toggleLeftRail).toHaveBeenCalledOnce();

    command('shell.toggle-right-rail').invoke({ ...PLAN_CTX, toggleRightRail });
    expect(toggleRightRail).toHaveBeenCalledOnce();
  });

  it('routes active visibility commands through the palette host context', () => {
    const openActiveVisibilityControls = vi.fn();
    const openPlanVisibilityGraphics = vi.fn();
    const open3dViewControls = vi.fn();

    command('visibility.active-controls').invoke({ ...PLAN_CTX, openActiveVisibilityControls });
    expect(openActiveVisibilityControls).toHaveBeenCalledOnce();

    command('visibility.plan.graphics').invoke({ ...PLAN_CTX, openPlanVisibilityGraphics });
    expect(openPlanVisibilityGraphics).toHaveBeenCalledOnce();

    command('visibility.3d.layers').invoke({ ...THREE_D_CTX, open3dViewControls });
    expect(open3dViewControls).toHaveBeenCalledOnce();
  });
});
