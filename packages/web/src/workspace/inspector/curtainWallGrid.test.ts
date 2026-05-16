import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import { curtainWallPlanThree } from '../../plan/curtainWallPlanSymbol';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const curtainWall = {
  kind: 'wall',
  id: 'cw-1',
  name: 'Curtain Wall South',
  levelId: 'lvl-ground',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 6000, yMm: 0 },
  thicknessMm: 150,
  heightMm: 3000,
  isCurtainWall: true,
  curtainWallVCount: 3,
  curtainWallHCount: 2,
  curtainWallPanelType: null,
  curtainWallMullionType: null,
} as unknown as Extract<Element, { kind: 'wall' }>;

describe('curtain wall grid inspector controls', () => {
  it('hGridCount input dispatches update_curtain_grid with correct count', () => {
    const onDispatchCommand = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(curtainWall, t, { onDispatchCommand }));
    const input = getByTestId('inspector-curtain-h-grid-count') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '4' } });
    expect(onDispatchCommand).toHaveBeenCalledWith({
      type: 'update_curtain_grid',
      wallId: 'cw-1',
      hGridCount: 4,
    });
  });

  it('vGridCount input dispatches update_curtain_grid', () => {
    const onDispatchCommand = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(curtainWall, t, { onDispatchCommand }));
    const input = getByTestId('inspector-curtain-v-grid-count') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5' } });
    expect(onDispatchCommand).toHaveBeenCalledWith({
      type: 'update_curtain_grid',
      wallId: 'cw-1',
      vGridCount: 5,
    });
  });

  it('panel type dropdown dispatches update_curtain_grid with panelType', () => {
    const onDispatchCommand = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(curtainWall, t, { onDispatchCommand }));
    const select = getByTestId('inspector-curtain-panel-type') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'solid' } });
    expect(onDispatchCommand).toHaveBeenCalledWith({
      type: 'update_curtain_grid',
      wallId: 'cw-1',
      panelType: 'solid',
    });
  });

  it('mullion type dropdown dispatches update_curtain_grid with mullionType', () => {
    const onDispatchCommand = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(curtainWall, t, { onDispatchCommand }));
    const select = getByTestId('inspector-curtain-mullion-type') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'circular' } });
    expect(onDispatchCommand).toHaveBeenCalledWith({
      type: 'update_curtain_grid',
      wallId: 'cw-1',
      mullionType: 'circular',
    });
  });

  it('curtain grid re-renders in plan after hGridCount change', () => {
    const wallWith3 = {
      ...curtainWall,
      curtainWallData: { gridH: { count: 2 }, gridV: { count: 3 } },
    } as unknown as Extract<Element, { kind: 'wall' }>;
    const wallWith5 = {
      ...curtainWall,
      curtainWallData: { gridH: { count: 2 }, gridV: { count: 5 } },
    } as unknown as Extract<Element, { kind: 'wall' }>;

    const group3 = curtainWallPlanThree(wallWith3);
    const group5 = curtainWallPlanThree(wallWith5);

    // vGridCount=3 → 2 interior ticks; vGridCount=5 → 4 interior ticks
    // Each tick adds 1 child Line; the first child is the main center line
    const tickCount3 = group3.children.length - 1;
    const tickCount5 = group5.children.length - 1;
    expect(tickCount3).toBe(2);
    expect(tickCount5).toBe(4);
    expect(tickCount5).toBeGreaterThan(tickCount3);
  });
});
