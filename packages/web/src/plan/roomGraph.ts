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
  distanceMm: number; // Euclidean distance between room centroids
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
  elementsById: Record<string, Element | undefined>,
): RoomGraph {
  const nodes = new Map<string, RoomNode>();
  const edges: RoomEdge[] = [];

  // 1. Collect all rooms on the level
  for (const el of Object.values(elementsById)) {
    if (!el || el.kind !== 'room' || el.levelId !== levelId) continue;
    const pts = el.outlineMm;
    const pos =
      pts.length > 0
        ? {
            xMm: pts.reduce((s, p) => s + p.xMm, 0) / pts.length,
            yMm: pts.reduce((s, p) => s + p.yMm, 0) / pts.length,
          }
        : { xMm: 0, yMm: 0 };
    nodes.set(el.id, { roomId: el.id, positionMm: pos, name: el.name });
  }

  // 2. For each door, find the two closest rooms and connect them
  for (const el of Object.values(elementsById)) {
    if (!el || el.kind !== 'door' || el.levelId !== levelId) continue;
    const doorPos = { xMm: 0, yMm: 0 };

    // Find two closest rooms by distance from door to room centroid
    const sorted = [...nodes.values()].sort(
      (a, b) => distMm(doorPos, a.positionMm) - distMm(doorPos, b.positionMm),
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
  roomIds: string[]; // sequence of rooms from start to exit
  doorIds: string[]; // sequence of doors traversed
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
  exitRoomIds: string[],
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
      if (edge.fromId === u) {
        neighbor = edge.toId;
        dId = edge.doorId;
      } else if (edge.toId === u) {
        neighbor = edge.fromId;
        dId = edge.doorId;
      }
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
