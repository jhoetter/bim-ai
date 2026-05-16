import { describe, expect, it, vi } from 'vitest';

import type { Element } from '@bim-ai/core';

import type { GroupInstance } from '../groups/groupTypes';
import { handleDblClickDispatch } from './doubleClickDispatch';

function makeHandlers() {
  return {
    selectEl: vi.fn<(id: string) => void>(),
    setActiveLevelId: vi.fn<(id: string) => void>(),
    onSemanticCommand: vi.fn<(cmd: Record<string, unknown>) => void>(),
  };
}

describe('double-click to edit — §1.8.3', () => {
  it('double-click on floor element triggers floor boundary edit mode', () => {
    const handlers = makeHandlers();
    const floor = {
      kind: 'floor',
      id: 'floor-1',
      name: 'Floor 1',
      levelId: 'level-1',
      boundaryMm: [],
      thicknessMm: 200,
    } as unknown as Element;

    const handled = handleDblClickDispatch('floor-1', floor, undefined, 'select', handlers);

    expect(handled).toBe(true);
    expect(handlers.selectEl).toHaveBeenCalledWith('floor-1');
    expect(handlers.setActiveLevelId).toHaveBeenCalledWith('level-1');
    expect(handlers.onSemanticCommand).not.toHaveBeenCalled();
  });

  it('double-click on roof element triggers roof footprint edit mode', () => {
    const handlers = makeHandlers();
    const roof = {
      kind: 'roof',
      id: 'roof-1',
      name: 'Roof 1',
      referenceLevelId: 'level-2',
      footprintMm: [],
    } as unknown as Element;

    const handled = handleDblClickDispatch('roof-1', roof, undefined, 'select', handlers);

    expect(handled).toBe(true);
    expect(handlers.selectEl).toHaveBeenCalledWith('roof-1');
    expect(handlers.setActiveLevelId).toHaveBeenCalledWith('level-2');
    expect(handlers.onSemanticCommand).not.toHaveBeenCalled();
  });

  it('double-click on group dispatches editGroup command', () => {
    const handlers = makeHandlers();
    const groupInst: GroupInstance = {
      id: 'inst-1',
      groupDefinitionId: 'def-1',
      insertionXMm: 0,
      insertionYMm: 0,
      rotationDeg: 0,
    };

    const handled = handleDblClickDispatch('inst-1', undefined, groupInst, 'select', handlers);

    expect(handled).toBe(true);
    expect(handlers.onSemanticCommand).toHaveBeenCalledWith({
      type: 'editGroup',
      groupDefinitionId: 'def-1',
    });
    expect(handlers.selectEl).not.toHaveBeenCalled();
  });

  it('double-click on room sets selectedElementIds to that room', () => {
    const handlers = makeHandlers();
    const room = {
      kind: 'room',
      id: 'room-1',
      name: 'Room 1',
      levelId: 'level-1',
    } as unknown as Element;

    const handled = handleDblClickDispatch('room-1', room, undefined, 'select', handlers);

    expect(handled).toBe(true);
    expect(handlers.selectEl).toHaveBeenCalledWith('room-1');
    expect(handlers.onSemanticCommand).not.toHaveBeenCalled();
  });

  it('double-click on wall selects wall without crashing', () => {
    const handlers = makeHandlers();
    const wall = {
      kind: 'wall',
      id: 'wall-1',
      levelId: 'level-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
      heightMm: 2800,
      thicknessMm: 200,
    } as unknown as Element;

    expect(() => {
      handleDblClickDispatch('wall-1', wall, undefined, 'select', handlers);
    }).not.toThrow();

    expect(handlers.selectEl).toHaveBeenCalledWith('wall-1');
  });

  it('returns false and takes no action when planTool is not select', () => {
    const handlers = makeHandlers();
    const floor = {
      kind: 'floor',
      id: 'floor-1',
      name: 'Floor 1',
      levelId: 'level-1',
      boundaryMm: [],
      thicknessMm: 200,
    } as unknown as Element;

    const handled = handleDblClickDispatch('floor-1', floor, undefined, 'wall', handlers);

    expect(handled).toBe(false);
    expect(handlers.selectEl).not.toHaveBeenCalled();
    expect(handlers.onSemanticCommand).not.toHaveBeenCalled();
  });

  it('returns false when element is unknown kind in select mode', () => {
    const handlers = makeHandlers();
    const el = { kind: 'grid_line', id: 'grid-1' } as unknown as Element;

    const handled = handleDblClickDispatch('grid-1', el, undefined, 'select', handlers);

    expect(handled).toBe(false);
    expect(handlers.selectEl).not.toHaveBeenCalled();
  });
});
