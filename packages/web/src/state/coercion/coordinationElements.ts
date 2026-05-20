import type { Element } from '@bim-ai/core';

import { coerceNumber, type WireRecord } from './primitives';

type ClashTestElement = Extract<Element, { kind: 'clash_test' }>;
type ClashResult = NonNullable<ClashTestElement['results']>[number];

function listOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

function coerceClashResult(raw: WireRecord): ClashResult {
  return {
    elementIdA: String(raw.elementIdA ?? raw.element_id_a ?? ''),
    elementIdB: String(raw.elementIdB ?? raw.element_id_b ?? ''),
    distanceMm: coerceNumber(raw.distanceMm ?? raw.distance_mm, 0),
    ...(listOfStrings(raw.linkChainA ?? raw.link_chain_a).length
      ? { linkChainA: listOfStrings(raw.linkChainA ?? raw.link_chain_a) }
      : {}),
    ...(listOfStrings(raw.linkChainB ?? raw.link_chain_b).length
      ? { linkChainB: listOfStrings(raw.linkChainB ?? raw.link_chain_b) }
      : {}),
  };
}

function coerceClashResults(raw: unknown): ClashResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is WireRecord => item != null && typeof item === 'object')
    .map(coerceClashResult);
}

export function coerceCoordinationElement(
  id: string,
  name: string,
  raw: WireRecord,
): ClashTestElement | null {
  if (raw.kind !== 'clash_test') return null;
  const results = coerceClashResults(raw.results ?? []);
  return {
    kind: 'clash_test',
    id,
    name,
    setAIds: listOfStrings(raw.setAIds ?? raw.set_a_ids),
    setBIds: listOfStrings(raw.setBIds ?? raw.set_b_ids),
    toleranceMm: coerceNumber(raw.toleranceMm ?? raw.tolerance_mm, 50),
    ...(results.length ? { results } : {}),
  };
}
