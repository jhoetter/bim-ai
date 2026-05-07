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
 * Placing an external-catalog family invokes `onPlaceCatalogFamily` which
 * loads the family into the project (creating a `family_type` element
 * carrying `catalogSource` provenance) and starts the Component placement
 * tool.
 */

import { useEffect, useMemo, useState, type JSX } from 'react';

import type { Element, FamilyDiscipline } from '@bim-ai/core';

import { BUILT_IN_FAMILIES } from './familyCatalog';
import { BUILT_IN_WALL_TYPES } from './wallTypeCatalog';
import { getThumbnail, PLACEHOLDER_THUMBNAIL } from './thumbnailCache';

export type FamilyLibraryPlaceKind =
  | 'door'
  | 'window'
  | 'stair'
  | 'railing'
  | 'wall_type'
  | 'floor_type'
  | 'roof_type';

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
   * project (creating a `family_type` element with `catalogSource`) and
   * starting the Component placement tool. The panel closes afterwards.
   */
  onPlaceCatalogFamily?: (placement: ExternalCatalogPlacement) => void;
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
  // FAM-08 — components loaded from external catalogs default to `generic`.
  { id: 'generic', label: 'Components', placeKind: 'door' },
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
        kind: fam.discipline as FamilyLibraryPlaceKind,
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
        kind: el.discipline as FamilyLibraryPlaceKind,
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

function matchesNeedle(entry: CatalogEntry, needle: string): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  return entry.name.toLowerCase().includes(n) || entry.familyName.toLowerCase().includes(n);
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

function ExternalCatalogsTab({
  catalogClient,
  needle,
  onPlace,
  onPanelClose,
}: {
  catalogClient: ExternalCatalogClient;
  needle: string;
  onPlace: (placement: ExternalCatalogPlacement) => void;
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
      <div data-testid="external-catalogs-error" className="px-3 py-6 text-sm text-rose-300">
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
                              </span>
                            </div>
                            {def ? (
                              <button
                                type="button"
                                data-testid={`external-family-${fam.id}-place`}
                                onClick={() => {
                                  onPlace({
                                    catalogId: payload.catalogId,
                                    catalogName: payload.name,
                                    catalogVersion: payload.version,
                                    family: fam,
                                    defaultType: def,
                                  });
                                  onPanelClose();
                                }}
                                className="rounded border border-border bg-surface-strong px-2 py-0.5 text-xs hover:bg-accent-soft"
                              >
                                Place
                              </button>
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
  catalogClient = DEFAULT_CATALOG_CLIENT,
  initialTab = 'in-project',
}: FamilyLibraryPanelProps): JSX.Element | null {
  const [needle, setNeedle] = useState('');
  const [tab, setTab] = useState<'in-project' | 'external'>(initialTab);

  const grouped = useMemo(() => buildCatalogByDiscipline(elementsById), [elementsById]);

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
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'in-project'}
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
            role="tab"
            aria-selected={tab === 'external'}
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
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-accent"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
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
                          <TypeThumbnail typeId={entry.id} name={entry.name} />
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
              {DISCIPLINE_ORDER.every(({ id }) => {
                const entries = (grouped[id] ?? []).filter((e) => matchesNeedle(e, needle));
                return entries.length === 0;
              }) ? (
                <div className="px-3 py-6 text-center text-sm text-muted">
                  No matching families.
                </div>
              ) : null}
            </>
          ) : (
            <ExternalCatalogsTab
              catalogClient={catalogClient}
              needle={needle}
              onPlace={(placement) => onPlaceCatalogFamily?.(placement)}
              onPanelClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
