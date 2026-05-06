/**
 * Family Library browser panel — FL-06.
 *
 * Modal panel that surfaces the full BUILT_IN_FAMILIES catalog and any
 * project-local custom `family_type` / `wall_type` / `floor_type` /
 * `roof_type` elements, grouped by discipline. Search filters family +
 * type names; "Place" sets the active draw tool with `familyTypeId`
 * pre-loaded and closes the panel.
 */

import { useEffect, useMemo, useState, type JSX } from 'react';

import type { Element, FamilyDiscipline } from '@bim-ai/core';

import { BUILT_IN_FAMILIES } from './familyCatalog';
import { getThumbnail, PLACEHOLDER_THUMBNAIL } from './thumbnailCache';

export type FamilyLibraryPlaceKind =
  | 'door'
  | 'window'
  | 'stair'
  | 'railing'
  | 'wall_type'
  | 'floor_type'
  | 'roof_type';

export interface FamilyLibraryPanelProps {
  open: boolean;
  onClose: () => void;
  elementsById: Record<string, Element>;
  /** Invoked when a type's "Place" button is clicked. The panel closes
   * automatically afterwards. */
  onPlaceType: (kind: FamilyLibraryPlaceKind, typeId: string) => void;
}

interface CatalogEntry {
  id: string;
  name: string;
  familyName: string;
  custom: boolean;
  kind: FamilyLibraryPlaceKind;
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
];

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

  for (const el of Object.values(elementsById)) {
    if (el.kind === 'family_type') {
      const bucket = (out[el.discipline] ??= []);
      bucket.push({
        id: el.id,
        name: String(el.parameters.name ?? el.name ?? el.id),
        familyName: 'Custom',
        custom: true,
        kind: el.discipline as FamilyLibraryPlaceKind,
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

export function FamilyLibraryPanel({
  open,
  onClose,
  elementsById,
  onPlaceType,
}: FamilyLibraryPanelProps): JSX.Element | null {
  const [needle, setNeedle] = useState('');

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
            <div className="px-3 py-6 text-center text-sm text-muted">No matching families.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
