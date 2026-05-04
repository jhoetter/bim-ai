import { useEffect, useMemo, useState } from 'react';

import type { Element, RoomColorSchemeRow } from '@bim-ai/core';

import { Btn } from '@bim-ai/ui';

import {
  buildPlanProjectionQuery,
  extractRoomColorLegend,
  extractRoomProgrammeLegendEvidenceV0,
  fetchPlanProjectionWire,
  type PlanRoomColorLegendRow,
  type RoomProgrammeLegendEvidenceV0,
} from '../plan/planProjectionWire';
import { deterministicSchemeColorHex } from '../plan/roomSchemeColor';
import type { PlanPresentationPreset } from '../plan/symbology';

const SINGLETON_ROOM_COLOR_SCHEME_ID = 'bim-room-color-scheme';
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

type DraftRow = {
  programmeCode: string;
  department: string;
  schemeColorHex: string;
};

type Props = {
  modelId?: string;
  revision: number;
  elementsById: Record<string, Element>;
  activePlanViewId?: string;
  activeLevelId?: string;
  planPresentationPreset: PlanPresentationPreset;
  selectedId?: string;
  onSelectElement: (id?: string) => void;
  onUpsertSemantic: (cmd: Record<string, unknown>) => void;
};

function draftFromSchemeRows(rows: RoomColorSchemeRow[]): DraftRow[] {
  return rows.map((row) => ({
    programmeCode: row.programmeCode ?? '',
    department: row.department ?? '',
    schemeColorHex: normalizeHex(row.schemeColorHex),
  }));
}

function normalizeHex(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '#888888';
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return HEX_RE.test(prefixed) ? prefixed.toLowerCase() : '#888888';
}

function isValidHex(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return HEX_RE.test(prefixed);
}

function commandRowsFromDraft(rows: DraftRow[]): RoomColorSchemeRow[] {
  return rows
    .map((row) => {
      const programmeCode = row.programmeCode.trim();
      const department = row.department.trim();
      return {
        ...(programmeCode ? { programmeCode } : {}),
        ...(department ? { department } : {}),
        schemeColorHex: normalizeHex(row.schemeColorHex),
      };
    })
    .filter((row) => Boolean(row.programmeCode || row.department));
}

function seedRowsFromRooms(elementsById: Record<string, Element>): DraftRow[] {
  const keyed = new Map<string, DraftRow>();
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'room') continue;
    const programmeCode = (el.programmeCode ?? '').trim();
    const department = (el.department ?? '').trim();
    if (!programmeCode && !department) continue;
    const key = `${programmeCode}|${department}`;
    if (keyed.has(key)) continue;
    const seed = programmeCode || department || el.id;
    keyed.set(key, {
      programmeCode,
      department,
      schemeColorHex: deterministicSchemeColorHex(seed),
    });
  }
  return [...keyed.values()].sort((a, b) =>
    `${a.programmeCode}|${a.department}`.localeCompare(`${b.programmeCode}|${b.department}`),
  );
}

