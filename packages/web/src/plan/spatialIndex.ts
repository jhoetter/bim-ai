/**
 * PERF-H02: simple grid-bucket spatial index for plan picking + snapping.
 *
 * Wraps an axis-aligned 2D grid keyed by integer cell coordinates so
 * point/range queries become O(candidates-in-nearby-cells) instead of
 * O(all elements). Today this is library infrastructure — `nearestWallAt`
 * and friends still iterate the modelIndices arrays. Once a large-plan
 * fixture is hydrated through the FE (paired with PERF-H05), the snap +
 * hover hot paths can switch to `WallSpatialIndex.queryNear()` without
 * touching the helper APIs.
 *
 * The index is immutable after construction: modelIndices already rebuilds
 * on every elementsById change (PERF-G03 invariant), so consumers can
 * memoize a fresh `WallSpatialIndex` keyed on revision + wallsByLevel.
 */

export type SpatialItem<T> = {
  /** Caller-supplied payload — typically an element id or the element itself. */
  payload: T;
  /** Axis-aligned bounding box in mm. */
  bbox: { xMinMm: number; yMinMm: number; xMaxMm: number; yMaxMm: number };
};

export type Segment = {
  startMm: { xMm: number; yMm: number };
  endMm: { xMm: number; yMm: number };
};

const DEFAULT_CELL_MM = 5_000;

export class WallSpatialIndex<T> {
  private readonly buckets: Map<string, Array<SpatialItem<T>>> = new Map();
  private readonly cellMm: number;

  constructor(items: Iterable<SpatialItem<T>>, cellMm: number = DEFAULT_CELL_MM) {
    if (cellMm <= 0) {
      throw new Error('WallSpatialIndex cellMm must be positive');
    }
    this.cellMm = cellMm;
    for (const item of items) {
      this.insert(item);
    }
  }

  private cellKey(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }

  private bucketRange(bbox: SpatialItem<T>['bbox']) {
    return {
      cxMin: Math.floor(bbox.xMinMm / this.cellMm),
      cyMin: Math.floor(bbox.yMinMm / this.cellMm),
      cxMax: Math.floor(bbox.xMaxMm / this.cellMm),
      cyMax: Math.floor(bbox.yMaxMm / this.cellMm),
    };
  }

  private insert(item: SpatialItem<T>): void {
    const range = this.bucketRange(item.bbox);
    for (let cx = range.cxMin; cx <= range.cxMax; cx++) {
      for (let cy = range.cyMin; cy <= range.cyMax; cy++) {
        const key = this.cellKey(cx, cy);
        const bucket = this.buckets.get(key);
        if (bucket) bucket.push(item);
        else this.buckets.set(key, [item]);
      }
    }
  }

  /** Return all items whose bbox overlaps `queryBbox`. Duplicates are removed. */
  queryRange(queryBbox: SpatialItem<T>['bbox']): T[] {
    const range = this.bucketRange(queryBbox);
    const seen = new Set<T>();
    const out: T[] = [];
    for (let cx = range.cxMin; cx <= range.cxMax; cx++) {
      for (let cy = range.cyMin; cy <= range.cyMax; cy++) {
        const bucket = this.buckets.get(this.cellKey(cx, cy));
        if (!bucket) continue;
        for (const item of bucket) {
          if (
            item.bbox.xMaxMm < queryBbox.xMinMm ||
            item.bbox.xMinMm > queryBbox.xMaxMm ||
            item.bbox.yMaxMm < queryBbox.yMinMm ||
            item.bbox.yMinMm > queryBbox.yMaxMm
          ) {
            continue;
          }
          if (seen.has(item.payload)) continue;
          seen.add(item.payload);
          out.push(item.payload);
        }
      }
    }
    return out;
  }

  /** Return items near a point — bbox of `radiusMm` around (xMm, yMm). */
  queryNear(xMm: number, yMm: number, radiusMm: number): T[] {
    return this.queryRange({
      xMinMm: xMm - radiusMm,
      yMinMm: yMm - radiusMm,
      xMaxMm: xMm + radiusMm,
      yMaxMm: yMm + radiusMm,
    });
  }

  /** Diagnostic: bucket count + average bucket size. */
  stats(): { buckets: number; itemsTotal: number; itemsAvgPerBucket: number; cellMm: number } {
    const buckets = this.buckets.size;
    let itemsTotal = 0;
    for (const bucket of this.buckets.values()) itemsTotal += bucket.length;
    return {
      buckets,
      itemsTotal,
      itemsAvgPerBucket: buckets === 0 ? 0 : itemsTotal / buckets,
      cellMm: this.cellMm,
    };
  }
}

/** Build a bbox from a 2-point segment, optionally inflated by `padMm`. */
export function bboxFromSegment(
  segment: Segment,
  padMm = 0,
): { xMinMm: number; yMinMm: number; xMaxMm: number; yMaxMm: number } {
  return {
    xMinMm: Math.min(segment.startMm.xMm, segment.endMm.xMm) - padMm,
    yMinMm: Math.min(segment.startMm.yMm, segment.endMm.yMm) - padMm,
    xMaxMm: Math.max(segment.startMm.xMm, segment.endMm.xMm) + padMm,
    yMaxMm: Math.max(segment.startMm.yMm, segment.endMm.yMm) + padMm,
  };
}
