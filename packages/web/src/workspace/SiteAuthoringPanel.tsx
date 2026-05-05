import { useCallback, useEffect, useRef, useState } from 'react';

import type { Element, SiteContextObjectRow, SiteContextType } from '@bim-ai/core';

import { Btn, Panel } from '@bim-ai/ui';

import {
  boundaryAxisAlignedBoxMm,
  boundaryMmFromAnchorSize,
  buildUpsertSiteCmdPayload,
  type XY,
} from './siteAuthoringPayload';

type LevelRow = Extract<Element, { kind: 'level' }>;
type SiteRow = Extract<Element, { kind: 'site' }>;

const DEFAULT_SITE_ID = 'site-v0';
const DEFAULT_WIDTH_MM = 20_000;
const DEFAULT_DEPTH_MM = 15_000;
const DEFAULT_PAD_MM = 80;
const CONTEXT_TYPES: SiteContextType[] = [
  'tree',
  'shrub',
  'neighbor_proxy',
  'entourage',
];

function sortedSites(elementsById: Record<string, Element>): SiteRow[] {
  return Object.values(elementsById)
    .filter((e): e is SiteRow => e.kind === 'site')
    .sort((a, b) => a.id.localeCompare(b.id));
}

let nextContextDraftKey = 1;

function emptyContextDraft(): SiteContextObjectRow & { _key: number } {
  nextContextDraftKey += 1;
  return {
    _key: nextContextDraftKey,
    id: '',
    contextType: 'tree',
    label: '',
    positionMm: { xMm: 0, yMm: 0 },
    scale: 1,
    category: 'site_entourage',
  };
}

type Props = {
  revision: number;
  elementsById: Record<string, Element>;
  levels: LevelRow[];
  onUpsertSemantic: (cmd: Record<string, unknown>) => void;
};

