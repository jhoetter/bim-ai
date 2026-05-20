import type { Element } from '@bim-ai/core';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlanCanvasContextOverlays } from './PlanCanvasContextOverlays';

const baseProps = {
  wallContextMenu: null,
  onWallContextCommand: vi.fn(),
  onCloseWallContextMenu: vi.fn(),
  canvasContextMenu: null,
  onCloseCanvasContextMenu: vi.fn(),
  onCanvasZoomIn: vi.fn(),
  onCanvasZoomOut: vi.fn(),
  onCanvasZoomFit: vi.fn(),
  elementContextMenu: null,
  activeLevelId: 'level-1',
  planTool: 'select',
  onSemanticCommand: vi.fn(),
  onCloseElementContextMenu: vi.fn(),
  unhideContextMenu: null,
  activePlanViewId: 'plan-1',
  onSetCategoryOverride: vi.fn(),
  onCloseUnhideContextMenu: vi.fn(),
  dxfQueryHover: null,
  dxfQueryDialog: null,
  elementsById: {},
  onCloseDxfQueryDialog: vi.fn(),
  onUpdateDxfQueryDialog: vi.fn(),
  wallJoinContextMenu: null,
  onCloseWallJoinContextMenu: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PlanCanvasContextOverlays', () => {
  it('routes reveal-hidden menu actions', () => {
    const onSemanticCommand = vi.fn();
    const onSetCategoryOverride = vi.fn();
    const onCloseUnhideContextMenu = vi.fn();
    const { getByTestId } = render(
      <PlanCanvasContextOverlays
        {...baseProps}
        onSemanticCommand={onSemanticCommand}
        onSetCategoryOverride={onSetCategoryOverride}
        onCloseUnhideContextMenu={onCloseUnhideContextMenu}
        unhideContextMenu={{
          elementKind: 'wall',
          elementId: 'wall-1',
          position: { x: 10, y: 20 },
        }}
      />,
    );

    fireEvent.click(getByTestId('unhide-context-element'));
    expect(onSemanticCommand).toHaveBeenCalledWith({
      type: 'unhideElementInView',
      planViewId: 'plan-1',
      elementId: 'wall-1',
    });

    fireEvent.click(getByTestId('unhide-context-category'));
    expect(onSetCategoryOverride).toHaveBeenCalledWith('plan-1', 'wall', { visible: true });
    expect(onCloseUnhideContextMenu).toHaveBeenCalledTimes(2);
  });

  it('emits wall join toggles from the extracted menu', () => {
    const onSemanticCommand = vi.fn();
    const onCloseWallJoinContextMenu = vi.fn();
    const { getByTestId } = render(
      <PlanCanvasContextOverlays
        {...baseProps}
        onSemanticCommand={onSemanticCommand}
        onCloseWallJoinContextMenu={onCloseWallJoinContextMenu}
        wallJoinContextMenu={{
          wallId: 'wall-1',
          endpoint: 'start',
          position: { x: 5, y: 8 },
          currentlyDisallowed: false,
        }}
      />,
    );

    fireEvent.click(getByTestId('wall-join-ctx-toggle'));
    expect(onSemanticCommand).toHaveBeenCalledWith({
      type: 'setWallJoinDisallow',
      wallId: 'wall-1',
      endpoint: 'start',
      disallow: true,
    });
    expect(onCloseWallJoinContextMenu).toHaveBeenCalledTimes(1);
  });

  it('shows the generic element context menu at the selected point', () => {
    const element = { id: 'door-1', kind: 'door' } as unknown as Element;
    const { getByTestId } = render(
      <PlanCanvasContextOverlays
        {...baseProps}
        elementContextMenu={{ el: element, position: { x: 32, y: 48 } }}
      />,
    );

    expect(getByTestId('element-context-menu')).toBeTruthy();
  });
});
