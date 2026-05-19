import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { ElementRenderStatusPanel } from './ElementRenderStatusPanel';

afterEach(() => cleanup());

describe('ElementRenderStatusPanel', () => {
  it('distinguishes model-invalid diagnostics from renderer unsupported diagnostics', () => {
    const wall = {
      kind: 'wall',
      id: 'wall-degenerate',
      name: 'Degenerate wall',
      levelId: 'level-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 0, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3000,
    } satisfies Extract<Element, { kind: 'wall' }>;
    const roof = {
      kind: 'roof',
      id: 'roof-unsupported',
      name: 'Unsupported roof',
      referenceLevelId: 'level-1',
      roofGeometryMode: 'folded_shell',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 5000, yMm: 0 },
        { xMm: 5000, yMm: 3000 },
      ],
    } as unknown as Extract<Element, { kind: 'roof' }>;

    const wallUi = render(
      <ElementRenderStatusPanel
        element={wall}
        elementsById={{ [wall.id]: wall, [roof.id]: roof }}
        viewId="view-1"
      />,
    );
    expect(wallUi.getByText('Model invalid')).toBeTruthy();
    expect(wallUi.getAllByText(/renderer.wall_geometry.degenerate/).length).toBeGreaterThan(0);
    wallUi.unmount();

    const roofUi = render(
      <ElementRenderStatusPanel
        element={roof}
        elementsById={{ [wall.id]: wall, [roof.id]: roof }}
        viewId="view-1"
      />,
    );
    expect(roofUi.getByText('Renderer unsupported or degraded')).toBeTruthy();
    expect(roofUi.getAllByText(/renderer.roof_geometry.unsupported/).length).toBeGreaterThan(0);
  });
});
