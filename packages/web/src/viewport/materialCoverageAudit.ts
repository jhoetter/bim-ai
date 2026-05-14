import type { Element } from '@bim-ai/core';

import {
  getBuiltInWallType,
  resolveWallAssemblyExposedLayers,
} from '../families/wallTypeCatalog';
import { resolveMaterial, type MaterialPbrSpec } from './materials';

export type MaterialAuthoritySource =
  | 'face-override'
  | 'type-layer'
  | 'instance'
  | 'subcomponent-default'
  | 'family-default'
  | 'category-fallback'
  | 'non-rendered'
  | 'unresolved';

export type MaterialCoverageFlag =
  | 'shadowed-instance-material'
  | 'unresolved-material-key'
  | 'no-editable-target'
  | 'no-3d-material'
  | 'no-subcomponent-slots'
  | 'non-rendered-by-design';

export type MaterialCoverageSubcomponent = {
  slot: string;
  materialKey: string | null;
  source: MaterialAuthoritySource;
  displayName: string | null;
  category: string | null;
  resolved: boolean;
};

export type MaterialCoverageEntry = {
  elementId: string;
  kind: Element['kind'];
  name: string | null;
  materialKey: string | null;
  source: MaterialAuthoritySource;
  displayName: string | null;
  category: string | null;
  resolved: boolean;
  editable: boolean;
  flags: MaterialCoverageFlag[];
  shadowedMaterialKey?: string | null;
  subcomponents?: MaterialCoverageSubcomponent[];
};

export type MaterialCoverageSummary = {
  total: number;
  byKind: Record<string, number>;
  bySource: Record<MaterialAuthoritySource, number>;
  flags: Record<MaterialCoverageFlag, number>;
};

export type MaterialCoverageAudit = {
  format: 'materialCoverageAudit_v1';
  entries: MaterialCoverageEntry[];
  summary: MaterialCoverageSummary;
};

function elementName(element: Element): string | null {
  return 'name' in element && typeof element.name === 'string' ? element.name : null;
}

function lastFaceOverrideMaterial(
  wall: Extract<Element, { kind: 'wall' }>,
  faceKind: 'exterior' | 'interior',
): string | null {
  const overrides = wall.faceMaterialOverrides ?? [];
  for (let index = overrides.length - 1; index >= 0; index -= 1) {
    const override = overrides[index];
    if (override?.faceKind === faceKind && override.materialKey) return override.materialKey;
  }
  return null;
}

function wallTypeExteriorMaterialKey(
  wall: Extract<Element, { kind: 'wall' }>,
  elementsById: Record<string, Element>,
): string | null {
  if (!wall.wallTypeId) return null;
  const type = elementsById[wall.wallTypeId];
  if (type?.kind === 'wall_type') return type.layers[0]?.materialKey ?? null;
  const builtIn = getBuiltInWallType(wall.wallTypeId);
  if (!builtIn) return null;
  return resolveWallAssemblyExposedLayers(builtIn).exterior?.materialKey ?? null;
}

function floorTypeTopMaterialKey(
  floor: Extract<Element, { kind: 'floor' }>,
  elementsById: Record<string, Element>,
): string | null {
  if (!floor.floorTypeId) return null;
  const type = elementsById[floor.floorTypeId];
  return type?.kind === 'floor_type' ? (type.layers[0]?.materialKey ?? null) : null;
}

function roofTypeTopMaterialKey(
  roof: Extract<Element, { kind: 'roof' }>,
  elementsById: Record<string, Element>,
): string | null {
  if (!roof.roofTypeId) return null;
  const type = elementsById[roof.roofTypeId];
  return type?.kind === 'roof_type' ? (type.layers[0]?.materialKey ?? null) : null;
}

function materialFact(
  materialKey: string | null | undefined,
  source: MaterialAuthoritySource,
  elementsById: Record<string, Element>,
): Pick<
  MaterialCoverageEntry,
  'materialKey' | 'source' | 'displayName' | 'category' | 'resolved'
> {
  const key = materialKey ?? null;
  const spec = resolveMaterial(key, elementsById);
  return {
    materialKey: key,
    source: key && !spec ? 'unresolved' : source,
    displayName: spec?.displayName ?? null,
    category: spec?.category ?? null,
    resolved: !key || !!spec,
  };
}

function subcomponentFact(
  slot: string,
  materialKey: string | null | undefined,
  source: MaterialAuthoritySource,
  elementsById: Record<string, Element>,
): MaterialCoverageSubcomponent {
  const spec = resolveMaterial(materialKey, elementsById);
  return {
    slot,
    materialKey: materialKey ?? null,
    source: materialKey && !spec ? 'unresolved' : source,
    displayName: spec?.displayName ?? null,
    category: spec?.category ?? null,
    resolved: !materialKey || !!spec,
  };
}

