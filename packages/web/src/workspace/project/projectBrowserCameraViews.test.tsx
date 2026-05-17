/**
 * §14.5 — ProjectBrowserV3 camera views section tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { ProjectBrowserV3 } from './ProjectBrowser';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const viewpointEl: Element = {
  kind: 'viewpoint',
  id: 'vp-01',
  name: '3D Overview',
  camera: {
    position: { xMm: 0, yMm: 0, zMm: 10000 },
    target: { xMm: 0, yMm: 0, zMm: 0 },
    up: { xMm: 0, yMm: 1, zMm: 0 },
  },
  mode: 'orbit_3d',
};

const perspectiveView: Element = {
  kind: 'saved_3d_view',
  id: 'scv-01',
  name: 'Front Camera',
  cameraMm: { x: 1000, y: 2000, z: 3000 },
  targetMm: { x: 0, y: 0, z: 0 },
  perspective: true,
  fovDeg: 60,
} as Element;

const orthoView: Element = {
  kind: 'saved_3d_view',
  id: 'ortho-01',
  name: 'Top View',
  cameraMm: { x: 0, y: 0, z: 5000 },
  targetMm: { x: 0, y: 0, z: 0 },
  perspective: false,
} as Element;

function makeProps(elements: Element[] = [viewpointEl]) {
  return {
    elements,
    activeViewId: null as string | null,
    onActivateView: vi.fn(),
    onRenameView: vi.fn(),
    onDeleteView: vi.fn(),
    onDuplicateView: vi.fn(),
    onRestore3dView: vi.fn(),
    onDelete3dView: vi.fn(),
    onRename3dView: vi.fn(),
    onSaveCameraView: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('project browser camera views section — §14.5', () => {
  it('renders browser-camera-views-group', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps()} />);
    expect(getByTestId('browser-camera-views-group')).toBeTruthy();
  });

  it('renders save-camera-view button', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps()} />);
    expect(getByTestId('browser-save-camera-view')).toBeTruthy();
  });

  it('lists perspective saved_3d_view elements', () => {
    const props = makeProps([viewpointEl, perspectiveView, orthoView]);
    const { getByTestId, queryByTestId } = render(<ProjectBrowserV3 {...props} />);
    // perspective view should appear in camera views group
    expect(getByTestId('browser-camera-view-scv-01')).toBeTruthy();
    // ortho view should NOT appear in camera views group
    expect(queryByTestId('browser-camera-view-ortho-01')).toBeNull();
  });

  it('clicking save-camera-view calls onSaveCameraView', () => {
    const props = makeProps();
    const { getByTestId } = render(<ProjectBrowserV3 {...props} />);
    fireEvent.click(getByTestId('browser-save-camera-view'));
    expect(props.onSaveCameraView).toHaveBeenCalledTimes(1);
  });

  it('double-click on camera view calls onRestore3dView', () => {
    const props = makeProps([viewpointEl, perspectiveView]);
    const { getByTestId } = render(<ProjectBrowserV3 {...props} />);
    const row = getByTestId('browser-camera-view-scv-01').querySelector('button') as HTMLElement;
    fireEvent.doubleClick(row);
    expect(props.onRestore3dView).toHaveBeenCalledWith('scv-01');
  });

  it('right-click on camera view opens camera context menu', () => {
    const props = makeProps([viewpointEl, perspectiveView]);
    const { getByTestId, queryByTestId } = render(<ProjectBrowserV3 {...props} />);
    expect(queryByTestId('pb-camera-context-menu')).toBeNull();
    const row = getByTestId('browser-camera-view-scv-01').querySelector('button') as HTMLElement;
    fireEvent.contextMenu(row, { clientX: 100, clientY: 200 });
    expect(queryByTestId('pb-camera-context-menu')).not.toBeNull();
  });

  it('camera context menu Delete calls onDelete3dView', () => {
    const props = makeProps([viewpointEl, perspectiveView]);
    const { getByTestId } = render(<ProjectBrowserV3 {...props} />);
    const row = getByTestId('browser-camera-view-scv-01').querySelector('button') as HTMLElement;
    fireEvent.contextMenu(row, { clientX: 0, clientY: 0 });
    fireEvent.click(getByTestId('pb-camera-ctx-delete'));
    expect(props.onDelete3dView).toHaveBeenCalledWith('scv-01');
  });

  it('ortho view with perspective=false stays out of camera views group', () => {
    const props = makeProps([orthoView]);
    const { queryByTestId } = render(<ProjectBrowserV3 {...props} />);
    expect(queryByTestId('browser-camera-view-ortho-01')).toBeNull();
  });
});
