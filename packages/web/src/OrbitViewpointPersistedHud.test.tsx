import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { OrbitViewpointPersistedHud } from './OrbitViewpointPersistedHud';

function cameraFixture() {
  return {
    position: { xMm: 0, yMm: 0, zMm: 5000 },
    target: { xMm: 0, yMm: 0, zMm: 0 },
    up: { xMm: 0, yMm: 0, zMm: 1 },
  };
}

describe('OrbitViewpointPersistedHud', () => {
  const containers: HTMLDivElement[] = [];

  beforeAll(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    for (const c of containers) {
      c.remove();
    }
    containers.length = 0;
  });

  function renderHud(ui: ReactElement) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    containers.push(container);
    const root = createRoot(container);
    act(() => {
      root.render(ui);
    });
    return container;
  }

  it('shows guidance when no active viewpoint', () => {
    const el = renderHud(<OrbitViewpointPersistedHud activeViewpointId={undefined} viewpoint={null} />);
    expect(el.textContent).toContain('Select a saved orbit viewpoint');
    expect(el.querySelector('[data-testid="orbit-viewpoint-persisted-hud"]')).toBeTruthy();
  });

  it('shows mismatch state when id does not resolve to orbit viewpoint', () => {
    const el = renderHud(
      <OrbitViewpointPersistedHud activeViewpointId="missing-vp" viewpoint={null} />,
    );
    expect(el.textContent).toContain('missing-vp');
    expect(el.textContent).toContain('not a saved orbit 3D viewpoint');
  });

  it('renders full persisted clip and hidden metadata', () => {
    const viewpoint = {
      kind: 'viewpoint' as const,
      id: 'vp-save',
      name: 'Southwest cutaway',
      mode: 'orbit_3d' as const,
      camera: cameraFixture(),
      viewerClipCapElevMm: 4500,
      viewerClipFloorElevMm: 900,
      hiddenSemanticKinds3d: ['roof', 'stair'],
    };
    const el = renderHud(
      <OrbitViewpointPersistedHud activeViewpointId="vp-save" viewpoint={viewpoint} />,
    );
    expect(el.textContent).toContain('Southwest cutaway');
    expect(el.textContent).toContain('vp-save');
    expect(el.textContent).toContain('4500');
    expect(el.textContent).toContain('900');
    expect(el.textContent).toContain('Box clip (cap + floor)');
    expect(el.textContent).toContain('2: roof, stair');
    expect(el.textContent).toContain('saved viewpoint element');
  });

  it('handles partial clip metadata and no hidden kinds', () => {
    const viewpoint = {
      kind: 'viewpoint' as const,
      id: 'vp-partial',
      name: 'Cap only',
      mode: 'orbit_3d' as const,
      camera: cameraFixture(),
      viewerClipCapElevMm: 3000,
      hiddenSemanticKinds3d: [],
    };
    const el = renderHud(
      <OrbitViewpointPersistedHud activeViewpointId="vp-partial" viewpoint={viewpoint} />,
    );
    expect(el.textContent).toContain('Cap clip only');
    expect(el.textContent).toContain('Floor (mm)');
    expect(el.textContent).toContain('—');
  });
});
