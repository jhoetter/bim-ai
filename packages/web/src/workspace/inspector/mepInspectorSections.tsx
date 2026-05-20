import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { FieldRow, fmtMm } from './inspectorRows';

export type MepInspectorElement = Extract<
  Element,
  {
    kind:
      | 'pipe'
      | 'duct'
      | 'cable_tray'
      | 'mep_equipment'
      | 'fixture'
      | 'mep_terminal'
      | 'mep_opening_request';
  }
>;

type ResolveName = (id: string | null | undefined) => string;
type FieldLabel = (key: string) => string;

export function fmtWatts(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(2)} kW`;
  return `${value.toFixed(0)} W`;
}

export function fmtMepRecord(value: Record<string, unknown> | null | undefined): string {
  if (!value || Object.keys(value).length === 0) return '—';
  return Object.entries(value)
    .map(([key, row]) => `${key}: ${String(row)}`)
    .join(' · ');
}

function MepCommonRows({ el }: { el: MepInspectorElement }): JSX.Element {
  const mep = el as Record<string, unknown>;
  return (
    <>
      <FieldRow label="System Type" value={(mep.systemType as string | null | undefined) ?? '—'} />
      <FieldRow label="System Name" value={(mep.systemName as string | null | undefined) ?? '—'} />
      <FieldRow
        label="Flow Direction"
        value={(mep.flowDirection as string | null | undefined) ?? '—'}
      />
      <FieldRow
        label="Service Level"
        value={(mep.serviceLevel as string | null | undefined) ?? '—'}
      />
      <FieldRow label="Insulation" value={mep.insulation ? 'Yes' : '—'} />
      <FieldRow
        label="Connectors"
        value={String((mep.connectors as unknown[] | undefined)?.length ?? 0)}
        mono
      />
      {mep.clearanceZone ? <FieldRow label="Clearance Zone" value="Defined" /> : null}
      {mep.maintainAccessZone ? <FieldRow label="Access Zone" value="Defined" /> : null}
    </>
  );
}

export function MepInspectorSection({
  el,
  f,
  resolveName,
}: {
  el: MepInspectorElement;
  f: FieldLabel;
  resolveName: ResolveName;
}): JSX.Element {
  switch (el.kind) {
    case 'duct':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveName(el.levelId)} />
          <FieldRow label="Shape" value={el.shape ?? 'rectangular'} />
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
          <FieldRow label="Elevation" value={fmtMm(el.elevationMm)} />
          <FieldRow
            label="Start"
            value={`${fmtMm(el.startMm.xMm)} · ${fmtMm(el.startMm.yMm)}`}
            mono
          />
          <FieldRow label="End" value={`${fmtMm(el.endMm.xMm)} · ${fmtMm(el.endMm.yMm)}`} mono />
          <MepCommonRows el={el} />
        </div>
      );
    case 'pipe':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveName(el.levelId)} />
          <FieldRow label="Diameter" value={fmtMm(el.diameterMm)} />
          <FieldRow label="Elevation" value={fmtMm(el.elevationMm)} />
          <FieldRow
            label="Start"
            value={`${fmtMm(el.startMm.xMm)} · ${fmtMm(el.startMm.yMm)}`}
            mono
          />
          <FieldRow label="End" value={`${fmtMm(el.endMm.xMm)} · ${fmtMm(el.endMm.yMm)}`} mono />
          <MepCommonRows el={el} />
        </div>
      );
    case 'cable_tray':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveName(el.levelId)} />
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
          <FieldRow label="Elevation" value={fmtMm(el.elevationMm)} />
          <FieldRow
            label="Start"
            value={`${fmtMm(el.startMm.xMm)} · ${fmtMm(el.startMm.yMm)}`}
            mono
          />
          <FieldRow label="End" value={`${fmtMm(el.endMm.xMm)} · ${fmtMm(el.endMm.yMm)}`} mono />
          <MepCommonRows el={el} />
        </div>
      );
    case 'mep_equipment':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveName(el.levelId)} />
          <FieldRow label="Equipment Type" value={el.equipmentType ?? '—'} />
          <FieldRow label={f('family')} value={el.familyTypeId ?? '—'} mono />
          <FieldRow
            label="Position"
            value={`${fmtMm(el.positionMm.xMm)} · ${fmtMm(el.positionMm.yMm)}`}
            mono
          />
          <FieldRow label="Elevation" value={fmtMm(el.elevationMm)} />
          <FieldRow label="Electrical Load" value={fmtWatts(el.electricalLoadW)} />
          <MepCommonRows el={el} />
        </div>
      );
    case 'fixture':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveName(el.levelId)} />
          <FieldRow label="Fixture Type" value={el.fixtureType ?? '—'} />
          <FieldRow label="Room" value={resolveName(el.roomId ?? null)} />
          <FieldRow
            label="Position"
            value={`${fmtMm(el.positionMm.xMm)} · ${fmtMm(el.positionMm.yMm)}`}
            mono
          />
          <FieldRow label="Electrical Load" value={fmtWatts(el.electricalLoadW)} />
          <MepCommonRows el={el} />
        </div>
      );
    case 'mep_terminal':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveName(el.levelId)} />
          <FieldRow label="Terminal Kind" value={el.terminalKind ?? 'terminal'} />
          <FieldRow label="Room" value={resolveName(el.roomId ?? null)} />
          <FieldRow
            label="Position"
            value={`${fmtMm(el.positionMm.xMm)} · ${fmtMm(el.positionMm.yMm)}`}
            mono
          />
          <MepCommonRows el={el} />
        </div>
      );
    case 'mep_opening_request':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Host" value={resolveName(el.hostElementId)} />
          <FieldRow label={f('level')} value={resolveName(el.levelId ?? null)} />
          <FieldRow label="Opening Kind" value={el.openingKind ?? 'wall'} />
          <FieldRow label="Status" value={el.status ?? 'requested'} />
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
          <FieldRow label="Diameter" value={fmtMm(el.diameterMm)} />
          <FieldRow label="Clearance" value={fmtMm(el.clearanceMm)} />
          <FieldRow label="Requesters" value={el.requesterElementIds?.join(', ') || '—'} mono />
          <FieldRow label="Approval Note" value={el.approvalNote ?? '—'} />
          <MepCommonRows el={el} />
        </div>
      );
  }
}
