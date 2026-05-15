import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { extractDetailComponentPrimitives } from './detailComponentsRender';

/* ────────────────────────────────────────────────────────────────────── */
/* Fixture helpers                                                          */
/* ────────────────────────────────────────────────────────────────────── */

const VIEW = 'pv-ann';
const OTHER_VIEW = 'pv-other';

const spotElevation: Extract<Element, { kind: 'spot_elevation' }> = {
  kind: 'spot_elevation',
  id: 'se-1',
  hostViewId: VIEW,
  positionMm: { xMm: 1000, yMm: 2000 },
  elevationMm: 3500,
  prefix: 'RL',
  suffix: 'm',
  colour: '#0044cc',
};

const angularDimension: Extract<Element, { kind: 'angular_dimension' }> = {
  kind: 'angular_dimension',
  id: 'ad-1',
  hostViewId: VIEW,
  vertexMm: { xMm: 0, yMm: 0 },
  rayAMm: { xMm: 1000, yMm: 0 },
  rayBMm: { xMm: 0, yMm: 1000 },
  arcRadiusMm: 500,
  colour: '#333333',
};

const radialDimension: Extract<Element, { kind: 'radial_dimension' }> = {
  kind: 'radial_dimension',
  id: 'rd-1',
  hostViewId: VIEW,
  centerMm: { xMm: 500, yMm: 500 },
  arcPointMm: { xMm: 1000, yMm: 500 },
  colour: '#444444',
};

const diameterDimension: Extract<Element, { kind: 'diameter_dimension' }> = {
  kind: 'diameter_dimension',
  id: 'dd-1',
  hostViewId: VIEW,
  centerMm: { xMm: 500, yMm: 500 },
  arcPointMm: { xMm: 1000, yMm: 500 },
  colour: '#555555',
};

const arcLengthDimension: Extract<Element, { kind: 'arc_length_dimension' }> = {
  kind: 'arc_length_dimension',
  id: 'ald-1',
  hostViewId: VIEW,
  centerMm: { xMm: 500, yMm: 500 },
  radiusMm: 800,
  startAngleDeg: 0,
  endAngleDeg: 90,
  colour: '#666666',
};

const spotCoordinate: Extract<Element, { kind: 'spot_coordinate' }> = {
  kind: 'spot_coordinate',
  id: 'sc-1',
  hostViewId: VIEW,
  positionMm: { xMm: 3000, yMm: 4000 },
  northMm: 12345,
  eastMm: 67890,
  colour: '#777777',
};

const spotSlope: Extract<Element, { kind: 'spot_slope' }> = {
  kind: 'spot_slope',
  id: 'ss-1',
  hostViewId: VIEW,
  positionMm: { xMm: 2000, yMm: 1000 },
  slopePct: 2.5,
  slopeFormat: 'percent',
  colour: '#888888',
};

const materialTag: Extract<Element, { kind: 'material_tag' }> = {
  kind: 'material_tag',
  id: 'mt-1',
  hostViewId: VIEW,
  hostElementId: 'wall-42',
  layerIndex: 1,
  positionMm: { xMm: 500, yMm: 800 },
  textOverride: 'Brick',
  colour: '#999999',
};

/* ────────────────────────────────────────────────────────────────────── */
/* ANN-02 — spot_elevation                                                 */
/* ────────────────────────────────────────────────────────────────────── */

