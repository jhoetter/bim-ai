/**
 * Family Library browser panel — FL-06 + FAM-08.
 *
 * Modal panel that surfaces the full BUILT_IN_FAMILIES catalog and any
 * project-local custom `family_type` / `wall_type` / `floor_type` /
 * `roof_type` elements, grouped by discipline. Search filters family +
 * type names; "Place" sets the active draw tool with `familyTypeId`
 * pre-loaded and closes the panel.
 *
 * FAM-08 — adds catalog-backed families fed by GET /api/family-catalogs.
 * Placing a catalog family invokes `onPlaceCatalogFamily`; the
 * host loads the family into the project and then resolves placement through
 * the same category-specific placement adapters used by in-project families.
 */

import { useEffect, useMemo, useState, type JSX } from 'react';

import type {
  AssetCategory,
  AssetLibraryEntry,
  Element,
  FamilyDiscipline,
  ParamSchemaEntry,
} from '@bim-ai/core';

import { BUILT_IN_FAMILIES } from './familyCatalog';
import { BUILT_IN_WALL_TYPES } from './wallTypeCatalog';
import { validateFormula } from '../lib/expressionEvaluator';
import {
  getFamilyTypeThumbnail,
  getFloorTypeThumbnail,
  getThumbnail,
  getRoofTypeThumbnail,
  getWallTypeThumbnail,
  PLACEHOLDER_THUMBNAIL,
  type FamilyTypeThumbnailInput,
  type WallThumbnailLayerInput,
} from './thumbnailCache';
import { RenderedAssetThumbnail } from '../workspace/library/AssetCard';
import {
  ASSET_CATEGORY_FAMILY_GROUPS,
  placeKindForFamilyDiscipline,
  type FamilyLibraryPlaceKind,
} from './familyPlacementAdapters';
import {
  findLoadedCatalogFamilyType,
  type FamilyReloadOverwriteOption,
} from './catalogFamilyReload';
import type {
  FamilyDefinition,
  FamilyDefinitionCategorySettings,
  FamilyGeometryNode,
  FamilyParamDef,
  FamilySymbolicLine,
} from './types';

export type { FamilyLibraryPlaceKind } from './familyPlacementAdapters';

/**
 * FAM-08 wire shape for one family inside an external catalog. Mirrors
 * the server-side `FamilyDefinition` payload returned by
 * GET /api/family-catalogs/:id but with only the fields the panel reads.
 */
export interface ExternalCatalogFamily {
  id: string;
  name: string;
  discipline: FamilyDiscipline;
  categorySettings?: FamilyDefinitionCategorySettings;
  params?: FamilyParamDef[];
  defaultTypes: {
    id: string;
    name: string;
    familyId: string;
    discipline: FamilyDiscipline;
    parameters: Record<string, unknown>;
  }[];
  geometry?: FamilyGeometryNode[];
  symbolicLines?: FamilySymbolicLine[];
  nestedDefinitions?: FamilyDefinition[];
}

export interface ExternalCatalogIndexEntry {
  catalogId: string;
  name: string;
  description: string;
  version: string;
  thumbnailsBaseUrl: string | null;
  familyCount: number;
}

export interface ExternalCatalogPayload {
  catalogId: string;
  name: string;
  version: string;
  description: string;
  thumbnailsBaseUrl: string | null;
  families: ExternalCatalogFamily[];
}

export interface ExternalCatalogPlacement {
  catalogId: string;
  catalogName: string;
  catalogVersion: string;
  family: ExternalCatalogFamily;
  defaultType: ExternalCatalogFamily['defaultTypes'][number];
  assetEntry?: AssetLibraryEntry;
}

export interface ExternalCatalogClient {
  /** Fetch the catalog index. */
  listCatalogs(): Promise<ExternalCatalogIndexEntry[]>;
  /** Fetch one catalog payload. */
  getCatalog(catalogId: string): Promise<ExternalCatalogPayload>;
}

export type FamilyLibraryArrayFormulaTarget =
  | { kind: 'asset'; assetId: string }
  | { kind: 'catalog_family'; placement: ExternalCatalogPlacement };

export interface FamilyLibraryArrayFormulaUpdate {
  target: FamilyLibraryArrayFormulaTarget;
  paramKey: string;
  formula: string;
}

