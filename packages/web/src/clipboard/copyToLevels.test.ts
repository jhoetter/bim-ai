/**
 * C6 — copyToLevels / pasteAlignedToLevels unit tests.
 */
import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { CLIPBOARD_FORMAT, type ClipboardPayload } from './payload';
import { copyToLevels, pasteAlignedToLevels } from './copyPaste';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLevel(id: string, elevationMm: number): Element {
  return { id, kind: 'level', name: id, elevationMm } as unknown as Element;
}

function makeWall(id: string, levelId: string, xMm = 0, yMm = 0, zMm = 0): Element {
  return { id, kind: 'wall', levelId, xMm, yMm, zMm } as unknown as Element;
}

function makePayload(elements: Element[]): ClipboardPayload {
  return {
    format: CLIPBOARD_FORMAT,
    sourceProjectId: 'proj-A',
    sourceModelId: 'model-1',
    elements,
    familyDefinitions: [],
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('C6 copyToLevels', () => {
  it('returns one group per target level with fresh ids', () => {
    const groundLevel = makeLevel('lvl-ground', 0);
    const floor1Level = makeLevel('lvl-floor1', 3000);

    const walls = [makeWall('wall-1', 'lvl-ground'), makeWall('wall-2', 'lvl-ground')];
    const payload = makePayload(walls);

    const elementsById: Record<string, Element> = {
      'lvl-ground': groundLevel,
      'lvl-floor1': floor1Level,
    };

    const result = copyToLevels({
      payload,
      targetLevelIds: ['lvl-floor1'],
      elementsById,
      targetProjectId: 'proj-A',
    });

    // One group for the one target level.
    expect(result.elementsByLevel).toHaveLength(1);

    const group = result.elementsByLevel[0]!;
    expect(group.levelId).toBe('lvl-floor1');
    expect(group.elements).toHaveLength(2);
  });

  it('assigns fresh ids — none match the source ids', () => {
    const groundLevel = makeLevel('lvl-ground', 0);
    const floor1Level = makeLevel('lvl-floor1', 3000);

    const walls = [makeWall('wall-1', 'lvl-ground'), makeWall('wall-2', 'lvl-ground')];
    const payload = makePayload(walls);

    const elementsById: Record<string, Element> = {
      'lvl-ground': groundLevel,
      'lvl-floor1': floor1Level,
    };

    const result = copyToLevels({
      payload,
      targetLevelIds: ['lvl-floor1'],
      elementsById,
      targetProjectId: 'proj-A',
    });

    const newIds = result.elementsByLevel[0]!.elements.map(
      (el) => (el as unknown as { id: string }).id,
    );
    expect(newIds).not.toContain('wall-1');
    expect(newIds).not.toContain('wall-2');
    // All ids must be distinct.
    expect(new Set(newIds).size).toBe(newIds.length);
  });

  it('updates levelId on each cloned element to the target level', () => {
    const groundLevel = makeLevel('lvl-ground', 0);
    const floor1Level = makeLevel('lvl-floor1', 3000);

    const walls = [makeWall('wall-1', 'lvl-ground'), makeWall('wall-2', 'lvl-ground')];
    const payload = makePayload(walls);

    const elementsById: Record<string, Element> = {
      'lvl-ground': groundLevel,
      'lvl-floor1': floor1Level,
    };

    const result = copyToLevels({
      payload,
      targetLevelIds: ['lvl-floor1'],
      elementsById,
      targetProjectId: 'proj-A',
    });

    for (const el of result.elementsByLevel[0]!.elements) {
      expect((el as unknown as { levelId: string }).levelId).toBe('lvl-floor1');
    }
  });

  it('offsets zMm by the elevation delta between source and target level', () => {
    const groundLevel = makeLevel('lvl-ground', 0);
    const floor1Level = makeLevel('lvl-floor1', 3000);

    // Wall placed at zMm = 500 on the ground level.
    const wall = makeWall('wall-1', 'lvl-ground', 0, 0, 500);
    const payload = makePayload([wall]);

    const elementsById: Record<string, Element> = {
      'lvl-ground': groundLevel,
      'lvl-floor1': floor1Level,
    };

    const result = copyToLevels({
      payload,
      targetLevelIds: ['lvl-floor1'],
      elementsById,
      targetProjectId: 'proj-A',
    });

    const cloned = result.elementsByLevel[0]!.elements[0]!;
    // 500 (original) + 3000 (delta) = 3500
    expect((cloned as unknown as { zMm: number }).zMm).toBe(3500);
  });

  it('produces groups for each target level when multiple targets are given', () => {
    const groundLevel = makeLevel('lvl-ground', 0);
    const floor1Level = makeLevel('lvl-floor1', 3000);
    const floor2Level = makeLevel('lvl-floor2', 6000);

    const wall = makeWall('wall-1', 'lvl-ground');
    const payload = makePayload([wall]);

    const elementsById: Record<string, Element> = {
      'lvl-ground': groundLevel,
      'lvl-floor1': floor1Level,
      'lvl-floor2': floor2Level,
    };

    const result = copyToLevels({
      payload,
      targetLevelIds: ['lvl-floor1', 'lvl-floor2'],
      elementsById,
      targetProjectId: 'proj-A',
    });

    expect(result.elementsByLevel).toHaveLength(2);
    expect(result.elementsByLevel[0]!.levelId).toBe('lvl-floor1');
    expect(result.elementsByLevel[1]!.levelId).toBe('lvl-floor2');

    // All four generated ids must be unique (2 levels × 1 element each).
    const allIds = result.elementsByLevel.flatMap((g) =>
      g.elements.map((el) => (el as unknown as { id: string }).id),
    );
    expect(new Set(allIds).size).toBe(2);
  });
});

describe('C6 pasteAlignedToLevels', () => {
  it('flattens all level groups into a single array', () => {
    const groundLevel = makeLevel('lvl-ground', 0);
    const floor1Level = makeLevel('lvl-floor1', 3000);
    const floor2Level = makeLevel('lvl-floor2', 6000);

    const walls = [makeWall('wall-1', 'lvl-ground'), makeWall('wall-2', 'lvl-ground')];
    const payload = makePayload(walls);

    const elementsById: Record<string, Element> = {
      'lvl-ground': groundLevel,
      'lvl-floor1': floor1Level,
      'lvl-floor2': floor2Level,
    };

    const flat = pasteAlignedToLevels({
      payload,
      targetLevelIds: ['lvl-floor1', 'lvl-floor2'],
      elementsById,
      targetProjectId: 'proj-A',
    });

    // 2 walls × 2 levels = 4 elements.
    expect(flat).toHaveLength(4);
    // All ids unique.
    const ids = flat.map((el) => (el as unknown as { id: string }).id);
    expect(new Set(ids).size).toBe(4);
  });
});
