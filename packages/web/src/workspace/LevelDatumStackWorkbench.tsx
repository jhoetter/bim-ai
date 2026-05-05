import { useMemo } from 'react';

import type { Element, Violation } from '@bim-ai/core';

import { recommendedContextForRuleId } from '../advisor/advisorViolationContext';
import { useBimStore } from '../state/store';

import {
  buildLevelDatumStackEvidenceToken,
  buildLevelDatumStackRows,
  filterDatumWorkbenchViolations,
  formatElevationMmReadout,
  levelIdsFromDatumRows,
} from './datumLevelStackReadout';
import { formatLevelDatumPropagationEvidenceLine } from './levelDatumPropagationReadout';

type Props = {
  selected: Element | undefined;
  elementsById: Record<string, Element>;
  violations: Violation[];
};

export function LevelDatumStackWorkbench({ selected, elementsById, violations }: Props) {
  const rows = useMemo(() => buildLevelDatumStackRows(elementsById), [elementsById]);
  const levelIds = useMemo(() => levelIdsFromDatumRows(rows), [rows]);
  const lastPropagation = useBimStore((s) => s.lastLevelElevationPropagationEvidence);

  const datumViolations = useMemo(
    () => filterDatumWorkbenchViolations(violations, levelIds),
    [violations, levelIds],
  );

  if (!selected || selected.kind !== 'level') {
    return null;
  }

  const evidence = buildLevelDatumStackEvidenceToken(rows, selected.id);

  return (
    <div
      className="border-border mb-3 space-y-2 border-b pb-3 text-[11px]"
      data-testid="level-datum-stack-workbench"
    >
      <div className="font-semibold text-muted">Level / datum stack</div>
      <div className="text-[10px] leading-snug text-muted">
        Read-only stack from snapshot; elevation aligns parent+offset within{' '}
        <span className="font-mono">±1</span> mm → <span className="font-mono">derived</span>.
      </div>

      {rows.length ? (
        <div className="max-h-48 overflow-auto rounded border border-border">
          <table className="w-full border-collapse text-left text-[10px]">
            <thead>
              <tr className="border-border border-b bg-muted/40">
                <th className="p-1.5 font-medium">Level</th>
                <th className="p-1.5 font-medium text-right">Abs. el. (mm)</th>
                <th className="p-1.5 font-medium">Parent</th>
                <th className="p-1.5 font-medium text-right">Offset (mm)</th>
                <th className="p-1.5 font-medium">Token</th>
                <th className="p-1.5 font-medium text-right">Plans</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSel = row.id === selected.id;
                return (
                  <tr
                    key={row.id}
                    className={
                      isSel
                        ? 'border-border border-b bg-muted/25 odd:bg-muted/20 even:bg-muted/15'
                        : 'border-border border-b odd:bg-background even:bg-muted/15 last:border-b-0'
                    }
                  >
                    <td className="p-1.5">
                      <div className="max-w-[7rem] truncate font-medium" title={row.name}>
                        {row.name}
                      </div>
                      <div className="font-mono text-[9px] text-muted">{row.id}</div>
                    </td>
                    <td className="p-1.5 text-right font-mono">{formatElevationMmReadout(row.elevationMm)}</td>
                    <td className="max-w-[6rem] p-1.5">
                      {row.parentLevelId ? (
                        <>
                          <div className="truncate" title={row.parentName ?? row.parentLevelId}>
                            {row.parentName ?? '—'}
                          </div>
                          <div className="truncate font-mono text-[9px] text-muted">{row.parentLevelId}</div>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="p-1.5 text-right font-mono">
                      {row.parentLevelId ? formatElevationMmReadout(row.offsetFromParentMm) : '—'}
                    </td>
                    <td className="p-1.5 font-mono">{row.elevationToken}</td>
                    <td className="p-1.5 text-right font-mono">{row.planViewCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded border border-dashed border-border p-2 text-[10px] text-muted">
          No levels in this snapshot.
        </div>
      )}

      {datumViolations.length ? (
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium text-muted">Datum-related advisories</div>
          <ul className="space-y-1 text-[10px]">
            {datumViolations.map((v) => (
              <li
                key={`${v.ruleId}:${v.severity}:${v.message}:${(v.elementIds ?? []).join(',')}`}
                className="rounded border border-border bg-muted/20 p-1.5"
              >
                <div className="font-mono text-[9px] text-muted">
                  {v.severity} · {v.ruleId}
                </div>
                <div className="text-foreground">{v.message}</div>
                {v.elementIds?.length ? (
                  <div className="mt-0.5 font-mono text-[9px] text-muted">
                    ids: {v.elementIds.join(', ')}
                  </div>
                ) : null}
                <div className="mt-0.5 text-[9px] text-muted">{recommendedContextForRuleId(v.ruleId)}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lastPropagation ? (
        <div
          className="break-all rounded border border-border/60 bg-muted/20 p-1.5 font-mono text-[10px] text-muted"
          data-testid="level-datum-propagation-evidence"
        >
          {formatLevelDatumPropagationEvidenceLine(lastPropagation)}
        </div>
      ) : null}

      <div
        className="break-all rounded bg-muted/30 p-1.5 font-mono text-[10px] text-foreground"
        data-testid="level-datum-stack-evidence"
        title="Deterministic summary for agents / evidence"
      >
        {evidence}
      </div>
    </div>
  );
}