function materialSlot(
  slots: Record<string, string | null> | null | undefined,
  slot: string,
): string | null | undefined {
  const value = slots?.[slot];
  if (typeof value === 'string') return value.trim() ? value : null;
  return value;
}

function categoryFallback(element: Element): MaterialCoverageEntry {
  return {
    elementId: element.id,
    kind: element.kind,
    name: elementName(element),
    materialKey: null,
    source: 'category-fallback',
    displayName: null,
    category: null,
    resolved: true,
    editable: false,
    flags: ['no-editable-target'],
  };
}

function nonRendered(element: Element): MaterialCoverageEntry {
  return {
    elementId: element.id,
    kind: element.kind,
    name: elementName(element),
    materialKey: null,
    source: 'non-rendered',
    displayName: null,
    category: null,
    resolved: true,
    editable: false,
    flags: ['non-rendered-by-design'],
  };
}

function entryForMaterial(
  element: Element,
  fact: ReturnType<typeof materialFact>,
  editable: boolean,
  flags: MaterialCoverageFlag[] = [],
  extras: Partial<MaterialCoverageEntry> = {},
): MaterialCoverageEntry {
  if (!fact.resolved && fact.materialKey) flags.push('unresolved-material-key');
  return {
    elementId: element.id,
    kind: element.kind,
    name: elementName(element),
    ...fact,
    editable,
    flags,
    ...extras,
  };
}