export function RoomColorSchemeWorkbench({
  modelId,
  revision,
  elementsById,
  activePlanViewId,
  activeLevelId,
  planPresentationPreset,
  selectedId,
  onSelectElement,
  onUpsertSemantic,
}: Props) {
  const roomSchemes = useMemo(
    () =>
      Object.values(elementsById)
        .filter((e): e is Extract<Element, { kind: 'room_color_scheme' }> => {
          return e.kind === 'room_color_scheme';
        })
        .sort((a, b) => {
          if (a.id === SINGLETON_ROOM_COLOR_SCHEME_ID) return -1;
          if (b.id === SINGLETON_ROOM_COLOR_SCHEME_ID) return 1;
          return a.id.localeCompare(b.id);
        }),
    [elementsById],
  );
  const selectedScheme =
    roomSchemes.find((scheme) => scheme.id === selectedId) ??
    roomSchemes.find((scheme) => scheme.id === SINGLETON_ROOM_COLOR_SCHEME_ID) ??
    roomSchemes[0];
  const activeSchemeId = selectedScheme?.id ?? SINGLETON_ROOM_COLOR_SCHEME_ID;
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [legendRows, setLegendRows] = useState<PlanRoomColorLegendRow[]>([]);
  const [legendEvidence, setLegendEvidence] = useState<RoomProgrammeLegendEvidenceV0 | null>(null);
  const [evidenceStatus, setEvidenceStatus] = useState('No projection evidence yet');

  useEffect(() => {
    let cancel = false;
    const rows = draftFromSchemeRows(selectedScheme?.schemeRows ?? []);
    queueMicrotask(() => {
      if (!cancel) setDraftRows(rows);
    });
    return () => {
      cancel = true;
    };
  }, [selectedScheme?.id, selectedScheme?.schemeRows]);

  useEffect(() => {
    let cancel = false;
    if (!modelId) {
      queueMicrotask(() => {
        if (cancel) return;
        setLegendRows([]);
        setLegendEvidence(null);
        setEvidenceStatus('No model loaded');
      });
      return () => {
        cancel = true;
      };
    }
    void (async () => {
      try {
        const qs = buildPlanProjectionQuery({
          planViewId: activePlanViewId,
          fallbackLevelId: activePlanViewId ? undefined : activeLevelId,
          globalPresentation: planPresentationPreset,
        });
        const payload = await fetchPlanProjectionWire(modelId, qs);
        if (cancel) return;
        setLegendRows(extractRoomColorLegend(payload));
        setLegendEvidence(extractRoomProgrammeLegendEvidenceV0(payload));
        setEvidenceStatus('Projection evidence current');
      } catch (err) {
        if (cancel) return;
        setLegendRows([]);
        setLegendEvidence(null);
        setEvidenceStatus(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancel = true;
    };
  }, [modelId, revision, activePlanViewId, activeLevelId, planPresentationPreset]);

  const validDraftRows = commandRowsFromDraft(draftRows);
  const invalidHexCount = draftRows.filter((row) => !isValidHex(row.schemeColorHex)).length;
  const inferredRows = useMemo(() => seedRowsFromRooms(elementsById), [elementsById]);
  const digestShort = legendEvidence?.legendDigestSha256.slice(0, 12) ?? 'none';

  return (
    <div className="space-y-3 text-[11px]">
      <div className="rounded border border-border bg-background/60 p-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-foreground">Singleton scheme</div>
            <div className="font-mono text-[10px] text-muted">{activeSchemeId}</div>
          </div>
          <Btn
            type="button"
            variant="quiet"
            className="px-2 py-1 text-[10px]"
            onClick={() => onSelectElement(activeSchemeId)}
          >
            Select
          </Btn>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-muted">
          <div>Authored rows: {selectedScheme?.schemeRows.length ?? 0}</div>
          <div>Legend rows: {legendRows.length}</div>
          <div>Digest: {digestShort}</div>
          <div>
            Overrides:{' '}
            {legendEvidence?.schemeOverridesSource
              ? `${legendEvidence.schemeOverridesSource} (${legendEvidence.schemeOverrideRowCount ?? 0})`
              : 'fallback hash'}
          </div>
        </div>
        <div className="mt-1 text-[10px] text-muted">{evidenceStatus}</div>
      </div>

      <div className="space-y-2">
        {draftRows.map((row, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_78px_24px] gap-1">
            <input
              className="rounded border border-border bg-background px-2 py-1 font-mono text-[10px]"
              placeholder="programme"
              value={row.programmeCode}
              onChange={(e) =>
                setDraftRows((rows) =>
                  rows.map((r, i) => (i === idx ? { ...r, programmeCode: e.target.value } : r)),
                )
              }
            />
            <input
              className="rounded border border-border bg-background px-2 py-1 font-mono text-[10px]"
              placeholder="department"
              value={row.department}
              onChange={(e) =>
                setDraftRows((rows) =>
                  rows.map((r, i) => (i === idx ? { ...r, department: e.target.value } : r)),
                )
              }
            />
            <input
              className="rounded border border-border bg-background px-2 py-1 font-mono text-[10px]"
              placeholder="#rrggbb"
              value={row.schemeColorHex}
              onChange={(e) =>
                setDraftRows((rows) =>
                  rows.map((r, i) => (i === idx ? { ...r, schemeColorHex: e.target.value } : r)),
                )
              }
            />
            <button
              type="button"
              className="rounded border border-border text-muted hover:bg-accent/10"
              title="Remove row"
              onClick={() => setDraftRows((rows) => rows.filter((_, i) => i !== idx))}
            >
              x
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        <Btn
          type="button"
          variant="quiet"
          className="px-2 py-1 text-[10px]"
          onClick={() =>
            setDraftRows((rows) => [
              ...rows,
              { programmeCode: '', department: '', schemeColorHex: '#888888' },
            ])
          }
        >
          Add row
        </Btn>
        <Btn
          type="button"
          variant="quiet"
          className="px-2 py-1 text-[10px]"
          onClick={() => setDraftRows(inferredRows)}
        >
          Seed from rooms
        </Btn>
        <Btn
          type="button"
          className="px-2 py-1 text-[10px]"
          onClick={() =>
            onUpsertSemantic({
              type: 'upsertRoomColorScheme',
              id: SINGLETON_ROOM_COLOR_SCHEME_ID,
              schemeRows: validDraftRows,
            })
          }
        >
          Apply scheme
        </Btn>
      </div>

      {invalidHexCount ? (
        <div className="text-[10px] text-amber-600">
          {invalidHexCount} invalid colour value(s) will save as #888888.
        </div>
      ) : null}

      <div className="max-h-32 overflow-auto rounded border border-border p-2">
        <div className="mb-1 font-semibold text-muted">Server legend readout</div>
        {legendRows.length ? (
          <ul className="space-y-1">
            {legendRows.map((row) => (
              <li key={`${row.label}-${row.schemeColorHex}`} className="flex items-center gap-2">
                <span
                  className="inline-block size-3 rounded-sm border border-border"
                  style={{ backgroundColor: row.schemeColorHex }}
                />
                <span>
                  {row.label} <span className="font-mono text-muted">{row.schemeColorHex}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-muted">No room legend rows on the active plan scope.</div>
        )}
      </div>
    </div>
  );
}
