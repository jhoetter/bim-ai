import type { Element, WallLayerFunction, WallTypeLayer } from '@bim-ai/core';

/** Aligns with `bim_ai.material_assembly_resolve._CUT_THICKNESS_MATCH_EPS_MM`. */
export const CUT_THICKNESS_MATCH_EPS_MM = 0.05;

/** Allowed layer functions for layered type authoring (matches core `WallLayerFunction`). */
export const ALLOWED_WALL_LAYER_FUNCTIONS: Readonly<WallLayerFunction[]> = [
  'structure',
  'insulation',
  'finish',
];

/** Mirrors `bim_ai.type_material_registry.builtin_type_material_registry` materialSeeds (keep in sync). */
export const BUILTIN_MATERIAL_DISPLAY: Readonly<Record<string, string>> = {
  'mat-concrete-structure-v1': 'Concrete structure',
  'mat-gwb-finish-v1': 'Gypsum board finish',
  'mat-epoxy-cleanroom-v1': 'Epoxy cleanroom flooring',
  'mat-osb-roof-deck-v1': 'OSB structural deck',
  'mat-insulation-roof-board-v1': 'Rigid insulation board',
  'mat-membrane-roof-single-ply-v1': 'Roof membrane (single-ply)',
} as const;

export type LayerAssemblySource = 'type_stack' | 'instance_fallback' | 'roof_type_stack' | 'none';

export type MaterialLayerRow = {
  index: number;
  function: WallLayerFunction;
  materialKey: string;
  materialDisplay: string;
  thicknessMm: number;
  wrapsAtEnds: boolean;
  wrapsAtInserts: boolean;
};

export type MaterialLayerReadout = {
  mode: 'host' | 'type_element';
  hostElementId?: string;
  hostKind?: 'wall' | 'floor' | 'roof';
  typeElementKind?: 'wall_type' | 'floor_type' | 'roof_type';
  assemblyTypeId: string;
  assemblyTypeName: string;
  layers: MaterialLayerRow[];
  layerTotalThicknessMm: number;
  cutProxyThicknessMm: number | null;
  layerStackMatchesCutThickness: boolean | null;
  layerSource: LayerAssemblySource;
  skipReason: string | null;
};

export function resolveMaterialDisplayLabel(materialKey: string): string {
  const key = materialKey.trim();
  if (!key) return '';
  return BUILTIN_MATERIAL_DISPLAY[key] ?? '';
}

export function formatLayerFunctionRole(fn: WallLayerFunction | string): string {
  if (fn === 'structure') return 'Structure';
  if (fn === 'insulation') return 'Insulation';
  if (fn === 'finish') return 'Finish';
  return String(fn);
}

