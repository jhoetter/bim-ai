import { fireEvent } from '@testing-library/react';
import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
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
    const el = renderHud(
      <OrbitViewpointPersistedHud activeViewpointId={undefined} viewpoint={null} />,
    );
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
      viewerShadowsEnabled: false,
      viewerAmbientOcclusionEnabled: true,
      viewerDepthCueEnabled: true,
      viewerSilhouetteEdgeWidth: 3 as const,
      viewerPhotographicExposureEv: 0.75,
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
    expect(el.textContent).toContain('shadows off');
    expect(el.textContent).toContain('AO on');
    expect(el.textContent).toContain('depth on');
    expect(el.textContent).toContain('edge 3');
    expect(el.textContent).toContain('EV +0.75');
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

  it('authoring mode blur and cutaway change call onPersistField', () => {
    const onPersistField = vi.fn();
    const viewpoint = {
      kind: 'viewpoint' as const,
      id: 'vp-auth',
      name: 'Editable',
      mode: 'orbit_3d' as const,
      camera: cameraFixture(),
      viewerClipCapElevMm: 1000,
      hiddenSemanticKinds3d: [],
      viewerShadowsEnabled: true,
      viewerAmbientOcclusionEnabled: false,
      viewerDepthCueEnabled: false,
      viewerSilhouetteEdgeWidth: 1 as const,
      viewerPhotographicExposureEv: 0,
    };
    const el = renderHud(
      <OrbitViewpointPersistedHud
        activeViewpointId="vp-auth"
        viewpoint={viewpoint}
        onPersistField={onPersistField}
      />,
    );

    const cap = el.querySelector('[data-testid="orbit-vp-cap-mm"]') as HTMLInputElement;
    expect(cap).toBeTruthy();

    act(() => {
      fireEvent.change(cap, { target: { value: '2400' } });
      fireEvent.blur(cap);
    });

    expect(onPersistField).toHaveBeenCalledWith({
      elementId: 'vp-auth',
      key: 'viewerClipCapElevMm',
      value: '2400',
    });

    const cut = el.querySelector('[data-testid="orbit-vp-cutaway-select"]') as HTMLSelectElement;
    act(() => {
      fireEvent.change(cut, { target: { value: 'box' } });
    });

    expect(onPersistField).toHaveBeenCalledWith({
      elementId: 'vp-auth',
      key: 'cutawayStyle',
      value: 'box',
    });

    const shadows = el.querySelector(
      '[data-testid="orbit-vp-shadows-toggle"]',
    ) as HTMLButtonElement;
    act(() => {
      fireEvent.click(shadows);
    });

    expect(onPersistField).toHaveBeenCalledWith({
      elementId: 'vp-auth',
      key: 'viewerShadowsEnabled',
      value: 'false',
    });

    const edgeWidth = el.querySelector('[data-testid="orbit-vp-edge-width"]') as HTMLSelectElement;
    act(() => {
      fireEvent.change(edgeWidth, { target: { value: '4' } });
    });

    expect(onPersistField).toHaveBeenCalledWith({
      elementId: 'vp-auth',
      key: 'viewerSilhouetteEdgeWidth',
      value: '4',
    });

    const exposure = el.querySelector('[data-testid="orbit-vp-exposure-ev"]') as HTMLInputElement;
    act(() => {
      fireEvent.change(exposure, { target: { value: '1.5' } });
      fireEvent.blur(exposure);
    });

    expect(onPersistField).toHaveBeenCalledWith({
      elementId: 'vp-auth',
      key: 'viewerPhotographicExposureEv',
      value: '1.5',
    });
  });
});
