import { describe, expect, it } from 'vitest';
import { applyAttachWallTopCmd, applyDetachWallTopCmd } from './attachWallTop';
import {
  reduceAttach,
  initialAttachState,
  reduceDetach,
  initialDetachState,
} from '../tools/toolGrammar';

const makeWall = (id: string) => ({
  id,
  kind: 'wall' as const,
  roofAttachmentId: null as string | null,
});

describe('attach/detach wall top grammar', () => {
  it('attach_wall_top sets roofAttachmentId on wall', () => {
    const wall = makeWall('wall-1');
    const elementsById = { 'wall-1': wall as Record<string, unknown> };
    const result = applyAttachWallTopCmd(
      elementsById as Record<string, Record<string, unknown>>,
      'wall-1',
      'roof-42',
    );
    expect(result['wall-1']['roofAttachmentId']).toBe('roof-42');
  });

  it('detach_wall_top clears roofAttachmentId', () => {
    const wall = { ...makeWall('wall-2'), roofAttachmentId: 'roof-99' };
    const elementsById = { 'wall-2': wall as Record<string, unknown> };
    const result = applyDetachWallTopCmd(
      elementsById as Record<string, Record<string, unknown>>,
      'wall-2',
    );
    expect(result['wall-2']['roofAttachmentId']).toBeNull();
  });

  it('reduceAttach: clicking wall then roof emits attach_wall_top command', () => {
    let { state } = reduceAttach(initialAttachState(), {
      kind: 'click',
      elementId: 'wall-1',
      elementKind: 'wall',
    });
    expect(state).toEqual({ phase: 'picking-target', wallId: 'wall-1' });

    const { effect } = reduceAttach(state, {
      kind: 'click',
      elementId: 'roof-1',
      elementKind: 'roof',
    });
    expect(effect.attachWallTop).toEqual({ wallId: 'wall-1', targetId: 'roof-1' });
  });

  it('reduceDetach: clicking wall emits detach_wall_top command', () => {
    const { effect } = reduceDetach(initialDetachState(), {
      kind: 'click',
      elementId: 'wall-3',
      elementKind: 'wall',
    });
    expect(effect.detachWallTop).toEqual({ wallId: 'wall-3' });
  });
});
