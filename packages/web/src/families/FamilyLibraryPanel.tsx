/**
 * Family Library browser panel — FL-06 + FAM-08.
 *
 * Modal panel that surfaces the full BUILT_IN_FAMILIES catalog and any
 * project-local custom `family_type` / `wall_type` / `floor_type` /
 * `roof_type` elements, grouped by discipline. Search filters family +
 * type names; "Place" sets the active draw tool with `familyTypeId`
 * pre-loaded and closes the panel.
 *
 * FAM-08 — adds an "External Catalogs" tab fed by GET /api/family-catalogs.
 * Placing an external-catalog family invokes `onPlaceCatalogFamily`; the
 * host loads the family into the project and then resolves placement through
 * the same category-specific placement adapters used by in-project families.
 */

import { useEffect, useMemo, useState, type JSX } from 'react';

import type { AssetCategory, AssetLibraryEntry, Element, FamilyDiscipline } from '@bim-ai/core';

import { BUILT_IN_FAMILIES } from './familyCatalog';
import { BUILT_IN_WALL_TYPES } from './wallTypeCatalog';
import {
  getThumbnail,
  getWallTypeThumbnail,
  PLACEHOLDER_THUMBNAIL,
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
  defaultTypes: {
    id: string;
    name: string;
    familyId: string;
    discipline: FamilyDiscipline;
    parameters: Record<string, unknown>;
  }[];
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
}

export interface ExternalCatalogClient {
  /** Fetch the catalog index (used by the External Catalogs tab). */
  listCatalogs(): Promise<ExternalCatalogIndexEntry[]>;
  /** Fetch one catalog payload (used when a catalog is expanded). */
  getCatalog(catalogId: string): Promise<ExternalCatalogPayload>;
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
   * Optional client for the external-catalog API. Provided so tests can
   * inject a stub without spinning up the real fetch path. Defaults to a
   * fetch-backed implementation that hits `/api/family-catalogs`.
   */
  catalogClient?: ExternalCatalogClient;
  /** Initial active tab (default: in-project). */
  initialTab?: 'in-project' | 'external';
}

interface CatalogEntry {
  id: string;
  name: string;
  familyName: string;
  custom: boolean;
  kind: FamilyLibraryPlaceKind;
  catalogLabel?: string;
  assetEntry?: AssetLibraryEntry;
  wallThumbnail?: {
    layers: WallThumbnailLayerInput[];
    basisLine?: 'center' | 'face_interior' | 'face_exterior';
  };
  searchText?: string;
}

