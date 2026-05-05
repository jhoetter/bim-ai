import { useMemo } from 'react';

import type { Element } from '@bim-ai/core';

import type { PlanProjectionPrimitivesV1Wire } from '../plan/planProjectionWire';
import {
  roofInspectorWireDiagnosticsLines,
  roofPlanWireRowForElement,
} from './roofAuthoringReadout';

type RoofEl = Extract<Element, { kind: 'roof' }>;

type Props = {
  selected: Element | undefined;
  elementsById: Record<string, Element>;
  wirePrimitives: PlanProjectionPrimitivesV1Wire | null;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
};

export function RoofAuthoringWorkbench({
  selected,
  elementsById,
  wirePrimitives,
  revision,
  onPersistProperty,
}: Props) {
  const roof = selected?.kind === 'roof' ? (selected as RoofEl) : undefined;

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

  if (!roof) return null;

  const rtVal = roof.roofTypeId && roofTypes.some((t) => t.id === roof.roofTypeId) ? roof.roofTypeId : '';

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