export interface FamilyLibraryPanelProps {
  open: boolean;
  onClose: () => void;
  elementsById: Record<string, Element>;
  /** Invoked when an in-project type's "Place" button is clicked. */
  onPlaceType: (kind: FamilyLibraryPlaceKind, typeId: string) => void;
  /**
   * FAM-08 — invoked when a Place button on an external-catalog family is
   * clicked. The host is responsible for loading the family into the
   * project and resolving the family category to its placement adapter.
   * The panel closes afterwards.
   */
  onPlaceCatalogFamily?: (
    placement: ExternalCatalogPlacement,
    overwriteOption?: FamilyReloadOverwriteOption,
  ) => void;
  /**
   * F-060 — invoked when an external-catalog family should be loaded into the
   * project without immediately entering placement mode.
   */
  onLoadCatalogFamily?: (
    placement: ExternalCatalogPlacement,
    overwriteOption?: FamilyReloadOverwriteOption,
  ) => void;
  /**
   * F-089 — invoked when the warehouse formula editor saves an array-count
   * formula exposed by a project asset or external catalog family.
   */
  onUpdateArrayFormula?: (update: FamilyLibraryArrayFormulaUpdate) => void;
  /**
   * Optional client for the external-catalog API. Provided so tests can
   * inject a stub without spinning up the real fetch path. Defaults to a
   * fetch-backed implementation that hits `/api/family-catalogs`.
   */
  catalogClient?: ExternalCatalogClient;
}

interface CatalogEntry {
  id: string;
  name: string;
  familyName: string;
  custom: boolean;
  kind: FamilyLibraryPlaceKind;
  catalogLabel?: string;
  catalogPlacement?: ExternalCatalogPlacement;
  assetEntry?: AssetLibraryEntry;
  arrayFormulas?: ArrayFormulaDescriptor[];
  familyTypeThumbnail?: Omit<FamilyTypeThumbnailInput, 'id' | 'name'>;
  wallThumbnail?: {
    layers: WallThumbnailLayerInput[];
    basisLine?: 'center' | 'face_interior' | 'face_exterior';
  };
  assemblyThumbnail?: {
    kind: 'floor_type' | 'roof_type';
    layers: WallThumbnailLayerInput[];
  };
  searchText?: string;
}

interface ArrayFormulaDescriptor {
  target: FamilyLibraryArrayFormulaTarget;
  paramKey: string;
  label: string;
  formula: string;
  knownParams: string[];
}

interface AssetCatalogGroup {
  id: `asset-${AssetCategory}`;
  label: string;
  entries: CatalogEntry[];
}

interface LoadedCatalogFamiliesState {
  groups: AssetCatalogGroup[];
  loading: boolean;
  error: string | null;
}

const DISCIPLINE_ORDER: {
  id: FamilyDiscipline;
  label: string;
  placeKind: FamilyLibraryPlaceKind;
}[] = [
  { id: 'door', label: 'Doors', placeKind: 'door' },
  { id: 'window', label: 'Windows', placeKind: 'window' },
  { id: 'stair', label: 'Stairs', placeKind: 'stair' },
  { id: 'railing', label: 'Railings', placeKind: 'railing' },
  { id: 'wall_type', label: 'Wall Types', placeKind: 'wall_type' },
  { id: 'floor_type', label: 'Floor Types', placeKind: 'floor_type' },
  { id: 'roof_type', label: 'Roof Types', placeKind: 'roof_type' },
  { id: 'generic', label: 'Component Families', placeKind: 'component_family' },
];

const DEFAULT_CATALOG_CLIENT: ExternalCatalogClient = {
  async listCatalogs() {
    const res = await fetch('/api/family-catalogs');
    if (!res.ok) throw new Error(`HTTP ${res.status} listing family catalogs`);
    const json = (await res.json()) as { catalogs?: ExternalCatalogIndexEntry[] };
    return json.catalogs ?? [];
  },
  async getCatalog(catalogId) {
    const res = await fetch(`/api/family-catalogs/${encodeURIComponent(catalogId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading catalog ${catalogId}`);
    return (await res.json()) as ExternalCatalogPayload;
  },
};

