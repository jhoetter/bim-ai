/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
import { useMemo, useState } from 'react';

import type { RoomColorSchemeRow } from '@bim-ai/core';

import { Btn, Icons, ICON_SIZE, Panel } from '@bim-ai/ui';

import { useBimStore, type PlanRoomSchemeWireReadout } from '../../state/store';

import {
  buildUpsertRoomColorSchemeCmdPayload,
  canonicalRoomSchemeRows,
  normalizeSchemeColorHex,
  rowHasProgrammeOrDepartment,
} from './roomColorSchemeCanon';
import { roomColorSchemeLegendReadoutParts } from '../../schedules/roomColorSchemeLegendReadout';

const SINGLETON_SCHEME_ID = 'bim-room-color-scheme';

function emptyDraftRow(): RoomColorSchemeRow {
  return {
    programmeCode: '',
    department: '',
    schemeColorHex: '#888888',
  };
}

function initialDraftRows(schemeRowsFromDoc: RoomColorSchemeRow[]): RoomColorSchemeRow[] {
  return schemeRowsFromDoc.length ? schemeRowsFromDoc.map((r) => ({ ...r })) : [emptyDraftRow()];
}

type AuthoringDraftProps = {
  schemeRowsFromDoc: RoomColorSchemeRow[];
  onUpsertSemantic: (cmd: Record<string, unknown>) => void;
};

function RoomColourSchemeAuthoringDraft({
  schemeRowsFromDoc,
  onUpsertSemantic,
}: AuthoringDraftProps) {
  const [draftRows, setDraftRows] = useState<RoomColorSchemeRow[]>(() =>
    initialDraftRows(schemeRowsFromDoc),
  );
  const [applyError, setApplyError] = useState<string | null>(null);

  const onApply = () => {
    setApplyError(null);
    const sanitized: RoomColorSchemeRow[] = [];

    for (const r of draftRows) {
      if (!rowHasProgrammeOrDepartment(r)) continue;
      const hex = normalizeSchemeColorHex(r.schemeColorHex ?? '');
      if (!hex) {
        setApplyError('Each filled row needs a valid #RRGGBB hex colour.');
        return;
      }
      const prog = typeof r.programmeCode === 'string' ? r.programmeCode.trim() : '';
      const dept = typeof r.department === 'string' ? r.department.trim() : '';

      sanitized.push({
        schemeColorHex: hex,
        ...(prog ? { programmeCode: prog } : {}),

        ...(dept ? { department: dept } : {}),
      });
    }

    if (!sanitized.length) {
      setApplyError('Add at least one row with programme and/or department before applying.');
      return;
    }

    const canon = canonicalRoomSchemeRows(sanitized);

    onUpsertSemantic(buildUpsertRoomColorSchemeCmdPayload(canon));
  };

  return (
    <div className="space-y-1">
      <div className="font-semibold text-muted">Authoring (replay)</div>

      <div className="max-h-52 space-y-1 overflow-auto rounded border border-border p-2">
        {draftRows.map((row, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[1fr_1fr_88px_auto] gap-1 border-b border-border pb-2 last:border-0 last:pb-0"
          >
            <label className="flex min-w-0 flex-col text-[10px] text-muted">
              programme
              <input
                className="mt-0.5 truncate rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
                value={row.programmeCode ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraftRows((rows) =>
                    rows.map((x, i) => (i === idx ? { ...x, programmeCode: v } : x)),
                  );
                }}
              />
            </label>
            <label className="flex min-w-0 flex-col text-[10px] text-muted">
              department
              <input
                className="mt-0.5 truncate rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
                value={row.department ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraftRows((rows) =>
                    rows.map((x, i) => (i === idx ? { ...x, department: v } : x)),
                  );
                }}
              />
            </label>
            <label className="flex min-w-0 flex-col text-[10px] text-muted">
              #hex
              <input
                className="mt-0.5 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
                value={row.schemeColorHex ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraftRows((rows) =>
                    rows.map((x, i) => (i === idx ? { ...x, schemeColorHex: v } : x)),
                  );
                }}
              />
            </label>
            <div className="flex items-end">
              <Btn
                type="button"
                variant="quiet"
                className="px-1 py-0.5"
                disabled={draftRows.length <= 1}
                title="Remove row"
                aria-label="Remove row"
                onClick={() => setDraftRows((rows) => rows.filter((_, i) => i !== idx))}
              >
                <Icons.close size={ICON_SIZE.chrome} aria-hidden="true" />
              </Btn>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn
          type="button"
          variant="quiet"
          className="text-[10px]"
          onClick={() => setDraftRows((rows) => [...rows, emptyDraftRow()])}
        >
          Add row
        </Btn>

        <Btn type="button" className="text-[10px]" onClick={() => void onApply()}>
          Apply (upsertRoomColorScheme)
        </Btn>
      </div>
      {applyError ? <div className="text-[10px] text-red-600">{applyError}</div> : null}
    </div>
  );
}

