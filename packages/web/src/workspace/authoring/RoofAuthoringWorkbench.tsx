import { useMemo } from 'react';

import type { Element } from '@bim-ai/core';

import { useBimStore } from '../../state/store';
import type { PlanProjectionPrimitivesV1Wire } from '../../plan/planProjectionWire';
import { roofInspectorWireDiagnosticsLines, roofPlanWireRowForElement } from '../readouts';

type RoofEl = Extract<Element, { kind: 'roof' }>;

type Props = {
  selected: Element | undefined;
  elementsById: Record<string, Element>;
  selectedIds?: string[];
  wirePrimitives: PlanProjectionPrimitivesV1Wire | null;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
};

export function RoofAuthoringWorkbench({
  selected,
  elementsById,
  selectedIds = [],
  wirePrimitives,
  revision,
  onPersistProperty,
  onUpsertSemantic,
}: Props) {
  const roof = selected?.kind === 'roof' ? (selected as RoofEl) : undefined;
  const roofJoinPreview = useBimStore((s) => s.roofJoinPreview);
  const setRoofJoinPreview = useBimStore((s) => s.setRoofJoinPreview);

  const roofTypes = useMemo(() => {
    const rows = Object.values(elementsById).filter((e) => e.kind === 'roof_type');
    rows.sort((a, b) => a.id.localeCompare(b.id));
    return rows;
  }, [elementsById]);

  const wireRow = useMemo(
    () => (roof ? roofPlanWireRowForElement(roof.id, wirePrimitives) : null),
    [roof, wirePrimitives],
  );

  const diagLines = useMemo(() => roofInspectorWireDiagnosticsLines(wireRow), [wireRow]);
  const selectedRoofIds = useMemo(() => {
    const ids = [selected?.id, ...selectedIds].filter(Boolean) as string[];
    return Array.from(new Set(ids)).filter((id) => elementsById[id]?.kind === 'roof');
  }, [elementsById, selected?.id, selectedIds]);

  if (!roof) return null;

  const rtVal =
    roof.roofTypeId && roofTypes.some((t) => t.id === roof.roofTypeId) ? roof.roofTypeId : '';

  return (
    <div
      className="border-border mb-3 space-y-2 border-b pb-3 text-[11px]"
      data-testid="roof-authoring-workbench"
    >
      <div className="font-semibold text-muted">Roof type and geometry (replayable)</div>
      <label className="block text-[10px] text-muted">
        Roof type
        <select
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
          value={rtVal}
          key={`roof-rt-${roof.id}-${roof.roofTypeId ?? ''}-${revision}`}
          onChange={(e) => {
            onPersistProperty('roofTypeId', e.target.value);
          }}
        >
          <option value="">none</option>
          {roofTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.id})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[10px] text-muted">
        Roof geometry mode
        <select
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
          value={roof.roofGeometryMode ?? 'mass_box'}
          key={`roof-rgm-${roof.id}-${roof.roofGeometryMode}-${revision}`}
          onChange={(e) => {
            onPersistProperty('roofGeometryMode', e.target.value);
          }}
        >
          <option value="mass_box">mass_box</option>
          <option value="gable_pitched_rectangle">gable_pitched_rectangle</option>
        </select>
      </label>
      {selectedRoofIds.length >= 2 ? (
        <div className="rounded border border-border bg-surface-strong p-2 text-[10px]">
          <div className="mb-1 font-medium text-foreground">Roof join</div>
          <div className="mb-2 text-muted">
            {selectedRoofIds[0]} + {selectedRoofIds[1]}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-border bg-background px-2 py-1 text-[10px] text-foreground"
              data-testid="roof-join-preview"
              onClick={() =>
                setRoofJoinPreview({
                  primaryRoofId: selectedRoofIds[0]!,
                  secondaryRoofId: selectedRoofIds[1]!,
                  seamMode: 'clip_secondary_into_primary',
                })
              }
            >
              Preview
            </button>
            <button
              type="button"
              className="rounded bg-accent px-2 py-1 text-[10px] text-accent-foreground"
              data-testid="roof-join-commit"
              onClick={() => {
                const primaryRoofId = selectedRoofIds[0]!;
                const secondaryRoofId = selectedRoofIds[1]!;
                onUpsertSemantic?.({
                  type: 'createRoofJoin',
                  primaryRoofId,
                  secondaryRoofId,
                  seamMode: roofJoinPreview?.seamMode ?? 'clip_secondary_into_primary',
                });
                setRoofJoinPreview(null);
              }}
            >
              Join Roofs
            </button>
          </div>
        </div>
      ) : null}
      <div className="space-y-0.5 text-[10px] text-muted">
        <div className="font-medium text-foreground">Plan wire diagnostics</div>
        <ul className="list-inside list-disc font-mono leading-snug">
          {diagLines.map((ln) => (
            <li key={ln}>{ln}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