export function SiteAuthoringPanel({
  revision,
  elementsById,
  levels,
  onUpsertSemantic,
}: Props) {
  const elementsRef = useRef(elementsById);
  const levelsRef = useRef(levels);
  elementsRef.current = elementsById;
  levelsRef.current = levels;

  const [siteId, setSiteId] = useState(DEFAULT_SITE_ID);
  const [name, setName] = useState('Site');
  const [referenceLevelId, setReferenceLevelId] = useState('');
  const [anchor, setAnchor] = useState<XY>({ xMm: 0, yMm: 0 });
  const [widthMm, setWidthMm] = useState(DEFAULT_WIDTH_MM);
  const [depthMm, setDepthMm] = useState(DEFAULT_DEPTH_MM);
  const [padMm, setPadMm] = useState(DEFAULT_PAD_MM);
  const [baseOffsetMm, setBaseOffsetMm] = useState(0);
  const [northDegText, setNorthDegText] = useState('');
  const [setbackText, setSetbackText] = useState('');
  const [ctxRows, setCtxRows] = useState<(SiteContextObjectRow & { _key: number })[]>([
    emptyContextDraft(),
  ]);
  const [applyError, setApplyError] = useState<string | null>(null);

  const hydrateFromDoc = useCallback(() => {
    const els = elementsRef.current;
    const lvls = levelsRef.current;
    const sites = sortedSites(els);
    const primary = sites[0];
    const lv0 = lvls[0]?.id ?? '';

    if (!primary) {
      setSiteId(DEFAULT_SITE_ID);
      setName('Site');
      setReferenceLevelId(lv0);
      setAnchor({ xMm: 0, yMm: 0 });
      setWidthMm(DEFAULT_WIDTH_MM);
      setDepthMm(DEFAULT_DEPTH_MM);
      setPadMm(DEFAULT_PAD_MM);
      setBaseOffsetMm(0);
      setNorthDegText('');
      setSetbackText('');
      setCtxRows([emptyContextDraft()]);
      return;
    }

    const box = boundaryAxisAlignedBoxMm(primary.boundaryMm ?? []);
    const nextAnchor = box?.anchor ?? { xMm: 0, yMm: 0 };
    const w = box?.widthMm ?? DEFAULT_WIDTH_MM;
    const d = box?.depthMm ?? DEFAULT_DEPTH_MM;

    setSiteId(primary.id);
    setName(primary.name ?? 'Site');
    setReferenceLevelId(primary.referenceLevelId ?? lv0);
    setAnchor(nextAnchor);
    setWidthMm(w);
    setDepthMm(d);
    setPadMm(primary.padThicknessMm ?? DEFAULT_PAD_MM);
    setBaseOffsetMm(primary.baseOffsetMm ?? 0);
    setNorthDegText(
      primary.northDegCwFromPlanX == null ? '' : String(primary.northDegCwFromPlanX),
    );
    setSetbackText(primary.uniformSetbackMm == null ? '' : String(primary.uniformSetbackMm));
    const co = [...(primary.contextObjects ?? [])].sort((a, b) => a.id.localeCompare(b.id));
    const nextCtx =
      co.length > 0
        ? co.map((row) => {
            nextContextDraftKey += 1;
            return { ...row, _key: nextContextDraftKey };
          })
        : [];
    setCtxRows(nextCtx.length ? nextCtx : [emptyContextDraft()]);
    setApplyError(null);
  }, []);

  useEffect(() => {
    hydrateFromDoc();
  }, [revision, hydrateFromDoc]);

  const boundaryMmResolved = boundaryMmFromAnchorSize(anchor, widthMm, depthMm);

  const refLevelName =
    referenceLevelId && elementsById[referenceLevelId]?.kind === 'level'
      ? (elementsById[referenceLevelId] as LevelRow).name
      : referenceLevelId || '—';

  const filteredContextForPayload = (): SiteContextObjectRow[] =>
    ctxRows
      .filter((r) => r.id.trim().length > 0)
      .map(({ _key: _omit, ...row }) => row);

  const evidenceContextCount = filteredContextForPayload().length;

  const apply = () => {
    setApplyError(null);

    const idTrim = siteId.trim();
    if (!idTrim) {
      setApplyError('Site id is required.');
      return;
    }

    const rid = referenceLevelId.trim();
    if (!rid) {
      setApplyError('Reference level is required.');
      return;
    }

    if (!elementsById[rid] || elementsById[rid].kind !== 'level') {
      setApplyError('Reference level must be an existing level in the document.');
      return;
    }

    const w = Number(widthMm);
    const dd = Number(depthMm);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(dd) || dd <= 0) {
      setApplyError('Width and depth must be positive numbers (mm).');
      return;
    }

    const pad = Number(padMm);
    if (!Number.isFinite(pad) || pad <= 0) {
      setApplyError('Pad thickness must be > 0 (mm).');
      return;
    }

    const bo = Number(baseOffsetMm);
    if (!Number.isFinite(bo)) {
      setApplyError('Base offset must be a finite number (mm).');
      return;
    }

    let north: number | null = null;
    if (northDegText.trim().length > 0) {
      const n = Number(northDegText);
      if (!Number.isFinite(n)) {
        setApplyError('North (deg CW from +X) must be a number when set.');
        return;
      }
      north = n;
    }

    let setback: number | null = null;
    if (setbackText.trim().length > 0) {
      const u = Number(setbackText);
      if (!Number.isFinite(u) || u < 0) {
        setApplyError('Uniform setback must be a number ≥ 0 when set (mm).');
        return;
      }
      setback = u;
    }

    const payloads = filteredContextForPayload();
    const seen = new Set<string>();
    for (const r of payloads) {
      const k = r.id.trim();
      if (seen.has(k)) {
        setApplyError(`Duplicate contextObjects id '${k}'.`);
        return;
      }
      seen.add(k);
      if (!CONTEXT_TYPES.includes(r.contextType)) {
        setApplyError(`Invalid contextType for id '${k}'.`);
        return;
      }
      const sx = typeof r.scale === 'number' ? r.scale : 1;
      if (!Number.isFinite(sx) || sx <= 0) {
        setApplyError(`Context '${k}' scale must be > 0 when set (default 1).`);
        return;
      }
      if (!r.positionMm || typeof r.positionMm.xMm !== 'number' || typeof r.positionMm.yMm !== 'number') {
        setApplyError(`Context '${k}' positionMm requires numeric xMm and yMm.`);
        return;
      }
    }

    const cmd = buildUpsertSiteCmdPayload({
      id: idTrim,
      name: name.trim() || 'Site',
      referenceLevelId: rid,
      boundaryMm: boundaryMmFromAnchorSize(
        anchor,
        Number(widthMm),
        Number(depthMm),
      ),
      padThicknessMm: pad,
      baseOffsetMm: bo,
      northDegCwFromPlanX: north,
      uniformSetbackMm: setback,
      contextObjects: payloads,
    });
    onUpsertSemantic(cmd);
  };

  return (
    <Panel title="Site (pad boundary)">
      <div className="space-y-3 text-[11px]">
        <div className="rounded border border-border bg-muted/20 p-2 text-[10px] text-muted">
          <strong className="text-foreground">Evidence</strong> — boundary vertices{' '}
          <span className="font-mono">{boundaryMmResolved.length}</span>, context markers{' '}
          <span className="font-mono">{evidenceContextCount}</span>, ref level{' '}
          <span className="font-mono">{refLevelName}</span>. Bounded to{' '}
          <span className="font-mono">upsertSite</span>; no grading, contours, or survey import — pad
          is a simple prism.
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col text-[10px] text-muted">
            Site id
            <input
              className="mt-0.5 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            />
          </label>
          <label className="flex min-w-0 flex-col text-[10px] text-muted">
            Name
            <input
              className="mt-0.5 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </div>

        <label className="flex min-w-0 flex-col text-[10px] text-muted">
          Reference level
          <select
            className="mt-0.5 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
            value={referenceLevelId}
            onChange={(e) => setReferenceLevelId(e.target.value)}
          >
            <option value="">—</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.id})
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col text-[10px] text-muted">
            Anchor X (mm)
            <input
              className="mt-0.5 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              type="number"
              value={anchor.xMm}
              onChange={(e) =>
                setAnchor((a) => ({ ...a, xMm: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <label className="flex min-w-0 flex-col text-[10px] text-muted">
            Anchor Y (mm)
            <input
              className="mt-0.5 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              type="number"
              value={anchor.yMm}
              onChange={(e) =>
                setAnchor((a) => ({ ...a, yMm: Number(e.target.value) || 0 }))
              }
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col text-[10px] text-muted">
            Width (mm)
            <input
              className="mt-0.5 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              type="number"
              min={1}
              value={widthMm}
              onChange={(e) => setWidthMm(Number(e.target.value) || 1)}
            />
          </label>
          <label className="flex min-w-0 flex-col text-[10px] text-muted">
            Depth (mm)
            <input
              className="mt-0.5 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              type="number"
              min={1}
              value={depthMm}
              onChange={(e) => setDepthMm(Number(e.target.value) || 1)}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col text-[10px] text-muted">
            Pad thickness (mm)
            <input
              className="mt-0.5 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              type="number"
              min={1}
              step={10}
              value={padMm}
              onChange={(e) => setPadMm(Number(e.target.value) || 1)}
            />
          </label>
          <label className="flex min-w-0 flex-col text-[10px] text-muted">
            Base offset (mm)
            <input
              className="mt-0.5 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              type="number"
              step={10}
              value={baseOffsetMm}
              onChange={(e) => setBaseOffsetMm(Number(e.target.value) || 0)}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col text-[10px] text-muted">
            North (deg CW +X); empty clears
            <input
              className="mt-0.5 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              placeholder="optional"
              value={northDegText}
              onChange={(e) => setNorthDegText(e.target.value)}
            />
          </label>
          <label className="flex min-w-0 flex-col text-[10px] text-muted">
            Uniform setback (mm); empty clears
            <input
              className="mt-0.5 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              placeholder="optional"
              value={setbackText}
              onChange={(e) => setSetbackText(e.target.value)}
            />
          </label>
        </div>

        <div className="space-y-1">
          <div className="text-[10px] font-semibold text-muted">
            Context markers (<span className="font-mono">contextObjects</span>)
          </div>
          <div className="max-h-40 space-y-1 overflow-auto rounded border border-border p-2">
            {ctxRows.map((row, idx) => (
              <div
                key={row._key}
                className="grid grid-cols-[62px_minmax(0,0.85fr)_44px_44px_minmax(0,0.4fr)_minmax(0,0.4fr)_38px_auto] gap-1 border-b border-border pb-2 last:border-0 last:pb-0"
              >
                <label className="flex min-w-0 flex-col text-[9px] text-muted">
                  id
                  <input
                    className="mt-0.5 rounded border border-border bg-background px-0.5 py-0.5 font-mono text-[9px]"
                    value={row.id}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCtxRows((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, id: v } : r)),
                      );
                    }}
                  />
                </label>
                <label className="flex min-w-0 flex-col text-[9px] text-muted">
                  type
                  <select
                    className="mt-0.5 rounded border border-border bg-background px-0.5 py-0.5 font-mono text-[9px]"
                    value={row.contextType}
                    onChange={(e) => {
                      const v = e.target.value as SiteContextType;
                      setCtxRows((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, contextType: v } : r)),
                      );
                    }}
                  >
                    {CONTEXT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col text-[9px] text-muted">
                  xMm
                  <input
                    className="mt-0.5 rounded border border-border bg-background px-0.5 py-0.5 font-mono text-[9px]"
                    type="number"
                    value={row.positionMm.xMm}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setCtxRows((rows) =>
                        rows.map((r, i) =>
                          i === idx ? { ...r, positionMm: { ...r.positionMm, xMm: v } } : r,
                        ),
                      );
                    }}
                  />
                </label>
                <label className="flex min-w-0 flex-col text-[9px] text-muted">
                  yMm
                  <input
                    className="mt-0.5 rounded border border-border bg-background px-0.5 py-0.5 font-mono text-[9px]"
                    type="number"
                    value={row.positionMm.yMm}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setCtxRows((rows) =>
                        rows.map((r, i) =>
                          i === idx ? { ...r, positionMm: { ...r.positionMm, yMm: v } } : r,
                        ),
                      );
                    }}
                  />
                </label>
                <label className="flex min-w-0 flex-col text-[9px] text-muted">
                  label
                  <input
                    className="mt-0.5 rounded border border-border bg-background px-0.5 py-0.5 font-mono text-[9px]"
                    placeholder="optional"
                    value={row.label ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCtxRows((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, label: v } : r)),
                      );
                    }}
                  />
                </label>
                <label className="flex min-w-0 flex-col text-[9px] text-muted">
                  category
                  <input
                    className="mt-0.5 rounded border border-border bg-background px-0.5 py-0.5 font-mono text-[9px]"
                    placeholder="site_entourage"
                    value={row.category ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCtxRows((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, category: v } : r)),
                      );
                    }}
                  />
                </label>
                <label className="flex min-w-0 flex-col text-[9px] text-muted">
                  scale
                  <input
                    className="mt-0.5 rounded border border-border bg-background px-0.5 py-0.5 font-mono text-[9px]"
                    type="number"
                    min={0.01}
                    step={0.1}
                    value={row.scale ?? 1}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setCtxRows((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, scale: v } : r)),
                      );
                    }}
                  />
                </label>
                <div className="flex items-end">
                  <Btn
                    type="button"
                    variant="quiet"
                    className="px-1 py-0.5 text-[9px]"
                    disabled={ctxRows.length <= 1}
                    title="Remove row"
                    onClick={() =>
                      setCtxRows((rows) =>
                        rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx),
                      )
                    }
                  >
                    ×
                  </Btn>
                </div>
              </div>
            ))}
          </div>
          <Btn
            type="button"
            variant="quiet"
            className="text-[10px]"
            onClick={() => setCtxRows((rows) => [...rows, emptyContextDraft()])}
          >
            Add marker row
          </Btn>
        </div>

        <div className="flex flex-wrap gap-2">
          <Btn type="button" className="text-[10px]" onClick={() => void apply()}>
            Apply (upsertSite)
          </Btn>
          <Btn type="button" variant="quiet" className="text-[10px]" onClick={() => hydrateFromDoc()}>
            Reset from doc
          </Btn>
        </div>
        {applyError ? <div className="text-[10px] text-red-600">{applyError}</div> : null}
      </div>
    </Panel>
  );
}
