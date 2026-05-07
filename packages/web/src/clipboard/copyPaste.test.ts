/**
 * FAM-10 — clipboard round-trip + same-project paste behaviour.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@bim-ai/core';
import type { FamilyDefinition } from '../families/types';
import {
  CLIPBOARD_FORMAT,
  CLIPBOARD_STORAGE_KEY,
  buildClipboardPayload,
  collectFamilyReferences,
  parseClipboardPayload,
} from './payload';
import { writeClipboard, readClipboardSync, clearClipboard } from './clipboardStore';
import { copyElementsToClipboard, pasteElementsFromClipboard } from './copyPaste';

function chairFamily(): FamilyDefinition {
  return {
    id: 'fam:chair',
    name: 'Chair',
    discipline: 'door',
    params: [],
    defaultTypes: [],
    geometry: [],
  };
}

function tableFamily(): FamilyDefinition {
  return {
    id: 'fam:table',
    name: 'Table',
    discipline: 'door',
    params: [],
    defaultTypes: [],
    geometry: [
      {
        kind: 'family_instance_ref',
        familyId: 'fam:chair',
        positionMm: { xMm: 600, yMm: 0, zMm: 0 },
        rotationDeg: 0,
        parameterBindings: {},
      },
    ],
  };
}

function makeChairElement(id: string, xMm = 100, yMm = 200): Element {
  return { id, kind: 'door', familyId: 'fam:chair', xMm, yMm } as unknown as Element;
}

beforeEach(() => {
  clearClipboard();
});

afterEach(() => {
  clearClipboard();
});

describe('FAM-10 buildClipboardPayload', () => {
  it('captures the elements + the transitive family graph', () => {
    const catalog = new Map<string, FamilyDefinition>();
    catalog.set('fam:chair', chairFamily());
    catalog.set('fam:table', tableFamily());
    const tableElement = { id: 'el-1', kind: 'door', familyId: 'fam:table' } as unknown as Element;
    const payload = buildClipboardPayload({
      sourceProjectId: 'proj-A',
      sourceModelId: 'model-1',
      elements: [tableElement],
      resolveFamilyById: (id) => catalog.get(id),
    });
    expect(payload.format).toBe(CLIPBOARD_FORMAT);
    expect(payload.sourceProjectId).toBe('proj-A');
    expect(payload.familyDefinitions.map((f) => f.id).sort()).toEqual(['fam:chair', 'fam:table']);
  });

  it('collectFamilyReferences walks family_instance_ref + array nodes', () => {
    const arrayUser: FamilyDefinition = {
      id: 'fam:arrayUser',
      name: 'AU',
      discipline: 'door',
      params: [],
      defaultTypes: [],
      geometry: [
        {
          kind: 'array',
          target: {
            kind: 'family_instance_ref',
            familyId: 'fam:chair',
            positionMm: { xMm: 0, yMm: 0, zMm: 0 },
            rotationDeg: 0,
            parameterBindings: {},
          },
          mode: 'linear',
          countParam: 'n',
          spacing: { kind: 'fixed_mm', mm: 100 },
          axisStart: { xMm: 0, yMm: 0, zMm: 0 },
          axisEnd: { xMm: 1000, yMm: 0, zMm: 0 },
        },
      ],
    };
    const catalog = new Map<string, FamilyDefinition>();
    catalog.set('fam:chair', chairFamily());
    catalog.set('fam:arrayUser', arrayUser);
    const element = { id: 'a', kind: 'door', familyId: 'fam:arrayUser' } as unknown as Element;
    const ids = collectFamilyReferences([element], (id) => catalog.get(id));
    expect(ids.sort()).toEqual(['fam:arrayUser', 'fam:chair']);
  });
});

describe('FAM-10 round-trip via localStorage', () => {
  it('write → read returns an equal payload', () => {
    const payload = buildClipboardPayload({
      sourceProjectId: 'proj-A',
      sourceModelId: 'model-1',
      elements: [makeChairElement('el-1')],
      resolveFamilyById: (id) => (id === 'fam:chair' ? chairFamily() : undefined),
    });
    writeClipboard(payload);
    const stored = localStorage.getItem(CLIPBOARD_STORAGE_KEY);
    expect(stored).not.toBeNull();
    const round = readClipboardSync();
    expect(round).not.toBeNull();
    expect(round!.format).toBe(CLIPBOARD_FORMAT);
    expect(round!.sourceProjectId).toBe('proj-A');
    expect(round!.elements).toHaveLength(1);
    expect(round!.familyDefinitions[0]?.id).toBe('fam:chair');
  });

  it('parseClipboardPayload rejects foreign formats', () => {
    expect(parseClipboardPayload(JSON.stringify({ format: 'unknown' }))).toBeNull();
    expect(parseClipboardPayload(null)).toBeNull();
    expect(parseClipboardPayload('not json')).toBeNull();
  });

  it('navigator.clipboard.writeText is invoked alongside localStorage', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const orig = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const payload = buildClipboardPayload({
      sourceProjectId: 'proj-A',
      sourceModelId: 'model-1',
      elements: [makeChairElement('el-1')],
      resolveFamilyById: (id) => (id === 'fam:chair' ? chairFamily() : undefined),
    });
    writeClipboard(payload);
    expect(writeText).toHaveBeenCalledTimes(1);
    const arg = writeText.mock.calls[0][0] as string;
    expect(arg).toContain(CLIPBOARD_FORMAT);
    Object.defineProperty(navigator, 'clipboard', { value: orig, configurable: true });
  });
});

describe('FAM-10 same-project paste', () => {
  it('reassigns ids and offsets positions', () => {
    const payload = buildClipboardPayload({
      sourceProjectId: 'proj-A',
      sourceModelId: 'model-1',
      elements: [makeChairElement('el-1', 100, 200)],
      resolveFamilyById: (id) => (id === 'fam:chair' ? chairFamily() : undefined),
    });
    const result = pasteElementsFromClipboard({
      payload,
      targetProjectId: 'proj-A',
      localFamilies: [chairFamily()],
    });
    expect(result.sameProject).toBe(true);
    expect(result.elements).toHaveLength(1);
    const newId = (result.elements[0] as unknown as { id: string }).id;
    expect(newId).not.toBe('el-1');
    const xMm = (result.elements[0] as unknown as { xMm: number }).xMm;
    const yMm = (result.elements[0] as unknown as { yMm: number }).yMm;
    expect(xMm).not.toBe(100);
    expect(yMm).not.toBe(200);
  });

  it('cross-project paste keeps original positions but reassigns ids', () => {
    const payload = buildClipboardPayload({
      sourceProjectId: 'proj-A',
      sourceModelId: 'model-1',
      elements: [makeChairElement('el-1', 100, 200)],
      resolveFamilyById: (id) => (id === 'fam:chair' ? chairFamily() : undefined),
    });
    const result = pasteElementsFromClipboard({
      payload,
      targetProjectId: 'proj-B',
      localFamilies: [],
    });
    expect(result.sameProject).toBe(false);
    expect((result.elements[0] as unknown as { xMm: number }).xMm).toBe(100);
  });
});

describe('FAM-10 copyElementsToClipboard end-to-end', () => {
  it('writes a payload that read-back recovers', () => {
    const out = copyElementsToClipboard({
      sourceProjectId: 'proj-A',
      sourceModelId: 'model-1',
      elements: [makeChairElement('el-1')],
      resolveFamilyById: (id) => (id === 'fam:chair' ? chairFamily() : undefined),
    });
    const round = readClipboardSync();
    expect(round?.timestamp).toBe(out.timestamp);
    expect(round?.elements).toHaveLength(1);
  });
});