function buildCatalogByDiscipline(
  elementsById: Record<string, Element>,
): Record<FamilyDiscipline, CatalogEntry[]> {
  const out: Partial<Record<FamilyDiscipline, CatalogEntry[]>> = {};
  for (const fam of BUILT_IN_FAMILIES) {
    const bucket = (out[fam.discipline] ??= []);
    for (const t of fam.defaultTypes) {
      bucket.push({
        id: t.id,
        name: t.name,
        familyName: fam.name,
        custom: false,
        kind: placeKindForFamilyDiscipline(fam.discipline),
      });
    }
  }
  for (const wt of BUILT_IN_WALL_TYPES) {
    const bucket = (out['wall_type'] ??= []);
    bucket.push({
      id: wt.id,
      name: wt.name,
      familyName: `${wt.layers.length} layers · ${wt.layers
        .reduce((acc, l) => acc + l.thicknessMm, 0)
        .toFixed(0)}mm`,
      custom: false,
      kind: 'wall_type',
      wallThumbnail: { layers: wt.layers, basisLine: wt.basisLine },
    });
  }

  for (const el of Object.values(elementsById)) {
    if (el.kind === 'family_type') {
      const bucket = (out[el.discipline] ??= []);
      const cs = el.catalogSource;
      bucket.push({
        id: el.id,
        name: String(el.parameters.name ?? el.name ?? el.id),
        familyName: cs ? `From: ${cs.catalogId}` : 'Custom',
        custom: !cs,
        kind: placeKindForFamilyDiscipline(el.discipline),
        catalogLabel: cs ? cs.catalogId : undefined,
        familyTypeThumbnail: {
          familyId: el.familyId,
          discipline: el.discipline,
          parameters: el.parameters,
        },
      });
    } else if (el.kind === 'wall_type') {
      const bucket = (out['wall_type'] ??= []);
      bucket.push({
        id: el.id,
        name: el.name,
        familyName: `${el.layers.length} layers`,
        custom: true,
        kind: 'wall_type',
        wallThumbnail: { layers: el.layers, basisLine: el.basisLine },
      });
    } else if (el.kind === 'floor_type') {
      const bucket = (out['floor_type'] ??= []);
      bucket.push({
        id: el.id,
        name: el.name,
        familyName: `${el.layers.length} layers`,
        custom: true,
        kind: 'floor_type',
        assemblyThumbnail: { kind: 'floor_type', layers: el.layers },
      });
    } else if (el.kind === 'roof_type') {
      const bucket = (out['roof_type'] ??= []);
      bucket.push({
        id: el.id,
        name: el.name,
        familyName: `${el.layers.length} layers`,
        custom: true,
        kind: 'roof_type',
        assemblyThumbnail: { kind: 'roof_type', layers: el.layers },
      });
    }
  }
  return out as Record<FamilyDiscipline, CatalogEntry[]>;
}

function assetElementToLibraryEntry(
  el: Extract<Element, { kind: 'asset_library_entry' }>,
): AssetLibraryEntry {
  return {
    id: el.id,
    assetKind: el.assetKind,
    name: el.name,
    tags: el.tags,
    category: el.category,
    disciplineTags: el.disciplineTags,
    thumbnailKind: el.thumbnailKind,
    thumbnailMm:
      el.thumbnailWidthMm != null
        ? {
            widthMm: el.thumbnailWidthMm,
            heightMm: el.thumbnailHeightMm ?? el.thumbnailWidthMm,
          }
        : undefined,
    planSymbolKind: el.planSymbolKind,
    renderProxyKind: el.renderProxyKind,
    paramSchema: el.paramSchema,
    publishedFromOrgId: el.publishedFromOrgId,
    description: el.description,
  };
}