function PlanWireLegendReadout({ wireReadout }: { wireReadout: PlanRoomSchemeWireReadout | null }) {
  const legendRows = wireReadout?.roomColorLegendRows ?? [];
  const evidence = wireReadout?.programmeLegendEvidence ?? null;

  return (
    <div className="space-y-1 border-t border-border pt-2">
      <div className="font-semibold text-muted">Plan wire legend &amp; digest</div>
      <div className="text-[10px] text-muted">
        <strong className="text-foreground">{legendRows.length}</strong>{' '}
        <span className="font-mono">roomColorLegend</span> rows (active query)
      </div>
      {evidence ? (
        <dl className="space-y-0.5 font-mono text-[10px] leading-snug">
          <div>
            <dt className="inline text-muted">legendDigestSha256:</dt>{' '}
            <dd className="inline break-all">{evidence.legendDigestSha256}</dd>
          </div>
          <div>
            <dt className="inline text-muted">rowCount:</dt>{' '}
            <dd className="inline">{evidence.rowCount}</dd>
          </div>
          {typeof evidence.schemeOverridesSource === 'string' &&
          evidence.schemeOverridesSource.length ? (
            <div>
              <dt className="inline text-muted">schemeOverridesSource:</dt>{' '}
              <dd className="inline">{evidence.schemeOverridesSource}</dd>
            </div>
          ) : null}
          {typeof evidence.schemeOverrideRowCount === 'number' ? (
            <div>
              <dt className="inline text-muted">schemeOverrideRowCount:</dt>{' '}
              <dd className="inline">{evidence.schemeOverrideRowCount}</dd>
            </div>
          ) : null}
          {evidence.orthogonalTo && evidence.orthogonalTo.length ? (
            <div>
              <dt className="inline text-muted">orthogonalTo:</dt>{' '}
              <dd className="inline">{evidence.orthogonalTo.join(', ')}</dd>
            </div>
          ) : null}
          {typeof evidence.notes === 'string' && evidence.notes.trim() ? (
            <div className="break-words text-muted">{evidence.notes}</div>
          ) : null}
        </dl>
      ) : (
        <div className="text-[10px] text-muted">Awaiting projection wire payload…</div>
      )}
    </div>
  );
}

type Props = {
  onUpsertSemantic: (cmd: Record<string, unknown>) => void;
};

export function RoomColorSchemePanel({ onUpsertSemantic }: Props) {
  const elementsById = useBimStore((s) => s.elementsById);
  const revision = useBimStore((s) => s.revision);
  const wireReadout = useBimStore((s) => s.planRoomSchemeWireReadout);

  const schemeEl = elementsById[SINGLETON_SCHEME_ID];
  const hasSingletonDoc =
    schemeEl !== undefined &&
    schemeEl.kind === 'room_color_scheme' &&
    schemeEl.id === SINGLETON_SCHEME_ID;

  const schemeRowsFromDoc = useMemo((): RoomColorSchemeRow[] => {
    const el = elementsById[SINGLETON_SCHEME_ID];
    if (!el || el.kind !== 'room_color_scheme') return [];
    return canonicalRoomSchemeRows(el.schemeRows ?? []);
  }, [elementsById]);

  return (
    <Panel title="Room colour scheme">
      <div className="space-y-3 text-[11px]">
        <div className="text-[10px] text-muted">
          Singleton <span className="font-mono">{SINGLETON_SCHEME_ID}</span>
          {!hasSingletonDoc ? (
            <span> — not in document yet (first Apply creates it).</span>
          ) : (
            <span> — hydrated.</span>
          )}
        </div>

        <RoomColourSchemeAuthoringDraft
          key={revision}
          schemeRowsFromDoc={schemeRowsFromDoc}
          onUpsertSemantic={onUpsertSemantic}
        />

        <PlanWireLegendReadout wireReadout={wireReadout} />

        {hasSingletonDoc ? (
          <div
            className="space-y-1 border-t border-border pt-2"
            data-testid="room-color-scheme-override-evidence-readout"
          >
            <div className="font-semibold text-muted">Override evidence</div>
            {(() => {
              const el = elementsById[SINGLETON_SCHEME_ID];
              const rows = el?.kind === 'room_color_scheme' ? (el.schemeRows ?? []) : [];
              const fakeEv = {
                format: 'roomColorSchemeOverrideEvidence_v1' as const,
                schemeIdentity: SINGLETON_SCHEME_ID,
                overrideRowCount: rows.length,
                rows: rows.map((r, i) => ({
                  programmeCode: r.programmeCode,
                  department: r.department,
                  label: (r.programmeCode ?? r.department ?? '').toString().trim() || null,
                  schemeColorHex: r.schemeColorHex,
                  orderIndex: i,
                  advisoryCodes: [],
                })),
                rowDigestSha256: '',
                advisoryFindings: [],
              };
              const lines = roomColorSchemeLegendReadoutParts(fakeEv);
              return (
                <ul className="space-y-0.5 font-mono text-[10px]">
                  {lines.map((l, i) => (
                    <li key={`override-ev-${i}`} className="text-foreground">
                      {l}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        ) : null}

        <div className="border-t border-border pt-2 text-[10px] text-muted">
          Room schedules use <span className="font-mono">programmeCode</span>/
          <span className="font-mono">department</span>; plan{' '}
          <span className="font-mono">room_scheme</span> resolves fills via this singleton vs hash
          defaults (see digest notes). Sheets: deterministic manifests may attach{' '}
          <span className="font-mono">plan_room_programme_legend_hints_v0</span>
          alongside <span className="font-mono">plan:</span> viewport evidence for the same
          canonical legend correlation.
        </div>
      </div>
    </Panel>
  );
}