describe('ANN-02 — spot_elevation', () => {
  it('extracts a spot_elevation primitive with all fields', () => {
    const prims = extractDetailComponentPrimitives({ [spotElevation.id]: spotElevation }, VIEW);
    expect(prims).toHaveLength(1);
    const [p] = prims;
    expect(p?.kind).toBe('spot_elevation');
    if (p?.kind === 'spot_elevation') {
      expect(p.positionMm).toEqual({ xMm: 1000, yMm: 2000 });
      expect(p.elevationMm).toBe(3500);
      expect(p.prefix).toBe('RL');
      expect(p.suffix).toBe('m');
      expect(p.colour).toBe('#0044cc');
    }
  });

  it('applies default prefix and suffix when omitted', () => {
    const minimal: Extract<Element, { kind: 'spot_elevation' }> = {
      kind: 'spot_elevation',
      id: 'se-min',
      hostViewId: VIEW,
      positionMm: { xMm: 0, yMm: 0 },
      elevationMm: 0,
    };
    const prims = extractDetailComponentPrimitives({ [minimal.id]: minimal }, VIEW);
    const [p] = prims;
    if (p?.kind === 'spot_elevation') {
      expect(p.prefix).toBe('');
      expect(p.suffix).toBe('');
      expect(p.colour).toBe('#202020');
    }
  });

  it('excludes spot_elevation on a different view', () => {
    const foreign: Extract<Element, { kind: 'spot_elevation' }> = {
      ...spotElevation,
      id: 'se-other',
      hostViewId: OTHER_VIEW,
    };
    const prims = extractDetailComponentPrimitives({ [foreign.id]: foreign }, VIEW);
    expect(prims).toEqual([]);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* ANN-04 — angular_dimension                                              */
/* ────────────────────────────────────────────────────────────────────── */

describe('ANN-04 — angular_dimension', () => {
  it('extracts an angular_dimension primitive with vertex, rays, arcRadius and colour', () => {
    const prims = extractDetailComponentPrimitives(
      { [angularDimension.id]: angularDimension },
      VIEW,
    );
    expect(prims).toHaveLength(1);
    const [p] = prims;
    expect(p?.kind).toBe('angular_dimension');
    if (p?.kind === 'angular_dimension') {
      expect(p.vertexMm).toEqual({ xMm: 0, yMm: 0 });
      expect(p.rayAMm).toEqual({ xMm: 1000, yMm: 0 });
      expect(p.rayBMm).toEqual({ xMm: 0, yMm: 1000 });
      expect(p.arcRadiusMm).toBe(500);
      expect(p.colour).toBe('#333333');
    }
  });

  it('applies default arcRadiusMm of 500 when omitted', () => {
    const minimal: Extract<Element, { kind: 'angular_dimension' }> = {
      kind: 'angular_dimension',
      id: 'ad-min',
      hostViewId: VIEW,
      vertexMm: { xMm: 0, yMm: 0 },
      rayAMm: { xMm: 1, yMm: 0 },
      rayBMm: { xMm: 0, yMm: 1 },
    };
    const prims = extractDetailComponentPrimitives({ [minimal.id]: minimal }, VIEW);
    const [p] = prims;
    if (p?.kind === 'angular_dimension') {
      expect(p.arcRadiusMm).toBe(500);
      expect(p.colour).toBe('#202020');
    }
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* ANN-06 — radial_dimension                                               */
/* ────────────────────────────────────────────────────────────────────── */

describe('ANN-06 — radial_dimension', () => {
  it('extracts a radial_dimension primitive with center, arcPoint and colour', () => {
    const prims = extractDetailComponentPrimitives({ [radialDimension.id]: radialDimension }, VIEW);
    expect(prims).toHaveLength(1);
    const [p] = prims;
    expect(p?.kind).toBe('radial_dimension');
    if (p?.kind === 'radial_dimension') {
      expect(p.centerMm).toEqual({ xMm: 500, yMm: 500 });
      expect(p.arcPointMm).toEqual({ xMm: 1000, yMm: 500 });
      expect(p.colour).toBe('#444444');
    }
  });

  it('applies default colour when omitted', () => {
    const minimal: Extract<Element, { kind: 'radial_dimension' }> = {
      kind: 'radial_dimension',
      id: 'rd-min',
      hostViewId: VIEW,
      centerMm: { xMm: 0, yMm: 0 },
      arcPointMm: { xMm: 500, yMm: 0 },
    };
    const [p] = extractDetailComponentPrimitives({ [minimal.id]: minimal }, VIEW);
    if (p?.kind === 'radial_dimension') {
      expect(p.colour).toBe('#202020');
    }
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* ANN-07 — diameter_dimension                                             */
/* ────────────────────────────────────────────────────────────────────── */

describe('ANN-07 — diameter_dimension', () => {
  it('extracts a diameter_dimension primitive with center, arcPoint and colour', () => {
    const prims = extractDetailComponentPrimitives(
      { [diameterDimension.id]: diameterDimension },
      VIEW,
    );
    expect(prims).toHaveLength(1);
    const [p] = prims;
    expect(p?.kind).toBe('diameter_dimension');
    if (p?.kind === 'diameter_dimension') {
      expect(p.centerMm).toEqual({ xMm: 500, yMm: 500 });
      expect(p.arcPointMm).toEqual({ xMm: 1000, yMm: 500 });
      expect(p.colour).toBe('#555555');
    }
  });

  it('excludes diameter_dimension on a different view', () => {
    const foreign: Extract<Element, { kind: 'diameter_dimension' }> = {
      ...diameterDimension,
      id: 'dd-other',
      hostViewId: OTHER_VIEW,
    };
    expect(extractDetailComponentPrimitives({ [foreign.id]: foreign }, VIEW)).toEqual([]);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* ANN-08 — arc_length_dimension                                           */
/* ────────────────────────────────────────────────────────────────────── */

describe('ANN-08 — arc_length_dimension', () => {
  it('extracts an arc_length_dimension primitive with all arc fields', () => {
    const prims = extractDetailComponentPrimitives(
      { [arcLengthDimension.id]: arcLengthDimension },
      VIEW,
    );
    expect(prims).toHaveLength(1);
    const [p] = prims;
    expect(p?.kind).toBe('arc_length_dimension');
    if (p?.kind === 'arc_length_dimension') {
      expect(p.centerMm).toEqual({ xMm: 500, yMm: 500 });
      expect(p.radiusMm).toBe(800);
      expect(p.startAngleDeg).toBe(0);
      expect(p.endAngleDeg).toBe(90);
      expect(p.colour).toBe('#666666');
    }
  });

  it('applies default colour when omitted', () => {
    const minimal: Extract<Element, { kind: 'arc_length_dimension' }> = {
      kind: 'arc_length_dimension',
      id: 'ald-min',
      hostViewId: VIEW,
      centerMm: { xMm: 0, yMm: 0 },
      radiusMm: 400,
      startAngleDeg: 45,
      endAngleDeg: 135,
    };
    const [p] = extractDetailComponentPrimitives({ [minimal.id]: minimal }, VIEW);
    if (p?.kind === 'arc_length_dimension') {
      expect(p.colour).toBe('#202020');
    }
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* ANN-09 — spot_coordinate                                                */
/* ────────────────────────────────────────────────────────────────────── */

describe('ANN-09 — spot_coordinate', () => {
  it('extracts a spot_coordinate primitive with N/E values', () => {
    const prims = extractDetailComponentPrimitives({ [spotCoordinate.id]: spotCoordinate }, VIEW);
    expect(prims).toHaveLength(1);
    const [p] = prims;
    expect(p?.kind).toBe('spot_coordinate');
    if (p?.kind === 'spot_coordinate') {
      expect(p.positionMm).toEqual({ xMm: 3000, yMm: 4000 });
      expect(p.northMm).toBe(12345);
      expect(p.eastMm).toBe(67890);
      expect(p.colour).toBe('#777777');
    }
  });

  it('applies default colour when omitted', () => {
    const minimal: Extract<Element, { kind: 'spot_coordinate' }> = {
      kind: 'spot_coordinate',
      id: 'sc-min',
      hostViewId: VIEW,
      positionMm: { xMm: 0, yMm: 0 },
      northMm: 0,
      eastMm: 0,
    };
    const [p] = extractDetailComponentPrimitives({ [minimal.id]: minimal }, VIEW);
    if (p?.kind === 'spot_coordinate') {
      expect(p.colour).toBe('#202020');
    }
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* ANN-10 — spot_slope                                                     */
/* ────────────────────────────────────────────────────────────────────── */

describe('ANN-10 — spot_slope', () => {
  it('extracts a spot_slope primitive with slopePct, slopeFormat and colour', () => {
    const prims = extractDetailComponentPrimitives({ [spotSlope.id]: spotSlope }, VIEW);
    expect(prims).toHaveLength(1);
    const [p] = prims;
    expect(p?.kind).toBe('spot_slope');
    if (p?.kind === 'spot_slope') {
      expect(p.positionMm).toEqual({ xMm: 2000, yMm: 1000 });
      expect(p.slopePct).toBe(2.5);
      expect(p.slopeFormat).toBe('percent');
      expect(p.colour).toBe('#888888');
    }
  });

  it('applies default slopeFormat=percent and colour when omitted', () => {
    const minimal: Extract<Element, { kind: 'spot_slope' }> = {
      kind: 'spot_slope',
      id: 'ss-min',
      hostViewId: VIEW,
      positionMm: { xMm: 0, yMm: 0 },
      slopePct: 5,
    };
    const [p] = extractDetailComponentPrimitives({ [minimal.id]: minimal }, VIEW);
    if (p?.kind === 'spot_slope') {
      expect(p.slopeFormat).toBe('percent');
      expect(p.colour).toBe('#202020');
    }
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* ANN-12 — material_tag                                                   */
/* ────────────────────────────────────────────────────────────────────── */

describe('ANN-12 — material_tag', () => {
  it('extracts a material_tag primitive with hostElementId, layerIndex, textOverride and colour', () => {
    const prims = extractDetailComponentPrimitives({ [materialTag.id]: materialTag }, VIEW);
    expect(prims).toHaveLength(1);
    const [p] = prims;
    expect(p?.kind).toBe('material_tag');
    if (p?.kind === 'material_tag') {
      expect(p.positionMm).toEqual({ xMm: 500, yMm: 800 });
      expect(p.hostElementId).toBe('wall-42');
      expect(p.layerIndex).toBe(1);
      expect(p.textOverride).toBe('Brick');
      expect(p.colour).toBe('#999999');
    }
  });

  it('applies default layerIndex=0, textOverride=null and colour when omitted', () => {
    const minimal: Extract<Element, { kind: 'material_tag' }> = {
      kind: 'material_tag',
      id: 'mt-min',
      hostViewId: VIEW,
      hostElementId: 'wall-99',
      positionMm: { xMm: 0, yMm: 0 },
    };
    const [p] = extractDetailComponentPrimitives({ [minimal.id]: minimal }, VIEW);
    if (p?.kind === 'material_tag') {
      expect(p.layerIndex).toBe(0);
      expect(p.textOverride).toBeNull();
      expect(p.colour).toBe('#202020');
    }
  });

  it('excludes material_tag on a different view', () => {
    const foreign: Extract<Element, { kind: 'material_tag' }> = {
      ...materialTag,
      id: 'mt-other',
      hostViewId: OTHER_VIEW,
    };
    expect(extractDetailComponentPrimitives({ [foreign.id]: foreign }, VIEW)).toEqual([]);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* Mixed — multiple annotation kinds in one elementsById map               */
/* ────────────────────────────────────────────────────────────────────── */

describe('mixed annotation kinds', () => {
  it('extracts all eight annotation kinds when all are on the same view', () => {
    const elementsById: Record<string, Element> = {
      [spotElevation.id]: spotElevation,
      [angularDimension.id]: angularDimension,
      [radialDimension.id]: radialDimension,
      [diameterDimension.id]: diameterDimension,
      [arcLengthDimension.id]: arcLengthDimension,
      [spotCoordinate.id]: spotCoordinate,
      [spotSlope.id]: spotSlope,
      [materialTag.id]: materialTag,
    };
    const prims = extractDetailComponentPrimitives(elementsById, VIEW);
    const kinds = prims.map((p) => p.kind).sort();
    expect(kinds).toEqual([
      'angular_dimension',
      'arc_length_dimension',
      'diameter_dimension',
      'material_tag',
      'radial_dimension',
      'spot_coordinate',
      'spot_elevation',
      'spot_slope',
    ]);
  });

  it('returns empty list when viewId is undefined regardless of available annotations', () => {
    const elementsById: Record<string, Element> = {
      [spotElevation.id]: spotElevation,
      [angularDimension.id]: angularDimension,
    };
    expect(extractDetailComponentPrimitives(elementsById, undefined)).toEqual([]);
  });
});