export function roundThicknessMm(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function normalizeLayer(lyr: WallTypeLayer): Omit<MaterialLayerRow, 'index'> {
  const mk = (lyr.materialKey ?? '').trim();
  return {
    function: lyr.function,
    materialKey: mk,
    materialDisplay: resolveMaterialDisplayLabel(mk),
    thicknessMm: roundThicknessMm(Number(lyr.thicknessMm)),
    wrapsAtEnds: lyr.wrapsAtEnds === true,
    wrapsAtInserts: lyr.wrapsAtInserts === true,
  };
}

function mapTypeLayers(layers: WallTypeLayer[]): MaterialLayerRow[] {
  return layers.map((lyr, i) => ({
    index: i,
    ...normalizeLayer(lyr),
  }));
}

function layerTotalMm(rows: MaterialLayerRow[]): number {
  return roundThicknessMm(rows.reduce((s, r) => s + r.thicknessMm, 0));
}

function stackMatchesCut(total: number, cutMm: number | null): boolean | null {
  if (cutMm == null) return null;
  return Math.abs(total - cutMm) <= CUT_THICKNESS_MATCH_EPS_MM;
}

function typeDisplayName(elementsById: Record<string, Element>, id: string, kind: string): string {
  const t = id ? elementsById[id] : undefined;
  if (!t) return '';
  if (t.kind === kind && typeof (t as { name?: string }).name === 'string') {
    return ((t as { name: string }).name ?? '').trim();
  }
  return '';
}

export function buildMaterialStackEvidenceToken(readout: MaterialLayerReadout): string {
  const host = readout.hostElementId ?? readout.assemblyTypeId;
  const typeId = readout.assemblyTypeId || '—';
  const n = readout.layers.length;
  const match =
    readout.layerStackMatchesCutThickness == null
      ? 'na'
      : readout.layerStackMatchesCutThickness
        ? 'match'
        : 'mismatch';
  const src = readout.layerSource;
  const wrapEnds = readout.layers.filter((row) => row.wrapsAtEnds).length;
  const wrapInserts = readout.layers.filter((row) => row.wrapsAtInserts).length;
  return `host=${host};type=${typeId};layers=${n};cut=${readout.cutProxyThicknessMm ?? 'na'};stackMm=${readout.layerTotalThicknessMm};align=${match};src=${src};wrapEnds=${wrapEnds};wrapInserts=${wrapInserts}`;
}

export function resolveMaterialLayerReadout(
  selected: Element | undefined,
  elementsById: Record<string, Element>,
): MaterialLayerReadout | null {
  if (!selected) return null;

  if (
    selected.kind === 'wall_type' ||
    selected.kind === 'floor_type' ||
    selected.kind === 'roof_type'
  ) {
    const rows = mapTypeLayers(selected.layers ?? []);
    const src: LayerAssemblySource =
      selected.kind === 'roof_type' ? 'roof_type_stack' : 'type_stack';
    return {
      mode: 'type_element',
      typeElementKind: selected.kind,
      assemblyTypeId: selected.id,
      assemblyTypeName: (selected.name ?? '').trim() || selected.id,
      layers: rows,
      layerTotalThicknessMm: layerTotalMm(rows),
      cutProxyThicknessMm: null,
      layerStackMatchesCutThickness: null,
      layerSource: src,
      skipReason: null,
    };
  }

  if (selected.kind === 'wall') {
    const tid = (selected.wallTypeId ?? '').trim();
    let rows: MaterialLayerRow[];
    let layerSource: LayerAssemblySource;

    if (tid) {
      const wt = elementsById[tid];
      if (wt?.kind === 'wall_type' && wt.layers?.length) {
        rows = mapTypeLayers(wt.layers);
        layerSource = 'type_stack';
      } else {
        rows = [
          {
            index: 0,
            function: 'structure',
            materialKey: '',
            materialDisplay: '',
            thicknessMm: roundThicknessMm(selected.thicknessMm),
            wrapsAtEnds: false,
            wrapsAtInserts: false,
          },
        ];
        layerSource = 'instance_fallback';
      }
    } else {
      rows = [
        {
          index: 0,
          function: 'structure',
          materialKey: '',
          materialDisplay: '',
          thicknessMm: roundThicknessMm(selected.thicknessMm),
          wrapsAtEnds: false,
          wrapsAtInserts: false,
        },
      ];
      layerSource = 'instance_fallback';
    }

    const total = layerTotalMm(rows);
    const cut = roundThicknessMm(selected.thicknessMm);
    const typeName = tid ? typeDisplayName(elementsById, tid, 'wall_type') : '';

    return {
      mode: 'host',
      hostElementId: selected.id,
      hostKind: 'wall',
      assemblyTypeId: tid,
      assemblyTypeName: typeName,
      layers: rows,
      layerTotalThicknessMm: total,
      cutProxyThicknessMm: cut,
      layerStackMatchesCutThickness: stackMatchesCut(total, cut),
      layerSource,
      skipReason: null,
    };
  }

  if (selected.kind === 'floor') {
    const tid = (selected.floorTypeId ?? '').trim();
    let rows: MaterialLayerRow[];
    let layerSource: LayerAssemblySource;

    if (tid) {
      const ft = elementsById[tid];
      if (ft?.kind === 'floor_type' && ft.layers?.length) {
        rows = mapTypeLayers(ft.layers);
        layerSource = 'type_stack';
      } else {
        rows = [
          {
            index: 0,
            function: 'structure',
            materialKey: '',
            materialDisplay: '',
            thicknessMm: roundThicknessMm(selected.thicknessMm),
            wrapsAtEnds: false,
            wrapsAtInserts: false,
          },
        ];
        layerSource = 'instance_fallback';
      }
    } else {
      rows = [
        {
          index: 0,
          function: 'structure',
          materialKey: '',
          materialDisplay: '',
          thicknessMm: roundThicknessMm(selected.thicknessMm),
          wrapsAtEnds: false,
          wrapsAtInserts: false,
        },
      ];
      layerSource = 'instance_fallback';
    }

    const total = layerTotalMm(rows);
    const cut = roundThicknessMm(selected.thicknessMm);
    const typeName = tid ? typeDisplayName(elementsById, tid, 'floor_type') : '';

    return {
      mode: 'host',
      hostElementId: selected.id,
      hostKind: 'floor',
      assemblyTypeId: tid,
      assemblyTypeName: typeName,
      layers: rows,
      layerTotalThicknessMm: total,
      cutProxyThicknessMm: cut,
      layerStackMatchesCutThickness: stackMatchesCut(total, cut),
      layerSource,
      skipReason: null,
    };
  }

  if (selected.kind === 'roof') {
    const rtId = (selected.roofTypeId ?? '').trim();
    let rows: MaterialLayerRow[];
    let layerSource: LayerAssemblySource;
    let skipReason: string | null;

    if (!rtId) {
      rows = [];
      layerSource = 'none';
      skipReason = 'roof_missing_roof_type_id';
    } else {
      const rt = elementsById[rtId];
      if (rt?.kind === 'roof_type' && rt.layers?.length) {
        rows = mapTypeLayers(rt.layers);
        layerSource = 'roof_type_stack';
        skipReason = null;
      } else {
        rows = [];
        layerSource = 'none';
        skipReason = 'roof_type_without_layers';
      }
    }

    const total = layerTotalMm(rows);
    const typeName = rtId ? typeDisplayName(elementsById, rtId, 'roof_type') : '';

    return {
      mode: 'host',
      hostElementId: selected.id,
      hostKind: 'roof',
      assemblyTypeId: rtId,
      assemblyTypeName: typeName,
      layers: rows,
      layerTotalThicknessMm: total,
      cutProxyThicknessMm: null,
      layerStackMatchesCutThickness: null,
      layerSource,
      skipReason,
    };
  }

  return null;
}

export type LayerAuthoringDraftRow = {
  index: number;
  thicknessMm: number;
  function: WallLayerFunction;
  materialKey: string;
  wrapsAtEnds?: boolean;
  wrapsAtInserts?: boolean;
};

export function materialRowsToDraft(rows: MaterialLayerRow[]): LayerAuthoringDraftRow[] {
  return rows.map((r) => ({
    index: r.index,
    thicknessMm: r.thicknessMm,
    function: r.function,
    materialKey: r.materialKey,
    wrapsAtEnds: r.wrapsAtEnds,
    wrapsAtInserts: r.wrapsAtInserts,
  }));
}

export function validateLayerAuthoringDraft(rows: LayerAuthoringDraftRow[]): string[] {
  const errs: string[] = [];
  if (!rows.length) {
    errs.push('At least one layer is required.');
  }
  for (const r of rows) {
    if (!(Number.isFinite(r.thicknessMm) && r.thicknessMm > 0)) {
      errs.push(`Layer ${r.index}: thickness must be a positive number (mm).`);
    }
    if (!ALLOWED_WALL_LAYER_FUNCTIONS.includes(r.function)) {
      errs.push(`Layer ${r.index}: unsupported function "${String(r.function)}".`);
    }
  }
  return errs;
}

export type LayeredTypeElement = Extract<
  Element,
  { kind: 'wall_type' | 'floor_type' | 'roof_type' }
>;

export function buildUpsertLayeredTypeCommand(
  el: LayeredTypeElement,
  rows: LayerAuthoringDraftRow[],
): Record<string, unknown> {
  const layers: WallTypeLayer[] = rows.map((r) => ({
    thicknessMm: roundThicknessMm(Number(r.thicknessMm)),
    function: r.function,
    materialKey: r.materialKey.trim(),
    ...(r.wrapsAtEnds ? { wrapsAtEnds: true } : {}),
    ...(r.wrapsAtInserts ? { wrapsAtInserts: true } : {}),
  }));

  if (el.kind === 'wall_type') {
    return {
      type: 'upsertWallType',
      id: el.id,
      name: (el.name ?? '').trim() || el.id,
      basisLine: el.basisLine ?? 'center',
      layers,
    };
  }
  if (el.kind === 'floor_type') {
    return {
      type: 'upsertFloorType',
      id: el.id,
      name: (el.name ?? '').trim() || el.id,
      layers,
    };
  }
  return {
    type: 'upsertRoofType',
    id: el.id,
    name: (el.name ?? '').trim() || el.id,
    layers,
  };
}

export function supportedMaterialLayerWorkbenchKinds(kind: string | undefined): boolean {
  return (
    kind === 'wall' ||
    kind === 'floor' ||
    kind === 'roof' ||
    kind === 'wall_type' ||
    kind === 'floor_type' ||
    kind === 'roof_type'
  );
}
