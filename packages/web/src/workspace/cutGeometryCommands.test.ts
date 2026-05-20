import { beforeEach, describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { useBimStore } from '../state/store';

type CuttableWall = Extract<Element, { kind: 'wall' }> & { cutBy?: string[] };

// Simulate the applyCutGeometry handler logic from Workspace.tsx §3.3.4
function simulateApplyCutGeometry(cutterId: string, hostId: string): void {
  const { elementsById: cur } = useBimStore.getState();
  const host = cur[hostId] as CuttableWall | undefined;
  if (host) {
    useBimStore.setState({
      elementsById: {
        ...cur,
        [host.id]: {
          ...host,
          cutBy: [...new Set([...(host.cutBy ?? []), cutterId])],
        },
      },
    });
  }
}

// Simulate the removeCutGeometry handler logic from Workspace.tsx §3.3.4
function simulateRemoveCutGeometry(cutterId: string, hostId: string): void {
  const { elementsById: cur } = useBimStore.getState();
  const host = cur[hostId] as CuttableWall | undefined;
  if (host) {
    useBimStore.setState({
      elementsById: {
        ...cur,
        [host.id]: {
          ...host,
          cutBy: (host.cutBy ?? []).filter((id: string) => id !== cutterId),
        },
      },
    });
  }
}

beforeEach(() => {
  useBimStore.setState({
    elementsById: {
      w1: {
        id: 'w1',
        kind: 'wall',
        levelId: 'L1',
        startMm: { xMm: 0, yMm: 0 },
        endMm: { xMm: 5000, yMm: 0 },
        thicknessMm: 200,
      } as unknown as Element,
    },
  });
});

describe('cut geometry commands — §3.3.4', () => {
  it('applyCutGeometry adds cutterId to host cutBy', () => {
    simulateApplyCutGeometry('col1', 'w1');
    const wall = useBimStore.getState().elementsById['w1'] as CuttableWall;
    expect(wall.cutBy).toContain('col1');
  });

  it('applyCutGeometry deduplicates cutter IDs', () => {
    simulateApplyCutGeometry('col1', 'w1');
    simulateApplyCutGeometry('col1', 'w1');
    const wall = useBimStore.getState().elementsById['w1'] as CuttableWall;
    expect((wall.cutBy ?? []).filter((id: string) => id === 'col1')).toHaveLength(1);
  });

  it('removeCutGeometry removes cutterId from host', () => {
    useBimStore.setState({
      elementsById: {
        w1: {
          ...(useBimStore.getState().elementsById['w1'] as CuttableWall),
          cutBy: ['col1'],
        } as Element,
      },
    });
    simulateRemoveCutGeometry('col1', 'w1');
    const wall = useBimStore.getState().elementsById['w1'] as CuttableWall;
    expect(wall.cutBy ?? []).not.toContain('col1');
  });
});
