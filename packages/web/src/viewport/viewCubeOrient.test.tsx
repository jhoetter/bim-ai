import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ViewCube } from './ViewCube';
import type { Saved3dViewElement } from '@bim-ai/core';

afterEach(() => {
  cleanup();
});

function makeSavedView(id: string, name: string): Saved3dViewElement {
  return {
    kind: 'saved_3d_view',
    id,
    name,
    cameraMm: { x: 0, y: 0, z: 5000 },
    targetMm: { x: 0, y: 0, z: 0 },
    upVector: { x: 0, y: 1, z: 0 },
  };
}

describe('ViewCube orient to view — §3.2', () => {
  it('renders viewcube-context-menu on right click', () => {
    const { getByTestId, queryByTestId } = render(
      <ViewCube currentAzimuth={0} currentElevation={0.45} onPick={() => undefined} />,
    );
    expect(queryByTestId('viewcube-context-menu')).toBeNull();
    fireEvent.contextMenu(getByTestId('view-cube-stage'));
    expect(getByTestId('viewcube-context-menu')).toBeTruthy();
  });

  it('context menu shows orient-top and orient-front buttons', () => {
    const { getByTestId } = render(
      <ViewCube currentAzimuth={0} currentElevation={0.45} onPick={() => undefined} />,
    );
    fireEvent.contextMenu(getByTestId('view-cube-stage'));
    expect(getByTestId('viewcube-orient-top')).toBeTruthy();
    expect(getByTestId('viewcube-orient-front')).toBeTruthy();
  });

  it('context menu shows saved view entries', () => {
    const views = [makeSavedView('sv-1', 'South Facade'), makeSavedView('sv-2', 'North Facade')];
    const { getByTestId } = render(
      <ViewCube
        currentAzimuth={0}
        currentElevation={0.45}
        onPick={() => undefined}
        savedViews={views}
      />,
    );
    fireEvent.contextMenu(getByTestId('view-cube-stage'));
    expect(getByTestId('viewcube-orient-saved-sv-1')).toBeTruthy();
    expect(getByTestId('viewcube-orient-saved-sv-2')).toBeTruthy();
  });

  it('context menu dismisses on outside click', () => {
    const { getByTestId, queryByTestId } = render(
      <ViewCube currentAzimuth={0} currentElevation={0.45} onPick={() => undefined} />,
    );
    fireEvent.contextMenu(getByTestId('view-cube-stage'));
    expect(getByTestId('viewcube-context-menu')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(queryByTestId('viewcube-context-menu')).toBeNull();
  });

  it('does not show saved views section when none exist', () => {
    const { getByTestId, queryByRole } = render(
      <ViewCube
        currentAzimuth={0}
        currentElevation={0.45}
        onPick={() => undefined}
        savedViews={[]}
      />,
    );
    fireEvent.contextMenu(getByTestId('view-cube-stage'));
    const menu = getByTestId('viewcube-context-menu');
    // No <hr> separator should appear when there are no saved views.
    expect(menu.querySelector('hr')).toBeNull();
    // No saved view buttons should appear.
    expect(queryByRole('button', { name: /saved/i })).toBeNull();
  });

  it('clicking orient-top calls onPick with TOP face pick', () => {
    const onPick = vi.fn();
    const { getByTestId } = render(
      <ViewCube currentAzimuth={0} currentElevation={0.45} onPick={onPick} />,
    );
    fireEvent.contextMenu(getByTestId('view-cube-stage'));
    fireEvent.click(getByTestId('viewcube-orient-top'));
    expect(onPick).toHaveBeenCalledWith(
      { kind: 'face', face: 'TOP' },
      expect.objectContaining({ elevation: expect.any(Number) }),
    );
  });

  it('clicking orient-front calls onPick with FRONT face pick', () => {
    const onPick = vi.fn();
    const { getByTestId } = render(
      <ViewCube currentAzimuth={0} currentElevation={0.45} onPick={onPick} />,
    );
    fireEvent.contextMenu(getByTestId('view-cube-stage'));
    fireEvent.click(getByTestId('viewcube-orient-front'));
    expect(onPick).toHaveBeenCalledWith(
      { kind: 'face', face: 'FRONT' },
      expect.objectContaining({ azimuth: 0 }),
    );
  });

  it('clicking a saved view calls onOrientSaved with the view', () => {
    const onOrientSaved = vi.fn();
    const view = makeSavedView('sv-1', 'South Facade');
    const { getByTestId } = render(
      <ViewCube
        currentAzimuth={0}
        currentElevation={0.45}
        onPick={() => undefined}
        savedViews={[view]}
        onOrientSaved={onOrientSaved}
      />,
    );
    fireEvent.contextMenu(getByTestId('view-cube-stage'));
    fireEvent.click(getByTestId('viewcube-orient-saved-sv-1'));
    expect(onOrientSaved).toHaveBeenCalledWith(view);
  });

  it('menu closes after clicking an orient button', () => {
    const { getByTestId, queryByTestId } = render(
      <ViewCube currentAzimuth={0} currentElevation={0.45} onPick={() => undefined} />,
    );
    fireEvent.contextMenu(getByTestId('view-cube-stage'));
    expect(getByTestId('viewcube-context-menu')).toBeTruthy();
    fireEvent.click(getByTestId('viewcube-orient-front'));
    expect(queryByTestId('viewcube-context-menu')).toBeNull();
  });
});
