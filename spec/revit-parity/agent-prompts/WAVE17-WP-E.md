# Wave 17 — WP-E: Route / Egress Analysis (§13.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — room + door element types
packages/web/src/plan/symbology.ts                  — plan symbols (for path overlay)
packages/web/src/cmdPalette/defaultCommands.ts      — palette commands
packages/web/src/workspace/commandCapabilities.ts   — capability graph
packages/web/src/workspace/Workspace.tsx             — handlers
```

Search for `egress`, `routeAnalysis`, `roomGraph`, `pathfinding`, `dijkstra` in the codebase first.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: find `room` element — read fields (`perimeterMm`, `positionMm`, `levelId`, `name`). Find `door` — read `hostWallId`, `positionMm`, `levelId`.
2. Search `symbology.ts` for any existing room-connectivity rendering.
3. Search `defaultCommands.ts` for `analysis` — read what commands already exist.

---

## Tasks

### A — `roomGraph.ts`

Create `packages/web/src/plan/roomGraph.ts`:

```ts
import type { Element } from '@bim-ai/core';

export type RoomNode = {
  roomId: string;
  positionMm: { xMm: number; yMm: number };
  name: string;
};

export type RoomEdge = {
  fromId: string;
  toId: string;
  doorId: string;
  distanceMm: number;   // Euclidean distance between room centroids
};

export type RoomGraph = {
  nodes: Map<string, RoomNode>;
  edges: RoomEdge[];
};

/**
 * Builds a room adjacency graph from room and door elements on a level.
 * Two rooms are connected if a door element is positioned within 500mm
 * of both rooms' perimeters (or within bounding boxes if no perimeter).
 */
export function buildRoomGraph(
  levelId: string,
  elementsById: Record<string, Element | undefined>
): RoomGraph {
  const nodes = new Map<string, RoomNode>();
  const edges: RoomEdge[] = [];

  // 1. Collect all rooms on the level
  for (const el of Object.values(elementsById)) {
    if (!el || el.kind !== 'room' || el.levelId !== levelId) continue;
    const pos = (el as any).positionMm ?? { xMm: 0, yMm: 0 };
    nodes.set(el.id, { roomId: el.id, positionMm: pos, name: (el as any).name ?? 'Room' });
  }

  // 2. For each door, find the two closest rooms and connect them
  for (const el of Object.values(elementsById)) {
    if (!el || el.kind !== 'door' || (el as any).levelId !== levelId) continue;
    const doorPos = (el as any).positionMm ?? { xMm: 0, yMm: 0 };

    // Find two closest rooms by distance from door to room centroid
    const sorted = [...nodes.values()].sort((a, b) =>
      distMm(doorPos, a.positionMm) - distMm(doorPos, b.positionMm)
    );

    if (sorted.length >= 2) {
      const from = sorted[0];
      const to = sorted[1];
      edges.push({
        fromId: from.roomId,
        toId: to.roomId,
        doorId: el.id,
        distanceMm: distMm(from.positionMm, to.positionMm),
      });
    }
  }

  return { nodes, edges };
}

function distMm(a: { xMm: number; yMm: number }, b: { xMm: number; yMm: number }): number {
  return Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm);
}

export type EgressPath = {
  roomIds: string[];       // sequence of rooms from start to exit
  doorIds: string[];       // sequence of doors traversed
  totalDistanceMm: number;
};

/**
 * Dijkstra shortest path from startRoomId to the nearest exitRoomId.
 * exitRoomIds: set of room IDs that represent exits (e.g. rooms tagged as 'Exterior' or 'Exit').
 * If exitRoomIds is empty, uses all rooms adjacent to the boundary (rooms with 'exit' in name).
 */
