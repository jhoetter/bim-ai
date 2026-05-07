/**
 * FAM-10 — high-level copy/paste glue.
 *
 * Orchestrates {@link buildClipboardPayload}, the persistence layer,
 * and the family-id collision resolver. Returns a result object the
 * caller wires into the receiving project's element graph + family
 * catalog. Pure data flow — no DOM dependency.
 */
import type { Element } from '@bim-ai/core';
import type { FamilyDefinition } from '../families/types';
import { writeClipboard, readClipboard } from './clipboardStore';
import { buildClipboardPayload, type ClipboardPayload } from './payload';
import { resolveFamilyCollisions, type FamilyCollisionStrategy } from './familyCollisionResolution';

export interface CopyArgs {
  sourceProjectId: string;
  sourceModelId: string;
  elements: Element[];
  resolveFamilyById: (familyId: string) => FamilyDefinition | undefined;
}

/**
 * Build + persist a clipboard payload. Returns the payload so the
 * caller can use it for an immediate UI confirmation
 * ("Copied N elements to clipboard.").
 */
export function copyElementsToClipboard(args: CopyArgs): ClipboardPayload {
  const payload = buildClipboardPayload(args);
  writeClipboard(payload);
  return payload;
}

export interface PasteArgs {
  payload: ClipboardPayload;
  /** Receiving project's identity. Used to decide whether the paste is
   *  same-project (paste at cursor with offset) or cross-project
   *  (collision resolution). */
  targetProjectId: string;
  /** Family ids the receiving project already knows about. */
  localFamilies: FamilyDefinition[];
  /** Cursor anchor for same-project paste. Cross-project pastes ignore
   *  this and place at the source elements' authored positions. */
  cursorMm?: { xMm: number; yMm: number };
  /** Same-project pastes apply this offset (in mm) to keep the new
   *  elements visible relative to the originals. Default 200mm. */
  sameProjectOffsetMm?: number;
  /** Collision strategy for cross-project paste. Default 'keep_local'. */
  strategy?: FamilyCollisionStrategy;
}

export interface PasteResult {
  /** New elements (with fresh ids) ready to merge into elementsById. */
  elements: Element[];
  /** Family defs to register in the receiving project's catalog. */
  familiesToImport: FamilyDefinition[];
  /** Renames performed (only non-empty when strategy === 'rename'). */
  renames: Array<{ from: string; to: string }>;
  /** True when the paste is from the same source project (same project
   *  + same model id). */
  sameProject: boolean;
}

/**
 * Resolve a clipboard payload into ready-to-apply elements + families.
 *
 * Same-project paste: keep ids stable for the family graph but assign
 * fresh element ids and offset positions so the duplicate doesn't sit
 * exactly on top of the source.
 *
 * Cross-project paste: re-issue element ids; resolve family
 * collisions per `strategy`. Element positions are unchanged so the
 * new project receives the same authored placement.
 */
export function pasteElementsFromClipboard(args: PasteArgs): PasteResult {
  const sameProject = args.payload.sourceProjectId === args.targetProjectId;
  const offset = args.sameProjectOffsetMm ?? 200;

  if (sameProject) {
    const elements = args.payload.elements.map((el, i) =>
      shiftElement(reassignElementId(el, i), offset, args.cursorMm),
    );
    return {
      elements,
      familiesToImport: [],
      renames: [],
      sameProject: true,
    };
  }

  const resolution = resolveFamilyCollisions({
    sourceFamilies: args.payload.familyDefinitions,
    elements: args.payload.elements,
    localFamilies: args.localFamilies,
    strategy: args.strategy ?? 'keep_local',
  });
  const elements = resolution.elements.map((el, i) => reassignElementId(el, i));
  return {
    elements,
    familiesToImport: resolution.familiesToImport,
    renames: resolution.renames,
    sameProject: false,
  };
}

/**
 * Async paste — convenience for keyboard handlers that need the
 * navigator.clipboard fallback. Returns null when the clipboard is
 * empty / contains a foreign payload.
 */
export async function pasteFromOSClipboard(
  args: Omit<PasteArgs, 'payload'>,
): Promise<PasteResult | null> {
  const payload = await readClipboard();
  if (!payload) return null;
  return pasteElementsFromClipboard({ ...args, payload });
}

function reassignElementId(el: Element, salt: number): Element {
  const obj = el as unknown as Record<string, unknown>;
  const oldId = typeof obj['id'] === 'string' ? (obj['id'] as string) : 'el';
  const fresh =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${oldId}-paste-${Date.now()}-${salt}`;
  return { ...obj, id: fresh } as Element;
}

function shiftElement(
  el: Element,
  offsetMm: number,
  cursorMm: { xMm: number; yMm: number } | undefined,
): Element {
  const obj = el as unknown as Record<string, unknown>;
  const next = { ...obj };
  let mutated = false;
  // When a cursor anchor is provided, offset by `(cursor - 0)` so the
  // pasted set lands near the cursor; otherwise apply a fixed offset
  // along both axes so the duplicate isn't directly under the original.
  const dx = cursorMm ? cursorMm.xMm : offsetMm;
  const dy = cursorMm ? cursorMm.yMm : offsetMm;
  for (const key of ['xMm', 'centerXMm', 'startXMm']) {
    if (typeof next[key] === 'number') {
      next[key] = (next[key] as number) + dx;
      mutated = true;
    }
  }
  for (const key of ['yMm', 'centerYMm', 'startYMm']) {
    if (typeof next[key] === 'number') {
      next[key] = (next[key] as number) + dy;
      mutated = true;
    }
  }
  return (mutated ? (next as Element) : el) as Element;
}
