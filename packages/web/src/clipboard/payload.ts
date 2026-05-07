/**
 * FAM-10 — clipboard payload format.
 *
 * One canonical envelope `bim-ai-clipboard-v1` carries selected elements
 * plus the (transitive) family definitions they reference. The format
 * is the only thing serialized to localStorage AND to
 * navigator.clipboard, so a copy from one browser tab is paste-able in
 * another tab — even from a different project — without any backend
 * round-trip.
 */
import type { Element } from '@bim-ai/core';
import type { FamilyDefinition } from '../families/types';

export const CLIPBOARD_FORMAT = 'bim-ai-clipboard-v1';
export const CLIPBOARD_STORAGE_KEY = 'bim-ai:clipboard';

export interface ClipboardPayload {
  format: typeof CLIPBOARD_FORMAT;
  sourceProjectId: string;
  sourceModelId: string;
  elements: Element[];
  familyDefinitions: FamilyDefinition[];
  /** ISO-8601 UTC timestamp at copy time. */
  timestamp: string;
}

/**
 * Build a payload from the live model state.
 *
 * The caller filters the selected element set; we walk those elements
 * and extract the family-id graph reachable from them so the receiving
 * project can re-create the families even if they are not yet in its
 * own catalog.
 */
export function buildClipboardPayload(args: {
  sourceProjectId: string;
  sourceModelId: string;
  elements: Element[];
  resolveFamilyById: (familyId: string) => FamilyDefinition | undefined;
}): ClipboardPayload {
  const familyIds = collectFamilyReferences(args.elements, args.resolveFamilyById);
  const familyDefinitions: FamilyDefinition[] = [];
  for (const id of familyIds) {
    const def = args.resolveFamilyById(id);
    if (def) familyDefinitions.push(def);
  }
  return {
    format: CLIPBOARD_FORMAT,
    sourceProjectId: args.sourceProjectId,
    sourceModelId: args.sourceModelId,
    elements: args.elements,
    familyDefinitions,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Walk an element list + a family resolver to determine the transitive
 * set of family ids needed to reproduce the elements in another
 * project. Handles `family_instance_ref` and `array` nested-family
 * references in family geometry trees.
 */
export function collectFamilyReferences(
  elements: Element[],
  resolveFamilyById: (familyId: string) => FamilyDefinition | undefined,
): string[] {
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const el of elements) {
    const fid = elementFamilyId(el);
    if (fid && !seen.has(fid)) {
      seen.add(fid);
      queue.push(fid);
    }
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    const def = resolveFamilyById(id);
    if (!def?.geometry) continue;
    for (const node of def.geometry) {
      let nestedId: string | undefined;
      if (node.kind === 'family_instance_ref') nestedId = node.familyId;
      else if (node.kind === 'array') nestedId = node.target.familyId;
      if (nestedId && !seen.has(nestedId)) {
        seen.add(nestedId);
        queue.push(nestedId);
      }
    }
  }
  return Array.from(seen);
}

function elementFamilyId(el: Element): string | undefined {
  // Different element kinds reference families through different fields;
  // walk the common shapes we currently emit. Out-of-band element kinds
  // can extend this later — missing references are a no-op for the
  // copy/paste flow.
  const candidate = (el as unknown as Record<string, unknown>)['familyId'];
  if (typeof candidate === 'string') return candidate;
  const typeId = (el as unknown as Record<string, unknown>)['typeId'];
  if (typeof typeId === 'string') return typeId;
  return undefined;
}

/**
 * Defensive parse — returns null on shape mismatch instead of throwing
 * so the consumer can render a friendly "clipboard empty" UI when the
 * stored value is from an older/foreign format.
 */
export function parseClipboardPayload(raw: string | null | undefined): ClipboardPayload | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof json !== 'object' || json === null) return null;
  const obj = json as Record<string, unknown>;
  if (obj.format !== CLIPBOARD_FORMAT) return null;
  if (typeof obj.sourceProjectId !== 'string') return null;
  if (typeof obj.sourceModelId !== 'string') return null;
  if (!Array.isArray(obj.elements)) return null;
  if (!Array.isArray(obj.familyDefinitions)) return null;
  if (typeof obj.timestamp !== 'string') return null;
  return {
    format: CLIPBOARD_FORMAT,
    sourceProjectId: obj.sourceProjectId,
    sourceModelId: obj.sourceModelId,
    elements: obj.elements as Element[],
    familyDefinitions: obj.familyDefinitions as FamilyDefinition[],
    timestamp: obj.timestamp,
  };
}