export function computeEgressPath(
  startRoomId: string,
  graph: RoomGraph,
  exitRoomIds: string[]
): EgressPath | null {
  // Dijkstra implementation
  const dist = new Map<string, number>();
  const prev = new Map<string, { roomId: string; doorId: string } | null>();
  const visited = new Set<string>();

  for (const id of graph.nodes.keys()) {
    dist.set(id, Infinity);
  }
  dist.set(startRoomId, 0);
  prev.set(startRoomId, null);

  while (true) {
    // Pick unvisited node with minimum distance
    let u: string | null = null;
    let minDist = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < minDist) {
        minDist = d;
        u = id;
      }
    }
    if (!u) break;
    if (exitRoomIds.includes(u)) {
      // Reconstruct path
      const roomIds: string[] = [];
      const doorIds: string[] = [];
      let cur: string | null = u;
      while (cur !== null) {
        roomIds.unshift(cur);
        const p = prev.get(cur);
        if (p) {
          doorIds.unshift(p.doorId);
          cur = p.roomId;
        } else {
          cur = null;
        }
      }
      return { roomIds, doorIds, totalDistanceMm: minDist };
    }
    visited.add(u);

    // Relax neighbours
    for (const edge of graph.edges) {
      let neighbor: string | null = null;
      let dId: string | null = null;
      if (edge.fromId === u) { neighbor = edge.toId; dId = edge.doorId; }
      else if (edge.toId === u) { neighbor = edge.fromId; dId = edge.doorId; }
      if (!neighbor || !dId || visited.has(neighbor)) continue;

      const alt = (dist.get(u) ?? Infinity) + edge.distanceMm;
      if (alt < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, alt);
        prev.set(neighbor, { roomId: u, doorId: dId });
      }
    }
  }
  return null; // no path found
}
```

---

### B — Egress path plan overlay in `symbology.ts`

Add a function to render an egress path overlay:

```ts
export function buildEgressPathOverlay(
  path: EgressPath,
  graph: RoomGraph,
  scene: THREE.Group
): void {
  // Draw thick green line connecting room centroids in order
  const points = path.roomIds
    .map(id => graph.nodes.get(id)?.positionMm)
    .filter(Boolean)
    .map(p => new THREE.Vector3(p!.xMm / 1000, PLAN_Y + 0.005, p!.yMm / 1000));

  if (points.length < 2) return;

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: '#22c55e', linewidth: 3 });
  const line = new THREE.Line(geo, mat);
  line.userData.egressPath = true;
  scene.add(line);

  // Draw green circles at each room centroid
  for (const pt of points) {
    const cGeo = new THREE.CircleGeometry(0.12, 12);
    const cMat = new THREE.MeshBasicMaterial({
      color: '#22c55e', transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    });
    const circle = new THREE.Mesh(cGeo, cMat);
    circle.position.copy(pt);
    circle.rotation.x = -Math.PI / 2;
    circle.userData.egressNode = true;
    scene.add(circle);
  }
}
```

---

### C — EgressAnalysisPanel component

Create `packages/web/src/workspace/EgressAnalysisPanel.tsx`:

```tsx
import React, { useState } from 'react';
import type { RoomNode, EgressPath } from '../plan/roomGraph';

interface Props {
  rooms: RoomNode[];
  onRun: (startRoomId: string, exitRoomIds: string[]) => EgressPath | null;
  onClose: () => void;
}

export function EgressAnalysisPanel({ rooms, onRun, onClose }: Props) {
  const [startId, setStartId] = useState(rooms[0]?.roomId ?? '');
  const [result, setResult] = useState<EgressPath | null | 'none'>(null);

  const exitRooms = rooms.filter(r => /exit|exterior|ausgang/i.test(r.name));

  const run = () => {
    const path = onRun(startId, exitRooms.map(r => r.roomId));
    setResult(path ?? 'none');
  };

  return (
    <div data-testid="egress-analysis-panel"
      style={{ padding: 16, background: '#fff', border: '1px solid #ccc', borderRadius: 6 }}>
      <h4>Egress Analysis</h4>
      <label>Start room:
        <select data-testid="egress-start-room" value={startId}
          onChange={e => setStartId(e.target.value)}>
          {rooms.map(r => <option key={r.roomId} value={r.roomId}>{r.name}</option>)}
        </select>
      </label>
      <div style={{ fontSize: 11, color: '#666' }}>
        Exit rooms: {exitRooms.map(r => r.name).join(', ') || '(none — label rooms "Exit" or "Ausgang")'}
      </div>
      <button data-testid="egress-run-btn" onClick={run}>Run Analysis</button>
      <button data-testid="egress-close-btn" onClick={onClose}>Close</button>
      {result === 'none' && (
        <p data-testid="egress-no-path" style={{ color: '#ef4444' }}>No egress path found.</p>
      )}
      {result && result !== 'none' && (
        <p data-testid="egress-path-result" style={{ color: '#22c55e' }}>
          Path: {result.roomIds.length} rooms, {(result.totalDistanceMm / 1000).toFixed(1)}m
        </p>
      )}
    </div>
  );
}
```

---

### D — Palette command + Workspace handler

In `defaultCommands.ts`:
```ts
{
  id: 'analysis.egress',
  label: 'Egress Analysis…',
  keywords: ['egress', 'escape', 'route', 'analysis', 'accessibility', 'path'],
  category: 'command',
  invoke: (ctx) => ctx.openEgressAnalysis?.(),
},
```

In `Workspace.tsx`, add handler and state for `egressAnalysisOpen`.

---

### E — Capability graph

In `commandCapabilities.ts`:
```ts
{ id: 'analysis.egress', scope: 'document', intendedModes: ['plan'], precondition: null },
```

---

### F — Tests

`packages/web/src/plan/roomGraph.test.ts`:
```ts
describe('buildRoomGraph — §13.4', () => {
  it('returns empty graph when no rooms', () => { ... });
  it('creates a node per room', () => { ... });
  it('creates an edge when a door is between two rooms', () => { ... });
  it('edge distanceMm is Euclidean distance between centroids', () => { ... });
});

describe('computeEgressPath — §13.4', () => {
  it('returns null when no path exists', () => { ... });
  it('returns path with roomIds and doorIds when path exists', () => { ... });
  it('totalDistanceMm equals sum of edge distances along path', () => { ... });
  it('finds shortest path in a 3-room chain', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave17/E): egress analysis — room graph + Dijkstra pathfinding + plan overlay (§13.4)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new egress analysis tests.
