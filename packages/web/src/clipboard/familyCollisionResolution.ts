/**
 * FAM-10 — family-id collision resolution on cross-project paste.
 *
 * When the receiving project already has a family with the same id as
 * the source, the paste flow can't blindly drop in the source family
 * (it could overwrite local edits). The user picks one of three
 * strategies; this module turns the chosen strategy into a concrete
 * (familyDefinitions, elements) pair the caller can apply.
 *
 *   - 'use_source' — overwrite local definitions with source's
 *   - 'keep_local' — drop source-side family defs; rewrite element
 *      refs that point at colliding ids to point at the local family
 *      (which is what the receiving project already had)
 *   - 'rename'     — append `_imported` to colliding source families
 *      and rewrite element refs to point at the renamed copies; local
 *      definitions are preserved
 */
import type { Element } from '@bim-ai/core';
import type { FamilyDefinition, FamilyGeometryNode } from '../families/types';

export type FamilyCollisionStrategy = 'use_source' | 'keep_local' | 'rename';

export const RENAME_SUFFIX = '_imported';

export interface CollisionResolutionInput {
  /** Family defs carried by the clipboard payload. */
  sourceFamilies: FamilyDefinition[];
  /** Elements carried by the clipboard payload. */
  elements: Element[];
  /** Family defs the *receiving* project already knows about. Only the
   *  ids are inspected, but full defs are accepted to keep call sites
   *  ergonomic. */
  localFamilies: FamilyDefinition[];
  strategy: FamilyCollisionStrategy;
}

export interface CollisionResolutionResult {
  /** Family defs the caller should now register in the receiving
   *  project. May be empty (if 'keep_local'). */
  familiesToImport: FamilyDefinition[];
  /** Elements with any colliding family-id refs rewritten according to
   *  the chosen strategy. */
  elements: Element[];
  /** Pairs of `(originalId, newId)` for caller logging / UI confirmation. */
  renames: Array<{ from: string; to: string }>;
}

/**
 * Resolve the collision per strategy. Pure function — no localStorage,
 * no store mutation. Caller wires the result into the receiving
 * project's catalog + element graph.
 */
export function resolveFamilyCollisions(
  input: CollisionResolutionInput,
): CollisionResolutionResult {
  const localIds = new Set(input.localFamilies.map((f) => f.id));
  const collidingIds = input.sourceFamilies.map((f) => f.id).filter((id) => localIds.has(id));

  if (collidingIds.length === 0) {
    // Nothing to resolve — pass through.
    return {
      familiesToImport: input.sourceFamilies,
      elements: input.elements,
      renames: [],
    };
  }

  if (input.strategy === 'use_source') {
    return {
      familiesToImport: input.sourceFamilies,
      elements: input.elements,
      renames: [],
    };
  }

  if (input.strategy === 'keep_local') {
    // Drop the colliding source defs entirely. Element refs already
    // point at the colliding id, which now resolves to the local def.
    const filtered = input.sourceFamilies.filter((f) => !collidingIds.includes(f.id));
    return {
      familiesToImport: filtered,
      elements: input.elements,
      renames: [],
    };
  }

  // 'rename' — generate fresh ids for colliding source defs and rewrite
  // every element + nested-family ref pointing at the original.
  const renameMap = new Map<string, string>();
  for (const collidingId of collidingIds) {
    let candidate = `${collidingId}${RENAME_SUFFIX}`;
    let i = 1;
    while (localIds.has(candidate) || isUsedInRenames(renameMap, candidate)) {
      i += 1;
      candidate = `${collidingId}${RENAME_SUFFIX}${i}`;
    }
    renameMap.set(collidingId, candidate);
  }

  const renamedFamilies = input.sourceFamilies.map((def) =>
    renameMap.has(def.id) || hasNestedRename(def, renameMap)
      ? renameFamilyDefinition(def, renameMap)
      : def,
  );
  const renamedElements = input.elements.map((el) => renameElementFamilyRef(el, renameMap));
  return {
    familiesToImport: renamedFamilies,
    elements: renamedElements,
    renames: Array.from(renameMap.entries()).map(([from, to]) => ({ from, to })),
  };
}

function isUsedInRenames(map: Map<string, string>, candidate: string): boolean {
  for (const v of map.values()) if (v === candidate) return true;
  return false;
}

function hasNestedRename(def: FamilyDefinition, renameMap: Map<string, string>): boolean {
  if (!def.geometry) return false;
  for (const node of def.geometry) {
    if (node.kind === 'family_instance_ref' && renameMap.has(node.familyId)) return true;
    if (node.kind === 'array' && renameMap.has(node.target.familyId)) return true;
  }
  return false;
}

function renameFamilyDefinition(
  def: FamilyDefinition,
  renameMap: Map<string, string>,
): FamilyDefinition {
  const nextId = renameMap.get(def.id) ?? def.id;
  const next: FamilyDefinition = {
    ...def,
    id: nextId,
    defaultTypes: def.defaultTypes.map((t) =>
      t.familyId === def.id ? { ...t, familyId: nextId } : t,
    ),
  };
  if (def.geometry) {
    next.geometry = def.geometry.map((n) => renameGeometryNode(n, renameMap));
  }
  return next;
}

function renameGeometryNode(
  node: FamilyGeometryNode,
  renameMap: Map<string, string>,
): FamilyGeometryNode {
  if (node.kind === 'family_instance_ref') {
    const next = renameMap.get(node.familyId);
    return next ? { ...node, familyId: next } : node;
  }
  if (node.kind === 'array') {
    const next = renameMap.get(node.target.familyId);
    return next ? { ...node, target: { ...node.target, familyId: next } } : node;
  }
  return node;
}

function renameElementFamilyRef(el: Element, renameMap: Map<string, string>): Element {
  const obj = el as unknown as Record<string, unknown>;
  let mutated: Record<string, unknown> | null = null;
  const fid = obj['familyId'];
  if (typeof fid === 'string' && renameMap.has(fid)) {
    mutated = { ...obj, familyId: renameMap.get(fid) };
  }
  const tid = obj['typeId'];
  if (typeof tid === 'string' && renameMap.has(tid)) {
    mutated = { ...(mutated ?? obj), typeId: renameMap.get(tid) };
  }
  return (mutated ?? obj) as Element;
}
