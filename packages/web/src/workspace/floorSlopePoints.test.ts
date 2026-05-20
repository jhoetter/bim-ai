import { describe, expect, it, beforeEach } from 'vitest';
import { useBimStore } from '../state/store';
import type { FloorElem, FloorSlopePoint } from '@bim-ai/core';

type FloorElemPartial = {
  id: string;
  kind: 'floor';
  levelId: string;
  boundaryMm: { xMm: number; yMm: number }[];
  thicknessMm: number;
  slopePoints?: FloorSlopePoint[];
};

/** Simulate the addFloorSlopePoint handler from Workspace.tsx */
function simulateAddFloorSlopePoint(floorId: string, point: FloorSlopePoint) {
  const { elementsById: cur } = useBimStore.getState();
  const floor = cur[floorId];
  if (floor?.kind === 'floor') {
    useBimStore.setState({
      elementsById: {
        ...cur,
        [floor.id]: { ...floor, slopePoints: [...(floor.slopePoints ?? []), point] },
      },
    });
  }
}

/** Simulate the removeFloorSlopePoint handler from Workspace.tsx */
function simulateRemoveFloorSlopePoint(floorId: string, pointId: string) {
  const { elementsById: cur } = useBimStore.getState();
  const floor = cur[floorId];
  if (floor?.kind === 'floor') {
    useBimStore.setState({
      elementsById: {
        ...cur,
        [floor.id]: {
          ...floor,
          slopePoints: (floor.slopePoints ?? []).filter((p) => p.id !== pointId),
        },
      },
    });
  }
}

/** Simulate the updateFloorSlopePoint handler from Workspace.tsx */
function simulateUpdateFloorSlopePoint(
  floorId: string,
  pointId: string,
  elevationOffsetMm: number,
) {
  const { elementsById: cur } = useBimStore.getState();
  const floor = cur[floorId];
  if (floor?.kind === 'floor') {
    useBimStore.setState({
      elementsById: {
        ...cur,
        [floor.id]: {
          ...floor,
          slopePoints: (floor.slopePoints ?? []).map((p) =>
            p.id === pointId ? { ...p, elevationOffsetMm } : p,
          ),
        },
      },
    });
  }
}

beforeEach(() => {
  useBimStore.setState({
    elementsById: {
      f1: {
        id: 'f1',
        kind: 'floor',
        levelId: 'L1',
        boundaryMm: [],
        thicknessMm: 200,
      } as FloorElemPartial as never,
    },
  });
});

describe('Floor slope points — §3.4.2', () => {
  it('addFloorSlopePoint adds a point to the floor', () => {
    simulateAddFloorSlopePoint('f1', { id: 'sp1', xMm: 1000, yMm: 2000, elevationOffsetMm: -50 });
    const floor = useBimStore.getState().elementsById['f1'] as FloorElemPartial;
    expect(floor.slopePoints).toHaveLength(1);
    expect(floor.slopePoints?.[0]?.id).toBe('sp1');
  });

  it('removeFloorSlopePoint removes by id', () => {
    useBimStore.setState({
      elementsById: {
        f1: {
          id: 'f1',
          kind: 'floor',
          levelId: 'L1',
          boundaryMm: [],
          thicknessMm: 200,
          slopePoints: [{ id: 'sp1', xMm: 0, yMm: 0, elevationOffsetMm: -50 }],
        } as FloorElemPartial as never,
      },
    });
    simulateRemoveFloorSlopePoint('f1', 'sp1');
    const floor = useBimStore.getState().elementsById['f1'] as FloorElemPartial;
    expect(floor.slopePoints).toHaveLength(0);
  });

  it('updateFloorSlopePoint changes elevationOffsetMm', () => {
    useBimStore.setState({
      elementsById: {
        f1: {
          id: 'f1',
          kind: 'floor',
          levelId: 'L1',
          boundaryMm: [],
          thicknessMm: 200,
          slopePoints: [{ id: 'sp1', xMm: 0, yMm: 0, elevationOffsetMm: -50 }],
        } as FloorElemPartial as never,
      },
    });
    simulateUpdateFloorSlopePoint('f1', 'sp1', -100);
    const floor = useBimStore.getState().elementsById['f1'] as FloorElemPartial;
    expect(floor.slopePoints?.[0]?.elevationOffsetMm).toBe(-100);
  });

  it('floor starts with no slopePoints', () => {
    const floor = useBimStore.getState().elementsById['f1'] as FloorElemPartial;
    expect(floor.slopePoints ?? []).toHaveLength(0);
  });

  it('floorSlopePointsPlanThree returns null for floor with no points', async () => {
    const { floorSlopePointsPlanThree } = await import('../plan/floorSlopePlanThree');
    const floor = { id: 'f1', kind: 'floor', slopePoints: [] } as unknown as FloorElem;
    expect(floorSlopePointsPlanThree(floor)).toBeNull();
  });
});
