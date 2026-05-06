import { beforeEach, describe, expect, it } from 'vitest';

import { useBimStore } from './store';

// Reset store to initial revision=0 / empty before each test
beforeEach(() => {
  useBimStore.setState({
    revision: 0,
    elementsById: {},
    violations: [],
    activeLevelId: undefined,
    activePlanViewId: undefined,
    activeViewpointId: undefined,
    selectedId: undefined,
    planProjectionPrimitives: null,
    planRoomSchemeWireReadout: null,
  });
});

// ─── hydrateFromSnapshot ──────────────────────────────────────────────────────

describe('hydrateFromSnapshot', () => {
  it('sets revision from snapshot', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({ modelId: 'm1', revision: 42, elements: {}, violations: [] });
    expect(useBimStore.getState().revision).toBe(42);
  });

  it('sets modelId from snapshot', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({ modelId: 'mdl-xyz', revision: 1, elements: {}, violations: [] });
    expect(useBimStore.getState().modelId).toBe('mdl-xyz');
  });

  it('populates elementsById for level elements', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({
      modelId: 'm1',
      revision: 1,
      elements: {
        'lvl-0': { kind: 'level', name: 'Ground', elevationMm: 0 },
        'lvl-1': { kind: 'level', name: 'First', elevationMm: 3000 },
      },
      violations: [],
    });
    const { elementsById } = useBimStore.getState();
    expect(elementsById['lvl-0']?.kind).toBe('level');
    expect(elementsById['lvl-1']?.kind).toBe('level');
  });

  it('coerces wall elements correctly', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({
      modelId: 'm1',
      revision: 1,
      elements: {
        'wall-1': {
          kind: 'wall',
          name: 'W1',
          levelId: 'lvl-0',
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 5000, yMm: 0 },
          thicknessMm: 200,
          heightMm: 2800,
        },
      },
      violations: [],
    });
    const wall = useBimStore.getState().elementsById['wall-1'];
    expect(wall?.kind).toBe('wall');
    if (wall?.kind === 'wall') {
      expect(wall.thicknessMm).toBe(200);
      expect(wall.end.xMm).toBe(5000);
    }
  });

  it('coerces door elements correctly', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({
      modelId: 'm1',
      revision: 1,
      elements: {
        'd1': { kind: 'door', name: 'D1', wallId: 'w1', alongT: 0.5, widthMm: 900 },
      },
      violations: [],
    });
    const door = useBimStore.getState().elementsById['d1'];
    expect(door?.kind).toBe('door');
    if (door?.kind === 'door') {
      expect(door.widthMm).toBe(900);
      expect(door.alongT).toBe(0.5);
    }
  });

  it('coerces room elements with outline', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({
      modelId: 'm1',
      revision: 1,
      elements: {
        'room-1': {
          kind: 'room',
          name: 'Office',
          levelId: 'lvl-0',
          outlineMm: [
            { xMm: 0, yMm: 0 },
            { xMm: 4000, yMm: 0 },
            { xMm: 4000, yMm: 3000 },
            { xMm: 0, yMm: 3000 },
          ],
        },
      },
      violations: [],
    });
    const room = useBimStore.getState().elementsById['room-1'];
    expect(room?.kind).toBe('room');
    if (room?.kind === 'room') {
      expect(room.outlineMm).toHaveLength(4);
    }
  });

  it('populates violations from snapshot', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({
      modelId: 'm1',
      revision: 1,
      elements: {},
      violations: [
        { ruleId: 'RULE_1', severity: 'warning', message: 'Test warning', elementIds: [] },
      ],
    });
    const { violations } = useBimStore.getState();
    expect(violations).toHaveLength(1);
    expect(violations[0]?.ruleId).toBe('RULE_1');
  });

  it('coerces violation with snake_case ruleId', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({
      modelId: 'm1',
      revision: 1,
      elements: {},
      violations: [{ rule_id: 'SNAKE_RULE', severity: 'error', message: 'Err', elementIds: [] }],
    });
    expect(useBimStore.getState().violations[0]?.ruleId).toBe('SNAKE_RULE');
  });

  it('auto-selects first level by elevation as activeLevelId', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({
      modelId: 'm1',
      revision: 1,
      elements: {
        'lvl-high': { kind: 'level', name: 'Roof', elevationMm: 9000 },
        'lvl-low': { kind: 'level', name: 'Ground', elevationMm: 0 },
        'lvl-mid': { kind: 'level', name: 'First', elevationMm: 3000 },
      },
      violations: [],
    });
    expect(useBimStore.getState().activeLevelId).toBe('lvl-low');
  });

  it('preserves activeLevelId when level still exists', () => {
    useBimStore.setState({ activeLevelId: 'lvl-0' });
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({
      modelId: 'm1',
      revision: 2,
      elements: { 'lvl-0': { kind: 'level', name: 'Ground', elevationMm: 0 } },
      violations: [],
    });
    expect(useBimStore.getState().activeLevelId).toBe('lvl-0');
  });

  it('resets planProjectionPrimitives to null on hydrate', () => {
    useBimStore.setState({ planProjectionPrimitives: { primitives: [] } as unknown as import('./storeTypes').StoreState['planProjectionPrimitives'] });
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({ modelId: 'm1', revision: 1, elements: {}, violations: [] });
    expect(useBimStore.getState().planProjectionPrimitives).toBeNull();
  });

  it('skips unknown element kinds without crashing', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    expect(() =>
      hydrateFromSnapshot({
        modelId: 'm1',
        revision: 1,
        elements: { 'e1': { kind: 'unknown_future_kind', name: 'X' } },
        violations: [],
      }),
    ).not.toThrow();
  });
});

