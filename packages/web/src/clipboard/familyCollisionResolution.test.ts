/**
 * FAM-10 — family-id collision resolution strategies.
 */
import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import type { FamilyDefinition } from '../families/types';
import { RENAME_SUFFIX, resolveFamilyCollisions } from './familyCollisionResolution';

function fam(id: string, opts: { nestedRef?: string } = {}): FamilyDefinition {
  return {
    id,
    name: id,
    discipline: 'door',
    params: [],
    defaultTypes: [],
    geometry: opts.nestedRef
      ? [
          {
            kind: 'family_instance_ref',
            familyId: opts.nestedRef,
            positionMm: { xMm: 0, yMm: 0, zMm: 0 },
            rotationDeg: 0,
            parameterBindings: {},
          },
        ]
      : [],
  };
}

function elementWithFamily(id: string, familyId: string): Element {
  return { id, kind: 'door', familyId } as unknown as Element;
}

describe('FAM-10 collision resolution', () => {
  it('no collisions → pass-through', () => {
    const result = resolveFamilyCollisions({
      sourceFamilies: [fam('fam:chair')],
      elements: [elementWithFamily('el-1', 'fam:chair')],
      localFamilies: [fam('fam:other')],
      strategy: 'use_source',
    });
    expect(result.familiesToImport).toHaveLength(1);
    expect(result.renames).toHaveLength(0);
    expect(result.elements).toHaveLength(1);
  });

  it("'use_source' overwrites local with source", () => {
    const result = resolveFamilyCollisions({
      sourceFamilies: [fam('fam:chair')],
      elements: [elementWithFamily('el-1', 'fam:chair')],
      localFamilies: [fam('fam:chair')],
      strategy: 'use_source',
    });
    expect(result.familiesToImport.map((f) => f.id)).toEqual(['fam:chair']);
    expect(result.renames).toHaveLength(0);
  });

  it("'keep_local' drops source defs and leaves elements pointing at the existing id", () => {
    const result = resolveFamilyCollisions({
      sourceFamilies: [fam('fam:chair'), fam('fam:novel')],
      elements: [elementWithFamily('el-1', 'fam:chair')],
      localFamilies: [fam('fam:chair')],
      strategy: 'keep_local',
    });
    // Colliding family is dropped; novel one is kept.
    expect(result.familiesToImport.map((f) => f.id)).toEqual(['fam:novel']);
    expect((result.elements[0] as unknown as { familyId: string }).familyId).toBe('fam:chair');
    expect(result.renames).toHaveLength(0);
  });

  it("'rename' suffixes colliding ids and rewrites element refs", () => {
    const result = resolveFamilyCollisions({
      sourceFamilies: [fam('fam:chair'), fam('fam:novel')],
      elements: [elementWithFamily('el-1', 'fam:chair'), elementWithFamily('el-2', 'fam:novel')],
      localFamilies: [fam('fam:chair')],
      strategy: 'rename',
    });
    const importedIds = result.familiesToImport.map((f) => f.id).sort();
    expect(importedIds).toEqual([`fam:chair${RENAME_SUFFIX}`, 'fam:novel']);
    expect(result.renames).toEqual([{ from: 'fam:chair', to: `fam:chair${RENAME_SUFFIX}` }]);
    const fid = (result.elements[0] as unknown as { familyId: string }).familyId;
    expect(fid).toBe(`fam:chair${RENAME_SUFFIX}`);
    // Non-colliding element ref is untouched.
    const fid2 = (result.elements[1] as unknown as { familyId: string }).familyId;
    expect(fid2).toBe('fam:novel');
  });

  it("'rename' rewrites nested family_instance_ref pointers in renamed defs", () => {
    const tableUsesChair = fam('fam:table', { nestedRef: 'fam:chair' });
    const result = resolveFamilyCollisions({
      sourceFamilies: [fam('fam:chair'), tableUsesChair],
      elements: [elementWithFamily('el-1', 'fam:table')],
      localFamilies: [fam('fam:chair'), fam('fam:table')],
      strategy: 'rename',
    });
    const renamedTable = result.familiesToImport.find((f) => f.id === `fam:table${RENAME_SUFFIX}`);
    expect(renamedTable).toBeTruthy();
    const node = renamedTable!.geometry?.[0];
    expect(node?.kind).toBe('family_instance_ref');
    if (node?.kind === 'family_instance_ref') {
      expect(node.familyId).toBe(`fam:chair${RENAME_SUFFIX}`);
    }
  });

  it("'rename' avoids reusing an id that is also locally taken", () => {
    const result = resolveFamilyCollisions({
      sourceFamilies: [fam('fam:chair')],
      elements: [],
      localFamilies: [fam('fam:chair'), fam(`fam:chair${RENAME_SUFFIX}`)],
      strategy: 'rename',
    });
    const renamed = result.familiesToImport[0]?.id;
    expect(renamed).toBe(`fam:chair${RENAME_SUFFIX}2`);
  });
});