export function auditElementMaterialCoverage(
  elementsById: Record<string, Element>,
): MaterialCoverageAudit {
  const entries = Object.values(elementsById).flatMap((element): MaterialCoverageEntry[] => {
    switch (element.kind) {
      case 'wall': {
        const faceOverride = lastFaceOverrideMaterial(element, 'exterior');
        if (faceOverride) {
          return [
            entryForMaterial(
              element,
              materialFact(faceOverride, 'face-override', elementsById),
              true,
            ),
          ];
        }
        const typeMaterial = wallTypeExteriorMaterialKey(element, elementsById);
        if (typeMaterial) {
          const flags: MaterialCoverageFlag[] =
            element.materialKey && element.materialKey !== typeMaterial
              ? ['shadowed-instance-material']
              : [];
          return [
            entryForMaterial(
              element,
              materialFact(typeMaterial, 'type-layer', elementsById),
              !!(element.wallTypeId && elementsById[element.wallTypeId]?.kind === 'wall_type'),
              flags,
              { shadowedMaterialKey: flags.length ? element.materialKey : null },
            ),
          ];
        }
        if (element.materialKey) {
          return [
            entryForMaterial(
              element,
              materialFact(element.materialKey, 'instance', elementsById),
              true,
            ),
          ];
        }
        return [categoryFallback(element)];
      }

      case 'floor': {
        const materialKey = floorTypeTopMaterialKey(element, elementsById);
        if (materialKey) {
          return [
            entryForMaterial(
              element,
              materialFact(materialKey, 'type-layer', elementsById),
              !!(element.floorTypeId && elementsById[element.floorTypeId]?.kind === 'floor_type'),
            ),
          ];
        }
        return [categoryFallback(element)];
      }

      case 'roof': {
        const typeMaterial = roofTypeTopMaterialKey(element, elementsById);
        if (typeMaterial) {
          const flags: MaterialCoverageFlag[] =
            element.materialKey && element.materialKey !== typeMaterial
              ? ['shadowed-instance-material']
              : [];
          return [
            entryForMaterial(
              element,
              materialFact(typeMaterial, 'type-layer', elementsById),
              !!(element.roofTypeId && elementsById[element.roofTypeId]?.kind === 'roof_type'),
              flags,
              { shadowedMaterialKey: flags.length ? element.materialKey : null },
            ),
          ];
        }
        if (element.materialKey) {
          return [
            entryForMaterial(
              element,
              materialFact(element.materialKey, 'instance', elementsById),
              true,
            ),
          ];
        }
        return [categoryFallback(element)];
      }

      case 'door': {
        const frameKey = materialSlot(element.materialSlots, 'frame') ?? element.materialKey;
        const panelKey = materialSlot(element.materialSlots, 'panel') ?? element.materialKey;
        const source = element.materialKey ? 'instance' : 'family-default';
        const fact = materialFact(frameKey, source, elementsById);
        return [
          entryForMaterial(element, fact, true, [], {
            subcomponents: [
              subcomponentFact('frame', frameKey, source, elementsById),
              subcomponentFact('panel', panelKey, source, elementsById),
            ],
          }),
        ];
      }

      case 'window': {
        const frameKey = materialSlot(element.materialSlots, 'frame') ?? element.materialKey;
        const glassKey =
          materialSlot(element.materialSlots, 'glass') ?? 'asset_clear_glass_double';
        const frameSource = element.materialKey ? 'instance' : 'family-default';
        const fact = materialFact(frameKey, frameSource, elementsById);
        return [
          entryForMaterial(element, fact, true, [], {
            subcomponents: [
              subcomponentFact('frame', frameKey, frameSource, elementsById),
              subcomponentFact('glass', glassKey, 'subcomponent-default', elementsById),
            ],
          }),
        ];
      }

      case 'column':
      case 'beam':
      case 'text_3d':
      case 'sweep':
      case 'mass':
      case 'pipe': {
        if (element.materialKey) {
          return [
            entryForMaterial(
              element,
              materialFact(element.materialKey, 'instance', elementsById),
              true,
            ),
          ];
        }
        return [categoryFallback(element)];
      }

      case 'toposolid': {
        if (element.defaultMaterialKey) {
          return [
            entryForMaterial(
              element,
              materialFact(element.defaultMaterialKey, 'instance', elementsById),
              true,
            ),
          ];
        }
        return [categoryFallback(element)];
      }

      case 'toposolid_subdivision': {
        if (element.materialKey) {
          return [
            entryForMaterial(
              element,
              materialFact(element.materialKey, 'instance', elementsById),
              true,
            ),
          ];
        }
        return [categoryFallback(element)];
      }

      case 'stair': {
        const treadKey =
          materialSlot(element.materialSlots, 'tread') ??
          (element.subKind === 'monolithic' ? element.monolithicMaterial : null);
        const riserKey =
          materialSlot(element.materialSlots, 'riser') ??
          (element.subKind === 'monolithic' ? element.monolithicMaterial : null);
        const stringerKey =
          materialSlot(element.materialSlots, 'stringer') ??
          materialSlot(element.materialSlots, 'support') ??
          (element.subKind === 'monolithic' ? element.monolithicMaterial : null);
        const landingKey =
          materialSlot(element.materialSlots, 'landing') ??
          (element.subKind === 'monolithic' ? element.monolithicMaterial : null);
        const source = treadKey ? 'instance' : 'family-default';
        return [
          entryForMaterial(element, materialFact(treadKey, source, elementsById), true, [], {
            subcomponents: [
              subcomponentFact('tread', treadKey, source, elementsById),
              subcomponentFact('riser', riserKey, source, elementsById),
              subcomponentFact('stringer', stringerKey, source, elementsById),
              subcomponentFact('landing', landingKey, source, elementsById),
            ],
          }),
        ];
      }

      case 'railing': {
        const topRailKey = materialSlot(element.materialSlots, 'topRail');
        const postKey = materialSlot(element.materialSlots, 'post');
        const balusterKey = materialSlot(element.materialSlots, 'baluster');
        const panelKey = materialSlot(element.materialSlots, 'panel');
        const cableKey = materialSlot(element.materialSlots, 'cable');
        const bracketKey = materialSlot(element.materialSlots, 'bracket');
        const primaryKey = topRailKey ?? postKey ?? balusterKey ?? panelKey ?? cableKey ?? null;
        const source = primaryKey ? 'instance' : 'family-default';
        return [
          entryForMaterial(element, materialFact(primaryKey, source, elementsById), true, [], {
            subcomponents: [
              subcomponentFact('topRail', topRailKey, source, elementsById),
              subcomponentFact('post', postKey, source, elementsById),
              subcomponentFact('baluster', balusterKey, source, elementsById),
              subcomponentFact('panel', panelKey, source, elementsById),
              subcomponentFact('cable', cableKey, source, elementsById),
              subcomponentFact('bracket', bracketKey, source, elementsById),
            ],
          }),
        ];
      }

      case 'ceiling':
      case 'balcony':
      case 'soffit':
      case 'edge_profile_run':
      case 'dormer':
      case 'site':
      case 'duct':
        return [categoryFallback(element)];

      case 'room':
      case 'area':
      case 'wall_type':
      case 'floor_type':
      case 'roof_type':
      case 'material':
      case 'image_asset':
        return [nonRendered(element)];

      default:
        return [];
    }
  });

  return {
    format: 'materialCoverageAudit_v1',
    entries,
    summary: summarizeMaterialCoverage(entries),
  };
}

export function summarizeMaterialCoverage(
  entries: MaterialCoverageEntry[],
): MaterialCoverageSummary {
  const byKind: Record<string, number> = {};
  const bySource = {
    'face-override': 0,
    'type-layer': 0,
    instance: 0,
    'subcomponent-default': 0,
    'family-default': 0,
    'category-fallback': 0,
    'non-rendered': 0,
    unresolved: 0,
  } satisfies Record<MaterialAuthoritySource, number>;
  const flags = {
    'shadowed-instance-material': 0,
    'unresolved-material-key': 0,
    'no-editable-target': 0,
    'no-3d-material': 0,
    'no-subcomponent-slots': 0,
    'non-rendered-by-design': 0,
  } satisfies Record<MaterialCoverageFlag, number>;

  for (const entry of entries) {
    byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1;
    bySource[entry.source] += 1;
    for (const flag of entry.flags) flags[flag] += 1;
  }

  return {
    total: entries.length,
    byKind,
    bySource,
    flags,
  };
}
