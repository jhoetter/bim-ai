import { describe, expect, it } from 'vitest';

import { exportToDxf } from './dxfExporter';
import type { Element } from '@bim-ai/core';

function mkWall(
  id: string,
  levelId: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Element {
  return {
    kind: 'wall',
    id,
    name: 'Wall',
    levelId,
    start: { xMm: x1, yMm: y1 },
    end: { xMm: x2, yMm: y2 },
    thicknessMm: 200,
    heightMm: 3000,
  } as Element;
}

const LEVEL: Element = {
  kind: 'level',
  id: 'lv1',
  name: 'Ground Floor',
  elevationMm: 0,
};

describe('exportToDxf', () => {
  it('outputs DXF POLYLINE entities on layer A-WALL for walls', () => {
    const elements: Record<string, Element> = {
      lv1: LEVEL,
      w1: mkWall('w1', 'lv1', 0, 0, 5000, 0),
      w2: mkWall('w2', 'lv1', 5000, 0, 5000, 5000),
      w3: mkWall('w3', 'lv1', 5000, 5000, 0, 5000),
      w4: mkWall('w4', 'lv1', 0, 5000, 0, 0),
    };
    const views = exportToDxf(elements);
    expect(views).toHaveLength(1);
    const { dxfContent } = views[0]!;
    expect(dxfContent).toContain('POLYLINE');
    expect(dxfContent).toContain('A-WALL');
  });

  it('outputs ARC entity on layer A-DOOR for door elements', () => {
    const elements: Record<string, Element> = {
      lv1: LEVEL,
      w1: mkWall('w1', 'lv1', 0, 0, 5000, 0),
      d1: {
        kind: 'door',
        id: 'd1',
        name: 'Door',
        wallId: 'w1',
        alongT: 0.5,
        widthMm: 900,
      } as Element,
    };
    const views = exportToDxf(elements);
    const { dxfContent } = views[0]!;
    expect(dxfContent).toContain('ARC');
    expect(dxfContent).toContain('A-DOOR');
  });

  it('outputs LINE entities on layer A-GLAZ for window elements', () => {
    const elements: Record<string, Element> = {
      lv1: LEVEL,
      w1: mkWall('w1', 'lv1', 0, 0, 5000, 0),
      win1: {
        kind: 'window',
        id: 'win1',
        name: 'Window',
        wallId: 'w1',
        alongT: 0.4,
        widthMm: 1200,
        sillHeightMm: 900,
        heightMm: 1200,
      } as Element,
    };
    const views = exportToDxf(elements);
    const { dxfContent } = views[0]!;
    expect(dxfContent).toContain('LINE');
    expect(dxfContent).toContain('A-GLAZ');
  });

  it('wraps content in valid DXF SECTION structure starting with HEADER and ending with EOF', () => {
    const elements: Record<string, Element> = { lv1: LEVEL };
    const views = exportToDxf(elements);
    const { dxfContent } = views[0]!;
    expect(dxfContent.startsWith('0\nSECTION')).toBe(true);
    expect(dxfContent.endsWith('0\nEOF')).toBe(true);
    expect(dxfContent).toContain('HEADER');
    expect(dxfContent).toContain('ENTITIES');
  });

  it('outputs LINE + CIRCLE on layer S-GRID for grid_line elements', () => {
    const elements: Record<string, Element> = {
      lv1: LEVEL,
      g1: {
        kind: 'grid_line',
        id: 'g1',
        name: 'Grid 1',
        label: 'A',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 6000, yMm: 0 },
      } as Element,
    };
    const { dxfContent } = exportToDxf(elements)[0]!;
    expect(dxfContent).toContain('S-GRID');
    expect(dxfContent).toContain('LINE');
    expect(dxfContent).toContain('CIRCLE');
  });

  it('outputs LINE on layer A-REFP for project-scope reference_plane elements', () => {
    const elements: Record<string, Element> = {
      lv1: LEVEL,
      rp1: {
        kind: 'reference_plane',
        id: 'rp1',
        name: 'RP 1',
        levelId: 'lv1',
        startMm: { xMm: 0, yMm: 1000 },
        endMm: { xMm: 5000, yMm: 1000 },
      } as Element,
    };
    const { dxfContent } = exportToDxf(elements)[0]!;
    expect(dxfContent).toContain('A-REFP');
    expect(dxfContent).toContain('LINE');
  });

  it('outputs dimension lines + label on layer A-ANNO-DIMS for dimension elements', () => {
    const elements: Record<string, Element> = {
      lv1: LEVEL,
      dim1: {
        kind: 'dimension',
        id: 'dim1',
        name: 'Dim 1',
        levelId: 'lv1',
        aMm: { xMm: 0, yMm: 0 },
        bMm: { xMm: 3000, yMm: 0 },
        offsetMm: { xMm: 0, yMm: 500 },
      } as Element,
    };
    const { dxfContent } = exportToDxf(elements)[0]!;
    expect(dxfContent).toContain('A-ANNO-DIMS');
    expect(dxfContent).toContain('TEXT');
    expect(dxfContent).toContain('3000');
  });

  it('outputs TEXT on layer A-ANNO for text_note elements', () => {
    const elements: Record<string, Element> = {
      lv1: LEVEL,
      tn1: {
        kind: 'text_note',
        id: 'tn1',
        hostViewId: 'lv1',
        positionMm: { xMm: 1000, yMm: 2000 },
        text: 'Hello World',
        fontSizeMm: 250,
      } as Element,
    };
    const { dxfContent } = exportToDxf(elements)[0]!;
    expect(dxfContent).toContain('A-ANNO');
    expect(dxfContent).toContain('Hello World');
  });
});

describe('DXF export structural elements — §12.4.3', () => {
  const level = { id: 'L1', kind: 'level', name: 'Ground', elevationMm: 0 } as Element;

  it('exports column as S-COLS rectangle', () => {
    const col = {
      kind: 'column',
      id: 'c1',
      levelId: 'L1',
      positionMm: { xMm: 5000, yMm: 5000 },
      widthMm: 400,
      depthMm: 400,
    } as unknown as Element;
    const result = exportToDxf({ [col.id]: col, [level.id]: level }, {});
    expect(result[0]?.dxfContent).toContain('S-COLS');
  });

  it('exports beam as S-BEAM line', () => {
    const beam = {
      kind: 'beam',
      id: 'b1',
      levelId: 'L1',
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 6000, yMm: 0 },
    } as unknown as Element;
    const result = exportToDxf({ [beam.id]: beam, [level.id]: level }, {});
    expect(result[0]?.dxfContent).toContain('S-BEAM');
  });

  it('exports floor as A-FLOR polyline', () => {
    const floor = {
      kind: 'floor',
      id: 'f1',
      levelId: 'L1',
      perimeterMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 5000, yMm: 0 },
        { xMm: 5000, yMm: 4000 },
        { xMm: 0, yMm: 4000 },
      ],
    } as unknown as Element;
    const result = exportToDxf({ [floor.id]: floor, [level.id]: level }, {});
    expect(result[0]?.dxfContent).toContain('A-FLOR');
  });

  it('exports stair as A-FLOR-STRS rectangle', () => {
    const stair = {
      kind: 'stair',
      id: 's1',
      levelId: 'L1',
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 3000, yMm: 0 },
      runWidthMm: 1200,
    } as unknown as Element;
    const result = exportToDxf({ [stair.id]: stair, [level.id]: level }, {});
    expect(result[0]?.dxfContent).toContain('A-FLOR-STRS');
  });
});
