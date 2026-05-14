import { beforeEach, describe, expect, it } from 'vitest';

import { useBimStore } from './store';
import { STORE_SLICE_KEYS, storeSliceKeyEntries } from './storeSliceContracts';

beforeEach(() => {
  useBimStore.setState({
    selectedId: undefined,
    selectedIds: [],
    viewerMode: 'orbit_3d',
    viewerCategoryHidden: { site_origin: true },
    viewerLevelHidden: {},
    viewerClipElevMm: null,
    planTool: 'select',
    lensMode: 'architecture',
    wallDrawHeightMm: 2800,
    planPresentationPreset: 'default',
    presencePeers: {},
    comments: [],
    activityEvents: [],
    thinLinesEnabled: false,
    perspectiveId: 'architecture',
    activeWorkspaceId: 'arch',
    roofJoinPreview: null,
  });
});

describe('store slice contracts', () => {
  it('assigns each public store key to at most one concern slice', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];

    for (const { slice, key } of storeSliceKeyEntries()) {
      const prior = seen.get(key);
      if (prior) duplicates.push(`${key}:${prior}/${slice}`);
      seen.set(key, slice);
    }

    expect(duplicates).toEqual([]);
    expect(Object.keys(STORE_SLICE_KEYS)).toEqual([
      'model',
      'viewport',
      'planAuthoring',
      'collaboration',
      'workspaceUi',
    ]);
  });

  it('keeps model-slice selection mutations isolated', () => {
    useBimStore.getState().select('wall-1');
    expect(useBimStore.getState().selectedId).toBe('wall-1');

    useBimStore.getState().toggleSelectedId('door-1');
    expect(useBimStore.getState().selectedIds).toEqual(['door-1']);

    useBimStore.getState().toggleSelectedId('wall-1');
    expect(useBimStore.getState().selectedId).toBe('door-1');
    expect(useBimStore.getState().selectedIds).toEqual([]);

    useBimStore.getState().clearSelectedIds();
    expect(useBimStore.getState().selectedIds).toEqual([]);
  });

  it('keeps viewport-slice render mutations isolated', () => {
    const store = useBimStore.getState();

    store.setViewerMode('plan_canvas');
    store.setViewerClipElevMm(3200);
    store.toggleViewerCategoryHidden('wall');
    store.toggleViewerLevelHidden('lvl-1');

    expect(useBimStore.getState().viewerMode).toBe('plan_canvas');
    expect(useBimStore.getState().viewerClipElevMm).toBe(3200);
    expect(useBimStore.getState().viewerCategoryHidden.wall).toBe(true);
    expect(useBimStore.getState().viewerLevelHidden['lvl-1']).toBe(true);
  });

  it('keeps plan-authoring mutations isolated', () => {
    const store = useBimStore.getState();

    store.setPlanTool('wall');
    store.setLensMode('structure');
    store.setWallDrawHeightMm(3100);
    store.setWallDrawRadiusMm(750);
    store.setPlanPresentationPreset('room_scheme');

    expect(useBimStore.getState().planTool).toBe('wall');
    expect(useBimStore.getState().lensMode).toBe('structure');
    expect(useBimStore.getState().wallDrawHeightMm).toBe(3100);
    expect(useBimStore.getState().wallDrawRadiusMm).toBe(750);
    expect(useBimStore.getState().planPresentationPreset).toBe('room_scheme');
  });

  it('keeps collaboration mutations isolated', () => {
    const store = useBimStore.getState();

    store.setPresencePeers({ peer_a: { peerId: 'peer_a', name: 'Ada' } });
    store.mergeComment({
      id: 'c1',
      userDisplay: 'Ada',
      body: 'Check wall join',
      resolved: false,
      createdAt: '2026-05-10T00:00:00Z',
    });
    store.setActivity([
      {
        id: 1,
        userId: 'u1',
        revisionAfter: 2,
        createdAt: '2026-05-10T00:00:01Z',
        commandTypes: ['createWall'],
      },
    ]);

    expect(useBimStore.getState().presencePeers.peer_a?.name).toBe('Ada');
    expect(useBimStore.getState().comments).toHaveLength(1);
    expect(useBimStore.getState().activityEvents[0]?.commandTypes).toEqual(['createWall']);
  });

  it('keeps workspace-ui mutations isolated', () => {
    const store = useBimStore.getState();

    store.toggleThinLines();
    store.setPerspectiveId('coordination');
    store.setActiveWorkspaceId('struct');
    store.setRoofJoinPreview({
      primaryRoofId: 'roof-a',
      secondaryRoofId: 'roof-b',
      seamMode: 'clip_secondary_into_primary',
    });

    expect(useBimStore.getState().thinLinesEnabled).toBe(true);
    expect(useBimStore.getState().perspectiveId).toBe('coordination');
    expect(useBimStore.getState().activeWorkspaceId).toBe('struct');
    expect(useBimStore.getState().roofJoinPreview?.secondaryRoofId).toBe('roof-b');
  });
});
