import type { Element } from '@bim-ai/core';

import { flipWallLocationLineSide } from '../geometry/wallConnectivity';
import { stairBoundaryMm } from '../plan/stairBoundingBox';
import type { ContextMenuItem } from './ElementContextMenu';

export function contextMenuItemsForElement(
  el: Element,
  dispatch: (cmd: Record<string, unknown>) => void,
  extras: { activeLevelId: string; planTool: string },
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  switch (el.kind) {
    case 'wall': {
      items.push({
        label: 'Flip',
        onClick: () =>
          dispatch({
            type: 'updateElementProperty',
            elementId: el.id,
            key: 'locationLine',
            value: flipWallLocationLineSide(el.locationLine ?? 'wall-centerline'),
          }),
      });
      items.push({
        label: 'Edit Profile',
        disabled: true,
        onClick: () => {},
      });
      items.push({
        label: 'Split Element',
        onClick: () => dispatch({ type: 'activateTool', tool: 'split-wall', targetWallId: el.id }),
      });
      items.push({
        label: 'Mirror Horizontal',
        onClick: () => dispatch({ type: 'mirrorElement', elementId: el.id, axis: 'horizontal' }),
      });
      items.push({
        label: 'Mirror Vertical',
        onClick: () => dispatch({ type: 'mirrorElement', elementId: el.id, axis: 'vertical' }),
      });
      break;
    }
    case 'floor': {
      items.push({
        label: 'Edit Boundary',
        onClick: () => dispatch({ type: 'editFloorBoundary', floorId: el.id }),
      });
      items.push({
        label: 'Flip',
        onClick: () =>
          dispatch({
            type: 'updateElementProperty',
            elementId: el.id,
            key: 'flipped',
            value: true,
          }),
      });
      items.push({
        label: 'Mirror Horizontal',
        onClick: () => dispatch({ type: 'mirrorElement', elementId: el.id, axis: 'horizontal' }),
      });
      items.push({
        label: 'Mirror Vertical',
        onClick: () => dispatch({ type: 'mirrorElement', elementId: el.id, axis: 'vertical' }),
      });
      break;
    }
    case 'door':
    case 'window': {
      items.push({
        label: 'Flip Facing',
        onClick: () =>
          dispatch({
            type: 'updateElementProperty',
            elementId: el.id,
            key: 'facingFlipped',
            value: true,
          }),
      });
      items.push({
        label: 'Flip Handing',
        onClick: () =>
          dispatch({
            type: 'updateElementProperty',
            elementId: el.id,
            key: 'handingFlipped',
            value: true,
          }),
      });
      items.push({
        label: 'Select Host',
        onClick: () => dispatch({ type: 'selectElement', elementId: el.wallId }),
      });
      break;
    }
    case 'column': {
      items.push({
        label: 'Mirror Horizontal',
        onClick: () => dispatch({ type: 'mirrorElement', elementId: el.id, axis: 'horizontal' }),
      });
      items.push({
        label: 'Rotate 90°',
        onClick: () =>
          dispatch({
            type: 'updateElementProperty',
            elementId: el.id,
            key: 'rotationDeg',
            value: (el.rotationDeg ?? 0) + 90,
          }),
      });
      items.push({
        label: 'Select Similar',
        onClick: () =>
          dispatch({ type: 'selectSimilar', kind: 'column', levelId: extras.activeLevelId }),
      });
      break;
    }
    case 'room': {
      items.push({
        label: 'Edit Name',
        onClick: () => dispatch({ type: 'focusInspectorField', elementId: el.id, field: 'name' }),
      });
      items.push({
        label: 'Select Similar',
        onClick: () =>
          dispatch({ type: 'selectSimilar', kind: 'room', levelId: extras.activeLevelId }),
      });
      items.push({
        label: 'Show in Schedule',
        onClick: () => dispatch({ type: 'showElementInSchedule', elementId: el.id }),
      });
      break;
    }
    case 'stair': {
      items.push({
        label: 'Create Floor Opening',
        onClick: () =>
          dispatch({
            type: 'create_shaft',
            id: crypto.randomUUID(),
            boundaryMm: stairBoundaryMm(el),
            baseLevelId: el.baseLevelId,
            topLevelId: el.topLevelId,
          }),
      });
      break;
    }
    case 'detail_group': {
      items.push({
        label: 'Edit Group',
        onClick: () => dispatch({ type: 'editGroup', groupDefinitionId: el.id }),
      });
      items.push({
        label: 'Ungroup',
        onClick: () => dispatch({ type: 'ungroupElements', groupInstanceId: el.id }),
      });
      break;
    }
    default:
      break;
  }

  if (items.length > 0) {
    items.push({ label: '', separator: true, onClick: () => {} });
  }
  items.push({
    label: 'Delete',
    onClick: () => dispatch({ type: 'deleteElement', elementId: el.id }),
  });
  items.push({
    label: 'Properties',
    onClick: () => dispatch({ type: 'selectElement', elementId: el.id }),
  });

  return items;
}
