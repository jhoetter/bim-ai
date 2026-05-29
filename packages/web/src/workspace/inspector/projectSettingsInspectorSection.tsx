import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Element } from '@bim-ai/core';

import {
  coerceCheckpointRetentionLimit,
  DEFAULT_CHECKPOINT_RETENTION_LIMIT,
  MAX_CHECKPOINT_RETENTION_LIMIT,
  MIN_CHECKPOINT_RETENTION_LIMIT,
} from '@bim-ai/web-state';
import { FieldRow } from './inspectorRows';

const INPUT_CLS =
  'mt-0.5 w-full rounded border border-border bg-surface px-2 py-1 text-xs text-foreground';
const LABEL_CLS = 'block text-[10px] text-muted';

export function InspectorProjectSettingsEditor({
  el,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'project_settings' }>;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const geo = el.georeference;
  const [latDraft, setLatDraft] = useState(String(geo?.anchorLat ?? ''));
  const [lonDraft, setLonDraft] = useState(String(geo?.anchorLon ?? ''));
  const [radiusDraft, setRadiusDraft] = useState(String(geo?.contextRadiusM ?? 300));
  const [geoSearchDraft, setGeoSearchDraft] = useState('');
  const [geoSearchBusy, setGeoSearchBusy] = useState(false);

  function commitGeoreference(lat: number, lon: number, radius: number) {
    if (!isFinite(lat) || !isFinite(lon) || !isFinite(radius)) return;
    onPersistProperty(
      'georeference',
      JSON.stringify({ anchorLat: lat, anchorLon: lon, contextRadiusM: radius }),
    );
  }

  function handleGeoSearch() {
    const q = geoSearchDraft.trim();
    if (!q) return;
    setGeoSearchBusy(true);
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      {
        headers: { 'Accept-Language': 'en' },
      },
    )
      .then((r) => r.json())
      .then((results: Array<{ lat: string; lon: string }>) => {
        const first = results[0];
        if (!first) return;
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);
        const radius = parseFloat(radiusDraft) || 300;
        setLatDraft(lat.toFixed(6));
        setLonDraft(lon.toFixed(6));
        commitGeoreference(lat, lon, radius);
      })
      .catch(() => undefined)
      .finally(() => setGeoSearchBusy(false));
  }

  return (
    <div className="space-y-2 text-[11px]">
      <label className={LABEL_CLS}>
        <span>Checkpoint Retention</span>
        <input
          className={INPUT_CLS}
          type="number"
          min={MIN_CHECKPOINT_RETENTION_LIMIT}
          max={MAX_CHECKPOINT_RETENTION_LIMIT}
          defaultValue={String(el.checkpointRetentionLimit ?? DEFAULT_CHECKPOINT_RETENTION_LIMIT)}
          key={`checkpoint-retention-${el.id}-${el.checkpointRetentionLimit ?? 'default'}`}
          onBlur={(e) => {
            const next = coerceCheckpointRetentionLimit(e.target.value);
            e.currentTarget.value = String(next);
            if (next !== (el.checkpointRetentionLimit ?? DEFAULT_CHECKPOINT_RETENTION_LIMIT)) {
              onPersistProperty('checkpointRetentionLimit', String(next));
            }
          }}
          data-testid="inspector-checkpoint-retention-limit"
        />
      </label>
      <p className="text-[10px] leading-4 text-muted">
        Retained database checkpoints; equivalent to Revit maximum backups for this project.
      </p>
      <label className={LABEL_CLS}>
        <span>Volume Computed At</span>
        <select
          className={INPUT_CLS}
          value={el.volumeComputedAt ?? 'finish_faces'}
          onChange={(e) => onPersistProperty('volumeComputedAt', e.target.value)}
          data-testid="inspector-volume-computed-at"
        >
          <option value="finish_faces">Finish Faces</option>
          <option value="core_faces">Core Faces</option>
        </select>
      </label>
      <label className={LABEL_CLS}>
        <span>Room Area Computation</span>
        <select
          className={INPUT_CLS}
          value={el.roomAreaComputationBasis ?? 'wall_finish'}
          onChange={(e) => onPersistProperty('roomAreaComputationBasis', e.target.value)}
          data-testid="inspector-room-area-computation"
        >
          <option value="wall_finish">At Wall Finish</option>
          <option value="wall_centerline">At Wall Centerline</option>
          <option value="wall_core_layer">At Wall Core Layer</option>
          <option value="wall_core_center">At Wall Core Center</option>
        </select>
      </label>

      <div className="border-t border-border pt-2">
        <p
          className="mb-1.5 text-[10px] font-semibold uppercase text-muted"
          style={{ letterSpacing: '0.08em' }}
        >
          Site Context (OSM)
        </p>
        <div className="flex gap-1">
          <input
            className={`${INPUT_CLS} flex-1`}
            type="text"
            placeholder="Search address…"
            value={geoSearchDraft}
            onChange={(e) => setGeoSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGeoSearch();
            }}
            data-testid="inspector-geo-search"
          />
          <button
            type="button"
            className="rounded border border-border bg-surface px-2 py-0.5 text-[10px] text-muted hover:border-accent hover:text-accent disabled:opacity-40"
            disabled={geoSearchBusy || !geoSearchDraft.trim()}
            onClick={handleGeoSearch}
            data-testid="inspector-geo-search-btn"
          >
            {geoSearchBusy ? '…' : 'Find'}
          </button>
        </div>
        <div className="mt-1 flex gap-1">
          <label className="flex flex-1 flex-col gap-0.5">
            <span className="text-[9px] text-muted">Lat</span>
            <input
              className={INPUT_CLS}
              type="number"
              step="0.000001"
              value={latDraft}
              onChange={(e) => setLatDraft(e.target.value)}
              onBlur={() => {
                const lat = parseFloat(latDraft);
                const lon = parseFloat(lonDraft);
                const radius = parseFloat(radiusDraft) || 300;
                commitGeoreference(lat, lon, radius);
              }}
              data-testid="inspector-geo-lat"
            />
          </label>
          <label className="flex flex-1 flex-col gap-0.5">
            <span className="text-[9px] text-muted">Lon</span>
            <input
              className={INPUT_CLS}
              type="number"
              step="0.000001"
              value={lonDraft}
              onChange={(e) => setLonDraft(e.target.value)}
              onBlur={() => {
                const lat = parseFloat(latDraft);
                const lon = parseFloat(lonDraft);
                const radius = parseFloat(radiusDraft) || 300;
                commitGeoreference(lat, lon, radius);
              }}
              data-testid="inspector-geo-lon"
            />
          </label>
        </div>
        <label className={`${LABEL_CLS} mt-1`}>
          <span>Radius (m)</span>
          <select
            className={INPUT_CLS}
            value={radiusDraft}
            onChange={(e) => {
              setRadiusDraft(e.target.value);
              const lat = parseFloat(latDraft);
              const lon = parseFloat(lonDraft);
              const radius = parseFloat(e.target.value);
              commitGeoreference(lat, lon, radius);
            }}
            data-testid="inspector-geo-radius"
          >
            <option value="100">100 m</option>
            <option value="300">300 m</option>
            <option value="500">500 m</option>
            <option value="1000">1000 m</option>
          </select>
        </label>
        {geo && (
          <button
            type="button"
            className="mt-1 text-[10px] text-danger hover:underline"
            onClick={() => {
              onPersistProperty('georeference', 'null');
              setLatDraft('');
              setLonDraft('');
            }}
            data-testid="inspector-geo-clear"
          >
            Clear georeference
          </button>
        )}
      </div>
    </div>
  );
}

export function InspectorPlanRegionEditor({
  el,
  elementsById,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'plan_region' }>;
  elementsById: Record<string, Element>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const level = elementsById[el.levelId];
  const levelName = level && 'name' in level ? String(level.name) : el.levelId;
  return (
    <div className="space-y-2 text-[11px]">
      <p className="text-[10px] font-semibold text-muted">Plan Region</p>
      <label className={LABEL_CLS}>
        {t('inspector.fields.name')}
        <input
          className={INPUT_CLS}
          defaultValue={el.name}
          key={`pr-name-${el.id}-${el.name}-${revision}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v || v === el.name) return;
            onPersistProperty('name', v);
          }}
        />
      </label>
      <label className={LABEL_CLS}>
        Cut-plane height (mm)
        <input
          className={INPUT_CLS}
          type="number"
          defaultValue={el.cutPlaneOffsetMm ?? -500}
          key={`pr-cut-${el.id}-${el.cutPlaneOffsetMm}-${revision}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v) return;
            onPersistProperty('cutPlaneOffsetMm', v);
          }}
        />
      </label>
      <FieldRow label="Parent level" value={levelName} />
    </div>
  );
}