interface AssetCatalogGroup {
  id: `asset-${AssetCategory}`;
  label: string;
  entries: CatalogEntry[];
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
      });
    } else if (el.kind === 'roof_type') {
      const bucket = (out['roof_type'] ??= []);
      bucket.push({
        id: el.id,
        name: el.name,
        familyName: `${el.layers.length} layers`,
        custom: true,
        kind: 'roof_type',
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
    const bucket = (buckets[entry.category] ??= []);
    bucket.push({
      id: entry.id,
      name: entry.name,
      familyName: entry.description ?? (entry.tags.slice(0, 3).join(' · ') || 'Interior family'),
      custom: false,
      kind: 'asset',
      assetEntry: entry,
      searchText: [entry.category, ...entry.tags, entry.planSymbolKind, entry.renderProxyKind]
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

function matchesNeedle(entry: CatalogEntry, needle: string): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  return (
    entry.name.toLowerCase().includes(n) ||
    entry.familyName.toLowerCase().includes(n) ||
    Boolean(entry.searchText?.toLowerCase().includes(n))
  );
}

function externalMatchesNeedle(
  catalog: ExternalCatalogPayload | ExternalCatalogIndexEntry,
  family: ExternalCatalogFamily | undefined,
  needle: string,
): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  if (catalog.name.toLowerCase().includes(n)) return true;
  if ('description' in catalog && catalog.description.toLowerCase().includes(n)) return true;
  if (family) {
    if (family.name.toLowerCase().includes(n)) return true;
    if (family.defaultTypes.some((t) => t.name.toLowerCase().includes(n))) return true;
  }
  return false;
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
  return <TypeThumbnail typeId={entry.id} name={entry.name} />;
}

function ExternalCatalogsTab({
  catalogClient,
  elementsById,
  needle,
  onPlace,
  onLoad,
  onPanelClose,
}: {
  catalogClient: ExternalCatalogClient;
  elementsById: Record<string, Element>;
  needle: string;
  onPlace: (
    placement: ExternalCatalogPlacement,
    overwriteOption?: FamilyReloadOverwriteOption,
  ) => void;
  onLoad: (
    placement: ExternalCatalogPlacement,
    overwriteOption?: FamilyReloadOverwriteOption,
  ) => void;
  onPanelClose: () => void;
}): JSX.Element {
  const [index, setIndex] = useState<ExternalCatalogIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payloadById, setPayloadById] = useState<Record<string, ExternalCatalogPayload>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    catalogClient
      .listCatalogs()
      .then((list) => {
        if (!cancelled) setIndex(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [catalogClient]);

  async function expand(catalogId: string): Promise<void> {
    if (expanded === catalogId) {
      setExpanded(null);
      return;
    }
    setExpanded(catalogId);
    if (payloadById[catalogId]) return;
    setLoadingId(catalogId);
    try {
      const payload = await catalogClient.getCatalog(catalogId);
      setPayloadById((prev) => ({ ...prev, [catalogId]: payload }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingId(null);
    }
  }

  if (error) {
    return (
      <div
        role="alert"
        data-testid="external-catalogs-error"
        className="px-3 py-6 text-sm text-rose-300"
      >
        {error}
      </div>
    );
  }
  if (index === null) {
    return (
      <div data-testid="external-catalogs-loading" className="px-3 py-6 text-sm text-muted">
        Loading external catalogs…
      </div>
    );
  }
  if (index.length === 0) {
    return (
      <div data-testid="external-catalogs-empty" className="px-3 py-6 text-sm text-muted">
        No external catalogs available.
      </div>
    );
  }

  const visibleIndex = needle
    ? index.filter((entry) => {
        if (entry.name.toLowerCase().includes(needle.toLowerCase())) return true;
        const payload = payloadById[entry.catalogId];
        if (!payload) return false;
        return payload.families.some((fam) => externalMatchesNeedle(payload, fam, needle));
      })
    : index;

  return (
    <div data-testid="external-catalogs-tab" className="flex flex-col">
      {visibleIndex.map((entry) => {
        const payload = payloadById[entry.catalogId];
        const isExpanded = expanded === entry.catalogId;
        return (
          <section
            key={entry.catalogId}
            data-testid={`external-catalog-${entry.catalogId}`}
            className="mb-2 rounded-md border border-border"
          >
            <button
              type="button"
              onClick={() => void expand(entry.catalogId)}
              data-testid={`external-catalog-toggle-${entry.catalogId}`}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent-soft"
            >
              <div className="flex flex-col">
                <span className="text-sm text-foreground">{entry.name}</span>
                <span className="text-xs text-muted">
                  {entry.description} · v{entry.version} · {entry.familyCount} families
                </span>
              </div>
              <span aria-hidden className="text-muted">
                {isExpanded ? '▾' : '▸'}
              </span>
            </button>
            {isExpanded ? (
              <div className="border-t border-border px-2 py-2">
                {loadingId === entry.catalogId && !payload ? (
                  <div className="px-2 py-3 text-sm text-muted">Loading…</div>
                ) : payload ? (
                  <ul className="flex flex-col">
                    {payload.families
                      .filter((fam) => externalMatchesNeedle(payload, fam, needle))
                      .map((fam) => {
                        const def = fam.defaultTypes[0];
                        const placement = def
                          ? {
                              catalogId: payload.catalogId,
                              catalogName: payload.name,
                              catalogVersion: payload.version,
                              family: fam,
                              defaultType: def,
                            }
                          : null;
                        const loadedType = placement
                          ? findLoadedCatalogFamilyType(elementsById, placement)
                          : null;
                        return (
                          <li
                            key={fam.id}
                            data-testid={`external-family-${fam.id}`}
                            className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent-soft"
                          >
                            <TypeThumbnail typeId={fam.id} name={fam.name} />
                            <div className="flex flex-1 flex-col">
                              <span className="text-sm text-foreground">{fam.name}</span>
                              <span className="text-xs text-muted">
                                {fam.discipline} · {fam.defaultTypes.length} type
                                {fam.defaultTypes.length === 1 ? '' : 's'}
                                {loadedType ? (
                                  <span
                                    className="ml-2 rounded-sm border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted"
                                    data-testid={`external-family-${fam.id}-loaded-badge`}
                                  >
                                    Loaded
                                  </span>
                                ) : null}
                              </span>
                            </div>
                            {placement ? (
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {loadedType ? (
                                  <>
                                    <button
                                      type="button"
                                      data-testid={`external-family-${fam.id}-reload-keep-values`}
                                      onClick={() => {
                                        onLoad(placement, 'keep-existing-values');
                                        onPanelClose();
                                      }}
                                      className="rounded border border-border bg-surface px-2 py-0.5 text-xs hover:bg-accent-soft"
                                    >
                                      Keep values
                                    </button>
                                    <button
                                      type="button"
                                      data-testid={`external-family-${fam.id}-reload-overwrite-values`}
                                      onClick={() => {
                                        onLoad(placement, 'overwrite-parameter-values');
                                        onPanelClose();
                                      }}
                                      className="rounded border border-border bg-surface px-2 py-0.5 text-xs hover:bg-accent-soft"
                                    >
                                      Overwrite values
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    data-testid={`external-family-${fam.id}-load`}
                                    onClick={() => {
                                      onLoad(placement);
                                      onPanelClose();
                                    }}
                                    className="rounded border border-border bg-surface px-2 py-0.5 text-xs hover:bg-accent-soft"
                                  >
                                    Load
                                  </button>
                                )}
                                <button
                                  type="button"
                                  data-testid={`external-family-${fam.id}-place`}
                                  onClick={() => {
                                    onPlace(
                                      placement,
                                      loadedType ? 'keep-existing-values' : undefined,
                                    );
                                    onPanelClose();
                                  }}
                                  className="rounded border border-border bg-surface-strong px-2 py-0.5 text-xs hover:bg-accent-soft"
                                >
                                  Place
                                </button>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export function FamilyLibraryPanel({
  open,
  onClose,
  elementsById,
  onPlaceType,
  onPlaceCatalogFamily,
  onLoadCatalogFamily,
  catalogClient = DEFAULT_CATALOG_CLIENT,
  initialTab = 'in-project',
}: FamilyLibraryPanelProps): JSX.Element | null {
  const [needle, setNeedle] = useState('');
  const [tab, setTab] = useState<'in-project' | 'external'>(initialTab);

  const grouped = useMemo(() => buildCatalogByDiscipline(elementsById), [elementsById]);
  const assetGroups = useMemo(() => buildAssetCatalogGroups(elementsById), [elementsById]);

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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close family library"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-surface-strong"
          >
            ×
          </button>
        </div>
        <div
          className="flex items-center gap-1 border-b border-border px-3 py-1"
          role="tablist"
          aria-label="Family library tabs"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setTab('external');
            else if (e.key === 'ArrowLeft') setTab('in-project');
          }}
        >
          <button
            type="button"
            id="family-library-tab-in-project"
            role="tab"
            aria-selected={tab === 'in-project'}
            aria-controls="family-library-panel-tab"
            tabIndex={tab === 'in-project' ? 0 : -1}
            data-testid="family-library-tab-in-project"
            onClick={() => setTab('in-project')}
            className={`rounded-t px-2 py-1 text-xs ${
              tab === 'in-project'
                ? 'border-b-2 border-accent text-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            In Project
          </button>
          <button
            type="button"
            id="family-library-tab-external"
            role="tab"
            aria-selected={tab === 'external'}
            aria-controls="family-library-panel-tab"
            tabIndex={tab === 'external' ? 0 : -1}
            data-testid="family-library-tab-external"
            onClick={() => setTab('external')}
            className={`rounded-t px-2 py-1 text-xs ${
              tab === 'external'
                ? 'border-b-2 border-accent text-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            External Catalogs
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
          id="family-library-panel-tab"
          role="tabpanel"
          aria-labelledby={`family-library-tab-${tab}`}
          className="flex-1 overflow-y-auto px-2 py-2"
        >
          {tab === 'in-project' ? (
            <>
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
              {assetGroups.map(({ id, label, entries }) => {
                const visibleEntries = entries.filter((e) => matchesNeedle(e, needle));
                if (visibleEntries.length === 0) return null;
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
                      {visibleEntries.map((entry) => (
                        <li
                          key={entry.id}
                          data-testid={`family-row-${entry.id}`}
                          className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent-soft"
                        >
                          <CatalogThumbnail entry={entry} />
                          <div className="flex flex-1 flex-col">
                            <span className="text-sm text-foreground">{entry.name}</span>
                            <span className="text-xs text-muted">{entry.familyName}</span>
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
              {DISCIPLINE_ORDER.every(({ id }) => {
                const entries = (grouped[id] ?? []).filter((e) => matchesNeedle(e, needle));
                return entries.length === 0;
              }) &&
              assetGroups.every(({ entries }) => {
                const visibleEntries = entries.filter((e) => matchesNeedle(e, needle));
                return visibleEntries.length === 0;
              }) ? (
                <div className="px-3 py-6 text-center text-sm text-muted">
                  No matching families.
                </div>
              ) : null}
            </>
          ) : (
            <ExternalCatalogsTab
              catalogClient={catalogClient}
              elementsById={elementsById}
              needle={needle}
              onPlace={(placement, overwriteOption) =>
                onPlaceCatalogFamily?.(placement, overwriteOption)
              }
              onLoad={(placement, overwriteOption) =>
                onLoadCatalogFamily?.(placement, overwriteOption)
              }
              onPanelClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
