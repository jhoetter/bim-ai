import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Element } from '@bim-ai/core';

import { Btn } from '@bim-ai/ui';

import type { PlanProjectionPrimitivesV1Wire } from '../plan/planProjectionWire';

import {
  buildRoomSeparationWorkbenchReadout,
  validateAxisAlignedSeparationSegmentMm,
} from './readouts';

type LevelRow = Extract<Element, { kind: 'level' }>;

type Props = {
  selected: Element | undefined;
  elementsById: Record<string, Element>;
  wirePrimitives: PlanProjectionPrimitivesV1Wire | null;
  levels: LevelRow[];
  defaultLevelId: string;
  revision: number;
  onUpsertSemantic: (cmd: Record<string, unknown>) => void;
};

export function RoomSeparationAuthoringWorkbench({
  selected,
  elementsById,
  wirePrimitives,
  levels,
  defaultLevelId,
  revision,
  onUpsertSemantic,
}: Props) {
  const readout = useMemo(() => {
    if (!selected || selected.kind !== 'room_separation') return null;
    return buildRoomSeparationWorkbenchReadout(selected, elementsById, wirePrimitives);
  }, [selected, elementsById, wirePrimitives]);

  const [levelId, setLevelId] = useState(defaultLevelId);

  useEffect(() => {
    setLevelId(defaultLevelId);
  }, [defaultLevelId]);
  const [nameDraft, setNameDraft] = useState('Separation');
  const [sx, setSx] = useState('0');
  const [sy, setSy] = useState('0');
  const [ex, setEx] = useState('2000');
  const [ey, setEy] = useState('0');
  const [authorError, setAuthorError] = useState<string | null>(null);

  const lv0 = levels[0]?.id ?? '';
  const effectiveLevelId = levelId || lv0;
  const { t } = useTranslation();

  return (
    <div
      className="border-border mb-3 space-y-2 border-b pb-3 text-[11px]"
      data-testid="room-separation-authoring-workbench"
    >
      <div className="font-semibold text-muted">{t('roomSeparation.heading')}</div>

      {readout ? (
        <div
          className="space-y-1 rounded border border-border bg-muted/15 p-2 text-[10px]"
          data-testid="room-separation-readout"
        >
          <div>
            <span className="text-muted">Name · id:</span>{' '}
            <span className="font-medium">{readout.name}</span>
            <span className="font-mono text-muted"> · {readout.id}</span>
          </div>
          <div>
            <span className="text-muted">Level:</span> {readout.levelName}{' '}
            <span className="font-mono text-muted">({readout.levelId})</span>
          </div>
          <div className="font-mono text-[9px]">
            start ({readout.startXMm}, {readout.startYMm}) → end ({readout.endXMm}, {readout.endYMm}
            ) · length {readout.lengthMm} mm
          </div>
          <div>
            <span className="text-muted">Axis-aligned pool:</span>{' '}
            {readout.axisAlignedBoundarySegmentEligible ? 'eligible' : 'excluded'}
            {readout.axisBoundarySegmentExcludedReason
              ? ` (${readout.axisBoundarySegmentExcludedReason})`
              : ''}
          </div>
          <div>
            <span className="text-muted">Authoritative perimeter:</span>{' '}
            {readout.onAuthoritativeDerivedFootprintBoundary ? 'yes' : 'no'}
          </div>
          <div>
            <span className="text-muted">Pierces derived interior:</span>{' '}
            {readout.piercesDerivedRectangleInterior ? 'yes' : 'no'}
          </div>
        </div>
      ) : (
        <div className="rounded border border-dashed border-border p-2 text-[10px] text-muted">
          {t('roomSeparation.selectHint')}
        </div>
      )}

      <div className="text-[10px] font-medium text-muted">{t('roomSeparation.addSegment')}</div>
      <div className="grid grid-cols-2 gap-2 text-[10px]" key={`rs-author-${revision}`}>
        <label className="block text-muted">
          {t('roomSeparation.level')}
          <select
            className="mt-1 w-full rounded border border-border bg-background px-1 py-1 font-mono text-[10px]"
            value={effectiveLevelId}
            onChange={(e) => setLevelId(e.target.value)}
          >
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-muted">
          {t('roomSeparation.name')}
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
          />
        </label>
        <label className="block text-muted">
          {t('roomSeparation.startX')}
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
            value={sx}
            onChange={(e) => setSx(e.target.value)}
          />
        </label>
        <label className="block text-muted">
          {t('roomSeparation.startY')}
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
            value={sy}
            onChange={(e) => setSy(e.target.value)}
          />
        </label>
        <label className="block text-muted">
          {t('roomSeparation.endX')}
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
            value={ex}
            onChange={(e) => setEx(e.target.value)}
          />
        </label>
        <label className="block text-muted">
          {t('roomSeparation.endY')}
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
            value={ey}
            onChange={(e) => setEy(e.target.value)}
          />
        </label>
      </div>
      {authorError ? (
        <div
          role="alert"
          className="rounded border border-danger/40 bg-danger/10 p-1.5 text-[10px] text-danger"
        >
          {authorError}
        </div>
      ) : null}
      <Btn
        type="button"
        className="w-full text-[11px]"
        onClick={() => {
          const x0 = Number(sx);
          const y0 = Number(sy);
          const x1 = Number(ex);
          const y1 = Number(ey);
          if (![x0, y0, x1, y1].every((n) => Number.isFinite(n))) {
            setAuthorError('Enter numeric coordinates.');
            return;
          }
          if (!effectiveLevelId) {
            setAuthorError('No level in model.');
            return;
          }
          const v = validateAxisAlignedSeparationSegmentMm(x0, y0, x1, y1);
          if (!v.ok) {
            setAuthorError(v.message);
            return;
          }
          setAuthorError(null);
          onUpsertSemantic({
            type: 'createRoomSeparation',
            levelId: effectiveLevelId,
            name: nameDraft.trim() || 'Separation',
            start: { xMm: x0, yMm: y0 },
            end: { xMm: x1, yMm: y1 },
          });
        }}
      >
        createRoomSeparation
      </Btn>
    </div>
  );
}