// ─── applyDelta ───────────────────────────────────────────────────────────────

describe('applyDelta', () => {
  it('updates revision', () => {
    useBimStore.setState({ revision: 1, elementsById: {} });
    useBimStore.getState().applyDelta({ revision: 5, elements: {}, violations: [] });
    expect(useBimStore.getState().revision).toBe(5);
  });

  it('adds new elements from delta', () => {
    useBimStore.setState({ elementsById: {} });
    useBimStore.getState().applyDelta({
      revision: 2,
      elements: { 'lvl-1': { kind: 'level', name: 'L1', elevationMm: 3000 } },
      violations: [],
    });
    expect(useBimStore.getState().elementsById['lvl-1']?.kind).toBe('level');
  });

  it('merges new elements into existing ones', () => {
    useBimStore.setState({
      elementsById: { 'lvl-0': { kind: 'level', id: 'lvl-0', name: 'Ground', elevationMm: 0, offsetFromParentMm: 0 } },
    });
    useBimStore.getState().applyDelta({
      revision: 3,
      elements: { 'lvl-1': { kind: 'level', name: 'First', elevationMm: 3000 } },
      violations: [],
    });
    const state = useBimStore.getState();
    expect(state.elementsById['lvl-0']?.kind).toBe('level');
    expect(state.elementsById['lvl-1']?.kind).toBe('level');
  });

  it('removes elements listed in removedIds', () => {
    useBimStore.setState({
      elementsById: {
        'w1': { kind: 'wall', id: 'w1', name: 'W1', levelId: '', start: { xMm: 0, yMm: 0 }, end: { xMm: 0, yMm: 0 }, thicknessMm: 200, heightMm: 2800, baseConstraintOffsetMm: 0, topConstraintOffsetMm: 0, insulationExtensionMm: 0 },
        'w2': { kind: 'wall', id: 'w2', name: 'W2', levelId: '', start: { xMm: 0, yMm: 0 }, end: { xMm: 0, yMm: 0 }, thicknessMm: 200, heightMm: 2800, baseConstraintOffsetMm: 0, topConstraintOffsetMm: 0, insulationExtensionMm: 0 },
      },
    });
    useBimStore.getState().applyDelta({
      revision: 4,
      elements: {},
      violations: [],
      removedIds: ['w1'],
    });
    const state = useBimStore.getState();
    expect(state.elementsById['w1']).toBeUndefined();
    expect(state.elementsById['w2']).toBeDefined();
  });

  it('supports snake_case removed_ids', () => {
    useBimStore.setState({
      elementsById: { 'r1': { kind: 'level', id: 'r1', name: 'X', elevationMm: 0, offsetFromParentMm: 0 } },
    });
    useBimStore.getState().applyDelta({
      revision: 5,
      elements: {},
      violations: [],
      removed_ids: ['r1'],
    } as unknown as Parameters<typeof useBimStore.getState.prototype>[0]);
    expect(useBimStore.getState().elementsById['r1']).toBeUndefined();
  });

  it('replaces violations', () => {
    useBimStore.setState({ violations: [{ ruleId: 'OLD', severity: 'warning', message: '', elementIds: [] }] });
    useBimStore.getState().applyDelta({
      revision: 2,
      elements: {},
      violations: [{ ruleId: 'NEW', severity: 'error', message: 'x', elementIds: ['e1'] }],
    });
    const { violations } = useBimStore.getState();
    expect(violations).toHaveLength(1);
    expect(violations[0]?.ruleId).toBe('NEW');
  });

  it('clears planProjectionPrimitives on delta', () => {
    useBimStore.setState({ planProjectionPrimitives: { primitives: [] } as unknown as import('./storeTypes').StoreState['planProjectionPrimitives'] });
    useBimStore.getState().applyDelta({ revision: 2, elements: {}, violations: [] });
    expect(useBimStore.getState().planProjectionPrimitives).toBeNull();
  });

  it('clears activePlanViewId when plan_view element removed', () => {
    useBimStore.setState({
      activePlanViewId: 'pv1',
      elementsById: { 'pv1': { kind: 'plan_view', id: 'pv1', name: 'PV1' } as unknown as import('@bim-ai/core').Element },
    });
    useBimStore.getState().applyDelta({
      revision: 3,
      elements: {},
      violations: [],
      removedIds: ['pv1'],
    });
    expect(useBimStore.getState().activePlanViewId).toBeUndefined();
  });
});