function buildAssetCatalogGroups(elementsById: Record<string, Element>): AssetCatalogGroup[] {
  const buckets: Partial<Record<AssetCategory, CatalogEntry[]>> = {};
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'asset_library_entry') continue;
    const entry = assetElementToLibraryEntry(el);
    const arrayFormulas = assetArrayFormulaDescriptors(entry);
    const bucket = (buckets[entry.category] ??= []);
    bucket.push({
      id: entry.id,
      name: entry.name,
      familyName: entry.description ?? (entry.tags.slice(0, 3).join(' · ') || 'Interior family'),
      custom: false,
      kind: 'asset',
      assetEntry: entry,
      arrayFormulas,
      searchText: [
        entry.category,
        ...entry.tags,
        entry.planSymbolKind,
        entry.renderProxyKind,
        ...arrayFormulas.flatMap((formula) => [formula.paramKey, formula.formula]),
      ]
        .filter(Boolean)
        .join(' '),
    });
  }
  return ASSET_CATEGORY_FAMILY_GROUPS.map(({ id, label }) => ({
    id: `asset-${id}` as const,
    label,
    entries: (buckets[id] ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.entries.length > 0);
}

function inferCatalogAssetCategory(
  catalog: ExternalCatalogPayload | ExternalCatalogIndexEntry,
  family: ExternalCatalogFamily,
): AssetCategory {
  const familyText = `${family.id} ${family.name}`.toLowerCase().replace(/[-_:]/g, ' ');
  const catalogText = `${catalog.catalogId} ${catalog.name} ${catalog.description}`
    .toLowerCase()
    .replace(/[-_:]/g, ' ');
  if (/\b(bath|bathroom|toilet|wc|basin|washbasin|shower|tub)\b/.test(familyText)) {
    return 'bathroom';
  }
  if (/\b(counter|cabinet|casework|island|wardrobe|closet|cupboard)\b/.test(familyText)) {
    return 'casework';
  }
  if (/\b(kitchen|sink|oven|fridge|refrigerator|appliance)\b/.test(familyText)) {
    return 'kitchen';
  }
  if (/\b(door)\b/.test(familyText)) return 'door';
  if (/\b(window)\b/.test(familyText)) return 'window';
  if (/\b(bath|bathroom|plumbing)\b/.test(catalogText)) return 'bathroom';
  if (/\b(kitchen|appliance)\b/.test(catalogText)) return 'kitchen';
  if (/\b(casework)\b/.test(catalogText)) return 'casework';
  return 'furniture';
}

function inferCatalogSymbolKind(
  family: ExternalCatalogFamily,
): NonNullable<AssetLibraryEntry['renderProxyKind']> {
  const text = `${family.id} ${family.name}`.toLowerCase().replace(/[-_:]/g, ' ');
  if (/\b(bed|mattress|queen|king|single\s+bed|double\s+bed)\b/.test(text)) return 'bed';
  if (/\b(wardrobe|closet|robe|storage|cupboard)\b/.test(text)) return 'wardrobe';
  if (/\b(lamp|light|floor\s+lamp|table\s+lamp)\b/.test(text)) return 'lamp';
  if (/\b(rug|carpet|mat)\b/.test(text)) return 'rug';
  if (/\b(fridge|refrigerator|freezer)\b/.test(text)) return 'fridge';
  if (/\b(oven|cooker|range|hob|cooktop)\b/.test(text)) return 'oven';
  if (/\b(sink|basin|washbasin)\b/.test(text)) return 'sink';
  if (/\b(counter|cabinet|casework|island|worktop)\b/.test(text)) return 'counter';
  if (/\b(sofa|couch|settee)\b/.test(text)) return 'sofa';
  if (/\b(table|desk)\b/.test(text)) return 'table';
  if (/\b(chair|armchair|lounge\s+chair)\b/.test(text)) return 'chair';
  if (/\b(toilet|wc)\b/.test(text)) return 'toilet';
  if (/\b(bath|bathtub|tub)\b/.test(text)) return 'bath';
  if (/\b(shower)\b/.test(text)) return 'shower';
  return 'generic';
}

function dimensionsFromParameters(
  params: Record<string, unknown>,
): { widthMm: number; heightMm: number } | undefined {
  const width =
    typeof params.widthMm === 'number'
      ? params.widthMm
      : typeof params.lengthMm === 'number'
        ? params.lengthMm
        : undefined;
  const height =
    typeof params.depthMm === 'number'
      ? params.depthMm
      : typeof params.heightMm === 'number'
        ? params.heightMm
        : undefined;
  if (width == null && height == null) return undefined;
  const resolvedWidth = width ?? height ?? 64;
  const resolvedHeight = height ?? width ?? resolvedWidth;
  return { widthMm: resolvedWidth, heightMm: resolvedHeight };
}

type AssetParamSchemaWithFormula = ParamSchemaEntry & {
  label?: string;
  formula?: string | null;
  arrayFormula?: string | null;
  arrayCountParam?: boolean;
};

function stringFromUnknown(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formulaFromAssetParam(param: ParamSchemaEntry): string | null {
  const extended = param as AssetParamSchemaWithFormula;
  const direct = stringFromUnknown(extended.formula) ?? stringFromUnknown(extended.arrayFormula);
  if (direct != null) return direct;
  const constraints = objectRecord(param.constraints);
  return (
    stringFromUnknown(constraints?.formula) ?? stringFromUnknown(constraints?.arrayFormula) ?? null
  );
}

function isArrayParam(param: ParamSchemaEntry | FamilyParamDef, arrayCountParams?: Set<string>) {
  if (arrayCountParams?.has(param.key)) return true;
  const key = param.key.toLowerCase();
  if (key.startsWith('array_') || key.includes('array')) return true;
  const constraints = 'constraints' in param ? objectRecord(param.constraints) : null;
  return (
    constraints?.arrayCountParam === true ||
    (param as AssetParamSchemaWithFormula).arrayCountParam === true
  );
}

function labelForAssetParam(param: ParamSchemaEntry): string {
  const label = stringFromUnknown((param as AssetParamSchemaWithFormula).label);
  return label ?? param.key;
}

function collectArrayCountParams(nodes: unknown, out = new Set<string>()): Set<string> {
  if (!Array.isArray(nodes)) return out;
  for (const node of nodes) {
    const record = objectRecord(node);
    if (!record) continue;
    if (record.kind === 'array' && typeof record.countParam === 'string') {
      out.add(record.countParam);
    }
    if (record.target) collectArrayCountParams([record.target], out);
    if (Array.isArray(record.geometry)) collectArrayCountParams(record.geometry, out);
  }
  return out;
}

function assetArrayFormulaDescriptors(entry: AssetLibraryEntry): ArrayFormulaDescriptor[] {
  const params = entry.paramSchema ?? [];
  const knownParams = params.map((p) => p.key);
  return params
    .filter((param) => isArrayParam(param))
    .map((param) => ({
      target: { kind: 'asset' as const, assetId: entry.id },
      paramKey: param.key,
      label: labelForAssetParam(param),
      formula: formulaFromAssetParam(param) ?? '',
      knownParams,
    }));
}

function catalogArrayFormulaDescriptors(
  placement: ExternalCatalogPlacement,
): ArrayFormulaDescriptor[] {
  const params = placement.family.params ?? [];
  const arrayCountParams = collectArrayCountParams(placement.family.geometry);
  const knownParams = params.map((p) => p.key);
  return params
    .filter((param) => isArrayParam(param, arrayCountParams))
    .map((param) => ({
      target: { kind: 'catalog_family' as const, placement },
      paramKey: param.key,
      label: param.label || param.key,
      formula: param.formula ?? '',
      knownParams,
    }));
}

function catalogFamilyToEntry(
  catalog: ExternalCatalogPayload,
  family: ExternalCatalogFamily,
): CatalogEntry | null {
  const defaultType = family.defaultTypes[0];
  if (!defaultType) return null;

  const category = inferCatalogAssetCategory(catalog, family);
  const symbolKind = inferCatalogSymbolKind(family);
  const dimensions = dimensionsFromParameters(defaultType.parameters);
  const familyTypeCount = `${family.defaultTypes.length} type${
    family.defaultTypes.length === 1 ? '' : 's'
  }`;
  const assetEntry: AssetLibraryEntry = {
    id: family.id,
    assetKind: 'family_instance',
    name: family.name,
    tags: [category, catalog.catalogId, catalog.name, family.discipline],
    category,
    thumbnailKind: 'schematic_plan',
    thumbnailMm: dimensions,
    planSymbolKind: symbolKind,
    renderProxyKind: symbolKind,
    description: `${catalog.name} · ${familyTypeCount}`,
  };
  const placement: ExternalCatalogPlacement = {
    catalogId: catalog.catalogId,
    catalogName: catalog.name,
    catalogVersion: catalog.version,
    family,
    defaultType,
    assetEntry,
  };

  return {
    id: family.id,
    name: family.name,
    familyName: `${catalog.name} · ${familyTypeCount}`,
    custom: false,
    kind: placeKindForFamilyDiscipline(family.discipline),
    catalogLabel: catalog.name,
    catalogPlacement: placement,
    assetEntry,
    arrayFormulas: catalogArrayFormulaDescriptors(placement),
    searchText: [
      catalog.catalogId,
      catalog.name,
      catalog.description,
      family.discipline,
      ...family.defaultTypes.map((type) => type.name),
      ...(family.params ?? []).flatMap((param) => [param.key, param.label, param.formula]),
    ]
      .filter(Boolean)
      .join(' '),
  };
}

function buildCatalogFamilyGroups(catalogs: ExternalCatalogPayload[]): AssetCatalogGroup[] {
  const buckets: Partial<Record<AssetCategory, CatalogEntry[]>> = {};
  for (const catalog of catalogs) {
    for (const family of catalog.families) {
      const entry = catalogFamilyToEntry(catalog, family);
      if (!entry) continue;
      const category = entry.assetEntry?.category ?? inferCatalogAssetCategory(catalog, family);
      const bucket = (buckets[category] ??= []);
      bucket.push(entry);
    }
  }
  return ASSET_CATEGORY_FAMILY_GROUPS.map(({ id, label }) => ({
    id: `asset-${id}` as const,
    label,
    entries: (buckets[id] ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.entries.length > 0);
}

function mergeAssetCatalogGroups(
  localGroups: AssetCatalogGroup[],
  catalogGroups: AssetCatalogGroup[],
): AssetCatalogGroup[] {
  const byId = new Map<AssetCatalogGroup['id'], AssetCatalogGroup>();
  for (const group of [...localGroups, ...catalogGroups]) {
    const existing = byId.get(group.id);
    if (existing) {
      existing.entries.push(...group.entries);
      existing.entries.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      byId.set(group.id, { ...group, entries: [...group.entries] });
    }
  }
  return ASSET_CATEGORY_FAMILY_GROUPS.map(({ id }) => byId.get(`asset-${id}` as const)).filter(
    (group): group is AssetCatalogGroup => Boolean(group),
  );
}

function matchesNeedle(entry: CatalogEntry, needle: string): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  return (
    entry.name.toLowerCase().includes(n) ||
    entry.familyName.toLowerCase().includes(n) ||
    Boolean(entry.searchText?.toLowerCase().includes(n))
  );
}

function TypeThumbnail({ typeId, name }: { typeId: string; name: string }): JSX.Element {
  const [src, setSrc] = useState<string>(PLACEHOLDER_THUMBNAIL);

  useEffect(() => {
    let cancelled = false;
    void getThumbnail(typeId).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [typeId]);

  return (
    <img
      src={src}
      alt={name}
      width={64}
      height={64}
      className="rounded border border-border bg-surface-muted"
      style={{ objectFit: 'cover' }}
    />
  );
}

function FamilyTypeThumbnail({
  id,
  name,
  thumbnail,
}: {
  id: string;
  name: string;
  thumbnail: NonNullable<CatalogEntry['familyTypeThumbnail']>;
}): JSX.Element {
  const [src, setSrc] = useState<string>(PLACEHOLDER_THUMBNAIL);

  useEffect(() => {
    let cancelled = false;
    void getFamilyTypeThumbnail({
      id,
      name,
      familyId: thumbnail.familyId,
      discipline: thumbnail.discipline,
      parameters: thumbnail.parameters,
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [id, name, thumbnail]);

  return (
    <img
      src={src}
      alt={name}
      width={64}
      height={64}
      data-testid="family-type-rendered-thumbnail"
      className="rounded border border-border bg-surface-muted"
      style={{ objectFit: 'cover' }}
    />
  );
}

function WallTypeThumbnail({
  id,
  name,
  thumbnail,
}: {
  id: string;
  name: string;
  thumbnail: NonNullable<CatalogEntry['wallThumbnail']>;
}): JSX.Element {
  const [src, setSrc] = useState<string>(PLACEHOLDER_THUMBNAIL);

  useEffect(() => {
    let cancelled = false;
    void getWallTypeThumbnail({
      id,
      name,
      layers: thumbnail.layers,
      basisLine: thumbnail.basisLine,
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [id, name, thumbnail]);

  return (
    <img
      src={src}
      alt={name}
      width={64}
      height={64}
      data-testid="wall-type-rendered-thumbnail"
      className="rounded border border-border bg-surface-muted"
      style={{ objectFit: 'cover' }}
    />
  );
}

function AssemblyTypeThumbnail({
  id,
  name,
  thumbnail,
}: {
  id: string;
  name: string;
  thumbnail: NonNullable<CatalogEntry['assemblyThumbnail']>;
}): JSX.Element {
  const [src, setSrc] = useState<string>(PLACEHOLDER_THUMBNAIL);

  useEffect(() => {
    let cancelled = false;
    const load =
      thumbnail.kind === 'floor_type'
        ? getFloorTypeThumbnail({ id, name, layers: thumbnail.layers })
        : getRoofTypeThumbnail({ id, name, layers: thumbnail.layers });
    void load.then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [id, name, thumbnail]);

  return (
    <img
      src={src}
      alt={name}
      width={64}
      height={64}
      data-testid={`${thumbnail.kind}-rendered-thumbnail`}
      className="rounded border border-border bg-surface-muted"
      style={{ objectFit: 'cover' }}
    />
  );
}

function CatalogThumbnail({ entry }: { entry: CatalogEntry }): JSX.Element {
  if (entry.assetEntry) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded border border-border bg-surface-muted">
        <RenderedAssetThumbnail entry={entry.assetEntry} />
      </div>
    );
  }
  if (entry.kind === 'wall_type' && entry.wallThumbnail) {
    return <WallTypeThumbnail id={entry.id} name={entry.name} thumbnail={entry.wallThumbnail} />;
  }
  if (entry.familyTypeThumbnail) {
    return (
      <FamilyTypeThumbnail id={entry.id} name={entry.name} thumbnail={entry.familyTypeThumbnail} />
    );
  }
  if ((entry.kind === 'floor_type' || entry.kind === 'roof_type') && entry.assemblyThumbnail) {
    return (
      <AssemblyTypeThumbnail id={entry.id} name={entry.name} thumbnail={entry.assemblyThumbnail} />
    );
  }
  return <TypeThumbnail typeId={entry.id} name={entry.name} />;
}

function ArrayFormulaEditor({
  descriptor,
  onUpdate,
}: {
  descriptor: ArrayFormulaDescriptor;
  onUpdate?: (update: FamilyLibraryArrayFormulaUpdate) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(descriptor.formula);
  const targetId =
    descriptor.target.kind === 'asset'
      ? descriptor.target.assetId
      : descriptor.target.placement.family.id;
  const inputId = `array-formula-${targetId}-${descriptor.paramKey}`.replace(
    /[^A-Za-z0-9_-]/g,
    '-',
  );

  useEffect(() => {
    setDraft(descriptor.formula);
  }, [descriptor.formula, descriptor.paramKey]);

  const error = validateFormula(draft, descriptor.knownParams);
  const changed = draft.trim() !== descriptor.formula.trim();
  const canSave = Boolean(onUpdate) && changed && !error;

  return (
    <div
      data-testid={`array-formula-editor-${descriptor.paramKey}`}
      className="mt-2 rounded-md border border-border bg-surface-strong px-2 py-2"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-xs font-medium text-foreground">
          {descriptor.label}
        </label>
        <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted">
          Array formula
        </span>
      </div>
      <div className="flex items-start gap-2">
        <input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={`Array formula ${descriptor.paramKey}`}
          aria-invalid={Boolean(error)}
          data-testid={`array-formula-input-${descriptor.paramKey}`}
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent/40"
          placeholder="e.g. max(1, rounddown(Width / ChairSlotPitch))"
        />
        <button
          type="button"
          disabled={!canSave}
          data-testid={`array-formula-save-${descriptor.paramKey}`}
          onClick={() => {
            if (!canSave) return;
            onUpdate?.({
              target: descriptor.target,
              paramKey: descriptor.paramKey,
              formula: draft.trim(),
            });
          }}
          className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
      </div>
      {descriptor.knownParams.length > 0 ? (
        <div className="mt-1 truncate text-[10px] text-muted">
          Parameters: {descriptor.knownParams.join(', ')}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          data-testid={`array-formula-error-${descriptor.paramKey}`}
          className="mt-1 text-[10px] text-rose-300"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}

function useLoadedCatalogFamilyGroups(
  catalogClient: ExternalCatalogClient,
  enabled: boolean,
): LoadedCatalogFamiliesState {
  const [state, setState] = useState<LoadedCatalogFamiliesState>({
    groups: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ groups: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    catalogClient
      .listCatalogs()
      .then((index) => Promise.all(index.map((entry) => catalogClient.getCatalog(entry.catalogId))))
      .then((catalogs) => {
        if (!cancelled) {
          setState({ groups: buildCatalogFamilyGroups(catalogs), loading: false, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            groups: [],
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [catalogClient, enabled]);

  return state;
}

export function FamilyLibraryPanel({
  open,
  onClose,
  elementsById,
  onPlaceType,
  onPlaceCatalogFamily,
  onLoadCatalogFamily,
  onUpdateArrayFormula,
  catalogClient = DEFAULT_CATALOG_CLIENT,
}: FamilyLibraryPanelProps): JSX.Element | null {
  const [needle, setNeedle] = useState('');

  const grouped = useMemo(() => buildCatalogByDiscipline(elementsById), [elementsById]);
  const assetGroups = useMemo(() => buildAssetCatalogGroups(elementsById), [elementsById]);
  const catalogFamiliesEnabled =
    catalogClient !== DEFAULT_CATALOG_CLIENT ||
    Boolean(onPlaceCatalogFamily || onLoadCatalogFamily);
  const catalogFamilies = useLoadedCatalogFamilyGroups(catalogClient, catalogFamiliesEnabled);
  const combinedAssetGroups = useMemo(
    () => mergeAssetCatalogGroups(assetGroups, catalogFamilies.groups),
    [assetGroups, catalogFamilies.groups],
  );
  const hasVisibleEntries =
    DISCIPLINE_ORDER.some(({ id }) =>
      (grouped[id] ?? []).some((entry) => matchesNeedle(entry, needle)),
    ) ||
    combinedAssetGroups.some(({ entries }) =>
      entries.some((entry) => matchesNeedle(entry, needle)),
    );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Family library"
      data-testid="family-library-panel"
      className="fixed inset-0 z-[60] flex items-start justify-center pt-20"
      style={{ background: 'rgba(8, 12, 20, 0.42)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-elev-3"
        style={{ width: 520, maxHeight: '70vh' }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
          <span className="text-sm font-medium text-foreground">Family Library</span>
          <span className="ml-auto mr-2 rounded-sm border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase text-muted">
            Project warehouse
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close family library"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-surface-strong"
          >
            ×
          </button>
        </div>
        <div className="border-b border-border px-3 py-2">
          <input
            autoFocus
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder="Search families…"
            aria-label="Search families"
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent/40"
          />
        </div>
        <div
          id="family-library-panel-results"
          aria-label="Family library results"
          className="flex-1 overflow-y-auto px-2 py-2"
        >
          {DISCIPLINE_ORDER.map(({ id, label }) => {
            const entries = (grouped[id] ?? []).filter((e) => matchesNeedle(e, needle));
            if (entries.length === 0) return null;
            return (
              <section
                key={id}
                aria-label={label}
                data-testid={`family-group-${id}`}
                className="mb-3"
              >
                <div
                  className="px-2 py-1 text-xs uppercase text-muted"
                  style={{ letterSpacing: 'var(--text-eyebrow-tracking, 0.06em)' }}
                >
                  {label}
                </div>
                <ul className="flex flex-col">
                  {entries.map((entry) => (
                    <li
                      key={entry.id}
                      data-testid={`family-row-${entry.id}`}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent-soft"
                    >
                      <CatalogThumbnail entry={entry} />
                      <div className="flex flex-1 flex-col">
                        <span className="text-sm text-foreground">{entry.name}</span>
                        <span className="text-xs text-muted">
                          {entry.familyName}
                          {entry.custom ? (
                            <span
                              className="ml-2 rounded-sm border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted"
                              data-testid={`family-row-${entry.id}-custom-badge`}
                            >
                              Custom
                            </span>
                          ) : null}
                          {entry.catalogLabel ? (
                            <span
                              className="ml-2 rounded-sm border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted"
                              data-testid={`family-row-${entry.id}-catalog-badge`}
                            >
                              {entry.catalogLabel}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onPlaceType(entry.kind, entry.id);
                          onClose();
                        }}
                        className="rounded border border-border bg-surface-strong px-2 py-0.5 text-xs hover:bg-accent-soft"
                      >
                        Place
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {combinedAssetGroups.map(({ id, label, entries }) => {
            const visibleEntries = entries.filter((e) => matchesNeedle(e, needle));
            if (visibleEntries.length === 0) return null;
            return (
              <section
                key={id}
                aria-label={label}
                data-testid={`family-group-${id}`}
                className="mb-3"
              >
                <div className="flex items-center justify-between gap-2 px-2 py-1">
                  <span
                    className="text-xs uppercase text-muted"
                    style={{ letterSpacing: 'var(--text-eyebrow-tracking, 0.06em)' }}
                  >
                    {label}
                  </span>
                  <span className="text-[10px] text-muted">Warehouse shelf</span>
                </div>
                <ul className="flex flex-col">
                  {visibleEntries.map((entry) => {
                    const loadedType = entry.catalogPlacement
                      ? findLoadedCatalogFamilyType(elementsById, entry.catalogPlacement)
                      : null;
                    return (
                      <li
                        key={entry.id}
                        data-testid={`family-row-${entry.id}`}
                        className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent-soft"
                      >
                        <CatalogThumbnail entry={entry} />
                        <div className="flex flex-1 flex-col">
                          <span className="text-sm text-foreground">{entry.name}</span>
                          <span className="text-xs text-muted">
                            {entry.familyName}
                            {loadedType ? (
                              <span
                                className="ml-2 rounded-sm border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted"
                                data-testid={`family-row-${entry.id}-loaded-badge`}
                              >
                                Loaded
                              </span>
                            ) : null}
                          </span>
                          {entry.arrayFormulas?.map((descriptor) => (
                            <ArrayFormulaEditor
                              key={descriptor.paramKey}
                              descriptor={descriptor}
                              onUpdate={onUpdateArrayFormula}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          data-testid={
                            entry.catalogPlacement
                              ? `external-family-${entry.id}-place`
                              : `family-row-${entry.id}-place`
                          }
                          onClick={() => {
                            if (entry.catalogPlacement) {
                              onPlaceCatalogFamily?.(
                                entry.catalogPlacement,
                                loadedType ? 'keep-existing-values' : undefined,
                              );
                            } else {
                              onPlaceType(entry.kind, entry.id);
                            }
                            onClose();
                          }}
                          className="rounded border border-border bg-surface-strong px-2 py-0.5 text-xs hover:bg-accent-soft"
                        >
                          Place
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {catalogFamilies.loading ? (
            <div data-testid="family-catalogs-loading" className="px-3 py-4 text-sm text-muted">
              Loading catalog families…
            </div>
          ) : null}
          {catalogFamilies.error ? (
            <div
              role="alert"
              data-testid="family-catalogs-error"
              className="px-3 py-4 text-sm text-rose-300"
            >
              {catalogFamilies.error}
            </div>
          ) : null}
          {!hasVisibleEntries && !catalogFamilies.loading ? (
            <div className="px-3 py-6 text-center text-sm text-muted">No matching families.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
