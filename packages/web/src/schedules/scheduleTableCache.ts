/**
 * PERF-F05: tiny client-side cache for /schedules/{id}/table responses
 * keyed by (modelId, scheduleId, revision, lightweight). Pairs with the
 * PERF-F04 server cache so opening the same schedule twice (or two
 * panels referencing the same schedule) does not refetch.
 *
 * Eviction is LRU bounded; entries are dropped automatically when a
 * later revision lookup occurs, so memory grows linearly only in the
 * number of distinct (schedule, revision) pairs the session visits.
 */

type CacheKey = string;
type CacheValue = Record<string, unknown>;

const MAX_ENTRIES = 64;
const cache: Map<CacheKey, CacheValue> = new Map();

function makeKey(
  modelId: string,
  scheduleId: string,
  revision: number,
  lightweight: boolean,
): CacheKey {
  return `${modelId}|${scheduleId}|${revision}|${lightweight ? 'lw' : 'full'}`;
}

function touch(key: CacheKey, value: CacheValue): void {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export async function fetchScheduleTable(input: {
  modelId: string;
  scheduleId: string;
  revision: number;
  lightweight?: boolean;
  signal?: AbortSignal;
}): Promise<CacheValue> {
  const lw = input.lightweight === true;
  const key = makeKey(input.modelId, input.scheduleId, input.revision, lw);
  const cached = cache.get(key);
  if (cached !== undefined) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  const mid = encodeURIComponent(input.modelId);
  const sc = encodeURIComponent(input.scheduleId);
  const qs = lw ? '?lightweight=true' : '';
  const res = await fetch(`/api/models/${mid}/schedules/${sc}/table${qs}`, {
    signal: input.signal,
  });
  const txt = await res.text();
  const json = JSON.parse(txt) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(json.detail ?? txt));
  }
  touch(key, json);
  return json;
}

export function clearScheduleTableCache(): void {
  cache.clear();
}

export function scheduleTableCacheSize(): number {
  return cache.size;
}