// ─── Simple setters ────────────────────────────────────────────────────────────

describe('simple setters', () => {
  it('select sets selectedId', () => {
    useBimStore.getState().select('el-42');
    expect(useBimStore.getState().selectedId).toBe('el-42');
  });

  it('select with undefined clears selectedId', () => {
    useBimStore.setState({ selectedId: 'el-1' });
    useBimStore.getState().select(undefined);
    expect(useBimStore.getState().selectedId).toBeUndefined();
  });

  it('setViewerMode switches mode', () => {
    useBimStore.getState().setViewerMode('plan_canvas');
    expect(useBimStore.getState().viewerMode).toBe('plan_canvas');
    useBimStore.getState().setViewerMode('orbit_3d');
    expect(useBimStore.getState().viewerMode).toBe('orbit_3d');
  });

  it('setPlanTool changes active tool', () => {
    useBimStore.getState().setPlanTool('wall');
    expect(useBimStore.getState().planTool).toBe('wall');
  });

  it('setActiveLevelId sets the level', () => {
    useBimStore.getState().setActiveLevelId('lvl-3');
    expect(useBimStore.getState().activeLevelId).toBe('lvl-3');
  });

  it('setOrthoSnapHold toggles snap', () => {
    useBimStore.getState().setOrthoSnapHold(true);
    expect(useBimStore.getState().orthoSnapHold).toBe(true);
  });

  it('setComments replaces comments array', () => {
    const comments = [{ id: 'c1', userDisplay: 'Alice', body: 'Hi', resolved: false }];
    useBimStore.getState().setComments(comments);
    expect(useBimStore.getState().comments).toEqual(comments);
  });

  it('mergeComment inserts new comment', () => {
    useBimStore.setState({ comments: [] });
    useBimStore.getState().mergeComment({ id: 'c1', userDisplay: 'Bob', body: 'Hello', resolved: false });
    expect(useBimStore.getState().comments).toHaveLength(1);
  });

  it('mergeComment replaces existing comment with same id', () => {
    useBimStore.setState({ comments: [{ id: 'c1', userDisplay: 'Bob', body: 'Old', resolved: false }] });
    useBimStore.getState().mergeComment({ id: 'c1', userDisplay: 'Bob', body: 'Updated', resolved: true });
    expect(useBimStore.getState().comments).toHaveLength(1);
    expect(useBimStore.getState().comments[0]?.body).toBe('Updated');
  });

  it('setActivity sets events', () => {
    const events = [{ id: 1, userId: 'u1', revisionAfter: 5, createdAt: '2026-01-01', commandTypes: ['add_wall'] }];
    useBimStore.getState().setActivity(events);
    expect(useBimStore.getState().activityEvents).toEqual(events);
  });
});
