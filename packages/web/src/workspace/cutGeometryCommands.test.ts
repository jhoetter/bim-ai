import { beforeEach, describe, expect, it } from 'vitest';
import { useBimStore } from '../state/store';

// Simulate the applyCutGeometry handler logic from Workspace.tsx §3.3.4
function simulateApplyCutGeometry(cutterId: string, hostId: string): void {
  const { elementsById: cur } = useBimStore.getState();
  const host = cur[hostId] as any;
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
  const host = cur[hostId] as any;
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
      } as any,
    },
  });
});

describe('cut geometry commands — §3.3.4', () => {
  it('applyCutGeometry adds cutterId to host cutBy', () => {
    simulateApplyCutGeometry('col1', 'w1');
    const wall = useBimStore.getState().elementsById['w1'] as any;
    expect(wall.cutBy).toContain('col1');
  });

  it('applyCutGeometry deduplicates cutter IDs', () => {
    simulateApplyCutGeometry('col1', 'w1');
    simulateApplyCutGeometry('col1', 'w1');
    const wall = useBimStore.getState().elementsById['w1'] as any;
    expect(wall.cutBy.filter((id: string) => id === 'col1')).toHaveLength(1);
  });

  it('removeCutGeometry removes cutterId from host', () => {
    useBimStore.setState({
      elementsById: {
        w1: { ...useBimStore.getState().elementsById['w1'], cutBy: ['col1'] } as any,
      },
    });
    simulateRemoveCutGeometry('col1', 'w1');
    const wall = useBimStore.getState().elementsById['w1'] as any;
    expect(wall.cutBy ?? []).not.toContain('col1');
  });
});
