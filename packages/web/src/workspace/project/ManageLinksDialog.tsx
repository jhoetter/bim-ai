/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
import { type JSX, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusTrap } from '../../useFocusTrap';
import type { Element } from '@bim-ai/core';

import { applyCommand, ApiHttpError } from '../../lib/api';
import { resolveDxfLayerRows } from '../../plan/dxfUnderlay';
import { useBimStore } from '../../state/store';

/**
 * FED-01 — Manage Links dialog (full polish).
 *
 * Lists every `link_model` row in the host model with per-row controls for
 * delete, alignment mode, visibility mode, and revision pinning. Pinned links
 * surface a yellow drift badge when the source has advanced past the pinned
 * revision; clicking "Update" bumps the pinned revision to the current source
 * revision.
 */

export interface ManageLinksDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Optional override used by tests so they can pump commands through a fake
   * apply path. Production wiring uses the real `/api/.../commands` route.
   */
  applyCommandImpl?: typeof applyCommand;
}

type LinkRow = Extract<Element, { kind: 'link_model' }>;
type DxfLinkRow = Extract<Element, { kind: 'link_dxf' }>;

type AlignMode = 'origin_to_origin' | 'project_origin' | 'shared_coords';
type VisibilityMode = 'host_view' | 'linked_view';

const ALIGN_LABELS: Record<AlignMode, string> = {
  origin_to_origin: 'Origin → Origin',
  project_origin: 'Project Base Point',
  shared_coords: 'Shared Coords',
};

const VIS_LABELS: Record<VisibilityMode, string> = {
  host_view: 'Host view',
  linked_view: 'Linked view',
};

export function ManageLinksDialog({
  open,
  onClose,
  applyCommandImpl,
}: ManageLinksDialogProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);
  const elementsById = useBimStore((s) => s.elementsById);
  const modelId = useBimStore((s) => s.modelId);
  const linkSourceRevisions = useBimStore((s) => s.linkSourceRevisions);

  const links: LinkRow[] = useMemo(
    () =>
      Object.values(elementsById)
        .filter((e): e is LinkRow => e.kind === 'link_model')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [elementsById],
  );

  const dxfLinks: DxfLinkRow[] = useMemo(
    () =>
      Object.values(elementsById)
        .filter((e): e is DxfLinkRow => e.kind === 'link_dxf')
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    [elementsById],
  );

  const [name, setName] = useState('Linked structure');
  const [sourceModelId, setSourceModelId] = useState('');
  const [posXMm, setPosXMm] = useState('0');
  const [posYMm, setPosYMm] = useState('0');
  const [posZMm, setPosZMm] = useState('0');
  const [addAlign, setAddAlign] = useState<AlignMode>('origin_to_origin');
  const [addVis, setAddVis] = useState<VisibilityMode>('host_view');
  const [pending, setPending] = useState(false);
  const [dxfPathDrafts, setDxfPathDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const apply = applyCommandImpl ?? applyCommand;

  const submitAdd = async (): Promise<void> => {
    setError(null);
    if (!modelId) {
      setError('No active model');
      return;
    }
    const trimmedSrc = sourceModelId.trim();
    if (!trimmedSrc) {
      setError('Source model UUID required');
      return;
    }
    setPending(true);
    try {
      await apply(modelId, {
        type: 'createLinkModel',
        name: name.trim() || 'Linked model',
        sourceModelId: trimmedSrc,
        positionMm: {
          xMm: Number(posXMm) || 0,
          yMm: Number(posYMm) || 0,
          zMm: Number(posZMm) || 0,
        },
        rotationDeg: 0,
        originAlignmentMode: addAlign,
        visibilityMode: addVis,
      });
      setSourceModelId('');
      setName('Linked structure');
      setPosXMm('0');
      setPosYMm('0');
      setPosZMm('0');
      setAddAlign('origin_to_origin');
      setAddVis('host_view');
    } catch (err) {
      const msg =
        err instanceof ApiHttpError
          ? typeof err.detail === 'string'
            ? err.detail
            : JSON.stringify(err.detail)
          : err instanceof Error
            ? err.message
            : 'Failed to create link';
      setError(msg);
    } finally {
      setPending(false);
    }
  };

  const submitDelete = async (linkId: string): Promise<void> => {
    setError(null);
    if (!modelId) return;
    setPending(true);
    try {
      await apply(modelId, { type: 'deleteLinkModel', linkId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete link';
      setError(msg);
    } finally {
      setPending(false);
    }
  };

  const submitUpdate = async (linkId: string, patch: Record<string, unknown>): Promise<void> => {
    setError(null);
    if (!modelId) return;
    setPending(true);
    try {
      await apply(modelId, { type: 'updateLinkModel', linkId, ...patch });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update link';
      setError(msg);
    } finally {
      setPending(false);
    }
  };

  const submitUpdateDxf = async (linkId: string, patch: Record<string, unknown>): Promise<void> => {
    setError(null);
    if (!modelId) return;
    setPending(true);
    try {
      await apply(modelId, { type: 'updateLinkDxf', linkId, ...patch });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update DXF link';
      setError(msg);
    } finally {
      setPending(false);
    }
  };

  const submitPositionPin = async (elementId: string, pinned: boolean): Promise<void> => {
    setError(null);
    if (!modelId) return;
    setPending(true);
    try {
      await apply(modelId, {
        type: pinned ? 'unpinElement' : 'pinElement',
        elementId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update link pin';
      setError(msg);
    } finally {
      setPending(false);
    }
  };

  const dxfPathDraft = (link: DxfLinkRow): string =>
    dxfPathDrafts[link.id] ?? link.sourcePath ?? '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage Links"
      data-testid="manage-links-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="rounded-md border border-border bg-surface text-foreground shadow-elev-3"
        style={{ minWidth: 540, maxWidth: 720, padding: 16 }}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Manage Links</h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="manage-links-close"
            className="rounded border border-border px-2 py-0.5 text-xs hover:bg-surface-strong"
          >
            Close
          </button>
        </div>

        <section className="mb-4">
          <h3 className="mb-1 text-[10px] uppercase text-muted" style={{ letterSpacing: '0.06em' }}>
            Linked models
          </h3>
          {links.length === 0 ? (
            <div className="text-xs text-muted" data-testid="manage-links-empty">
              No links yet.
            </div>
          ) : (
            <ul className="flex flex-col gap-1" data-testid="manage-links-list">
              {links.map((l) => {
                const currentSrcRev = linkSourceRevisions[l.sourceModelId];
                const pinnedRev = l.sourceModelRevision ?? null;
                const isPinned = pinnedRev != null;
                const driftCount =
                  isPinned && typeof currentSrcRev === 'number'
                    ? Math.max(0, currentSrcRev - (pinnedRev as number))
                    : 0;
                const align: AlignMode = l.originAlignmentMode;
                const vis: VisibilityMode = l.visibilityMode ?? 'host_view';
                return (
                  <li
                    key={l.id}
                    data-testid={`manage-links-row-${l.id}`}
                    className="flex flex-col gap-1 rounded border border-border px-2 py-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs">{l.name}</span>
                        <span className="font-mono text-[10px] text-muted">{l.sourceModelId}</span>
                      </div>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void submitDelete(l.id)}
                        data-testid={`manage-links-delete-${l.id}`}
                        className="rounded border border-border px-2 py-0.5 text-xs hover:bg-surface-strong disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <label className="flex items-center gap-1">
                        Align
                        <select
                          value={align}
                          disabled={pending}
                          data-testid={`manage-links-align-${l.id}`}
                          onChange={(e) =>
                            void submitUpdate(l.id, {
                              originAlignmentMode: e.target.value as AlignMode,
                            })
                          }
                          className="rounded border border-border bg-surface-strong px-1 py-0.5 text-[11px]"
                        >
                          {(Object.keys(ALIGN_LABELS) as AlignMode[]).map((m) => (
                            <option key={m} value={m}>
                              {ALIGN_LABELS[m]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-1">
                        Visibility
                        <select
                          value={vis}
                          disabled={pending}
                          data-testid={`manage-links-visibility-${l.id}`}
                          onChange={(e) =>
                            void submitUpdate(l.id, {
                              visibilityMode: e.target.value as VisibilityMode,
                            })
                          }
                          className="rounded border border-border bg-surface-strong px-1 py-0.5 text-[11px]"
                        >
                          {(Object.keys(VIS_LABELS) as VisibilityMode[]).map((m) => (
                            <option key={m} value={m}>
                              {VIS_LABELS[m]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={pending}
                        data-testid={`manage-links-position-pin-${l.id}`}
                        aria-pressed={Boolean(l.pinned)}
                        onClick={() => void submitPositionPin(l.id, Boolean(l.pinned))}
                        className={[
                          'rounded border px-2 py-0.5 text-[11px] hover:bg-surface-strong disabled:opacity-50',
                          l.pinned
                            ? 'border-amber-500 bg-amber-100 text-amber-900'
                            : 'border-border',
                        ].join(' ')}
                        title={
                          l.pinned
                            ? 'Unlock this linked model position'
                            : 'Lock this linked model position'
                        }
                      >
                        {l.pinned ? 'Position locked' : 'Lock position'}
                      </button>
                      {isPinned ? (
                        <span
                          data-testid={`manage-links-pin-state-${l.id}`}
                          className="font-mono text-[10px] text-muted"
                        >
                          pinned @ rev {pinnedRev}
                        </span>
                      ) : (
                        <span
                          data-testid={`manage-links-pin-state-${l.id}`}
                          className="font-mono text-[10px] text-muted"
                        >
                          following latest
                        </span>
                      )}
                      {isPinned ? (
                        <button
                          type="button"
                          disabled={pending}
                          data-testid={`manage-links-unpin-${l.id}`}
                          onClick={() => void submitUpdate(l.id, { sourceModelRevision: null })}
                          className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-surface-strong disabled:opacity-50"
                        >
                          Follow latest
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pending || typeof currentSrcRev !== 'number'}
                          data-testid={`manage-links-pin-${l.id}`}
                          onClick={() =>
                            void submitUpdate(l.id, {
                              sourceModelRevision: currentSrcRev ?? 0,
                            })
                          }
                          className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-surface-strong disabled:opacity-50"
                          title={
                            typeof currentSrcRev === 'number'
                              ? `Pin to current source revision ${currentSrcRev}`
                              : 'Source revision unknown'
                          }
                        >
                          Pin to revision
                        </button>
                      )}
                      {driftCount > 0 ? (
                        <>
                          <span
                            data-testid={`manage-links-drift-${l.id}`}
                            title={`Source advanced by ${driftCount} commit${driftCount === 1 ? '' : 's'}`}
                            style={{
                              background: 'var(--color-warning)',
                              color: 'var(--color-warning-foreground)',
                              padding: '0 4px',
                              borderRadius: 3,
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            +{driftCount} revision{driftCount === 1 ? '' : 's'}
                          </span>
                          <button
                            type="button"
                            disabled={pending}
                            data-testid={`manage-links-update-${l.id}`}
                            onClick={() =>
                              void submitUpdate(l.id, {
                                sourceModelRevision: currentSrcRev,
                              })
                            }
                            className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-surface-strong disabled:opacity-50"
                          >
                            Update
                          </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mb-4">
          <h3 className="mb-1 text-[10px] uppercase text-muted" style={{ letterSpacing: '0.06em' }}>
            DXF underlays
          </h3>
          {dxfLinks.length === 0 ? (
            <div className="text-xs text-muted" data-testid="manage-dxf-links-empty">
              No DXF underlays.
            </div>
          ) : (
            <ul className="flex flex-col gap-1" data-testid="manage-dxf-links-list">
              {dxfLinks.map((l) => {
                const colorMode = l.colorMode ?? 'black_white';
                const customColor = l.customColor ?? '#7f7f7f';
                const opacityPct = Math.round((l.overlayOpacity ?? 0.5) * 100);
                const align: AlignMode = l.originAlignmentMode ?? 'origin_to_origin';
                const loaded = l.loaded !== false;
                const layerRows = resolveDxfLayerRows(l);
                const hiddenLayerNames = l.hiddenLayerNames ?? [];
                const hiddenLayerSet = new Set(hiddenLayerNames);
                return (
                  <li
                    key={l.id}
                    data-testid={`manage-dxf-links-row-${l.id}`}
                    className="flex flex-col gap-1 rounded border border-border px-2 py-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs">{l.name ?? 'DXF Underlay'}</span>
                        <div className="truncate font-mono text-[10px] text-muted">
                          {l.sourcePath ?? 'No saved path'}
                        </div>
                      </div>
                      <span
                        data-testid={`manage-dxf-links-status-${l.id}`}
                        className={[
                          'rounded border px-1.5 py-0.5 text-[10px]',
                          loaded
                            ? 'border-emerald-500 text-emerald-700'
                            : 'border-border text-muted',
                        ].join(' ')}
                      >
                        {loaded ? 'Loaded' : 'Unloaded'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        disabled={pending}
                        data-testid={`manage-dxf-links-load-${l.id}`}
                        onClick={() => void submitUpdateDxf(l.id, { loaded: !loaded })}
                        className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-surface-strong disabled:opacity-50"
                      >
                        {loaded ? 'Unload' : 'Reload'}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        data-testid={`manage-dxf-links-position-pin-${l.id}`}
                        aria-pressed={Boolean(l.pinned)}
                        onClick={() => void submitPositionPin(l.id, Boolean(l.pinned))}
                        className={[
                          'rounded border px-2 py-0.5 text-[11px] hover:bg-surface-strong disabled:opacity-50',
                          l.pinned
                            ? 'border-amber-500 bg-amber-100 text-amber-900'
                            : 'border-border',
                        ].join(' ')}
                        title={l.pinned ? 'Unlock this DXF underlay' : 'Lock this DXF underlay'}
                      >
                        {l.pinned ? 'Position locked' : 'Lock position'}
                      </button>
                      <label className="flex items-center gap-1">
                        Align
                        <select
                          value={align}
                          disabled={pending}
                          data-testid={`manage-dxf-links-align-${l.id}`}
                          onChange={(e) =>
                            void submitUpdateDxf(l.id, {
                              originAlignmentMode: e.target.value as AlignMode,
                            })
                          }
                          className="rounded border border-border bg-surface-strong px-1 py-0.5 text-[11px]"
                        >
                          {(Object.keys(ALIGN_LABELS) as AlignMode[]).map((m) => (
                            <option key={m} value={m}>
                              {ALIGN_LABELS[m]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-1">
                        Opacity
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={opacityPct}
                          disabled={pending}
                          data-testid={`manage-dxf-links-opacity-${l.id}`}
                          onChange={(e) =>
                            void submitUpdateDxf(l.id, {
                              overlayOpacity: Number(e.target.value) / 100,
                            })
                          }
                          className="w-24"
                        />
                        <span className="w-8 text-right font-mono text-[10px] text-muted">
                          {opacityPct}%
                        </span>
                      </label>
                      <label className="flex items-center gap-1">
                        Color
                        <select
                          value={colorMode}
                          disabled={pending}
                          data-testid={`manage-dxf-links-colormode-${l.id}`}
                          onChange={(e) =>
                            void submitUpdateDxf(l.id, {
                              colorMode: e.target.value,
                            })
                          }
                          className="rounded border border-border bg-surface-strong px-1 py-0.5 text-[11px]"
                        >
                          <option value="black_white">Black &amp; white</option>
                          <option value="native">Preserve original colors</option>
                          <option value="custom">Custom</option>
                        </select>
                      </label>
                      {colorMode === 'custom' ? (
                        <label className="flex items-center gap-1">
                          <input
                            type="color"
                            value={customColor}
                            disabled={pending}
                            data-testid={`manage-dxf-links-color-${l.id}`}
                            onChange={(e) =>
                              void submitUpdateDxf(l.id, {
                                customColor: e.target.value,
                              })
                            }
                            className="h-5 w-8 cursor-pointer rounded border border-border"
                          />
                          <span className="font-mono text-[10px] text-muted">{customColor}</span>
                        </label>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <label className="flex min-w-0 flex-1 items-center gap-1">
                        Path
                        <input
                          type="text"
                          value={dxfPathDraft(l)}
                          disabled={pending}
                          data-testid={`manage-dxf-links-path-${l.id}`}
                          onChange={(e) =>
                            setDxfPathDrafts((prev) => ({ ...prev, [l.id]: e.target.value }))
                          }
                          className="min-w-0 flex-1 rounded border border-border bg-surface-strong px-1 py-0.5 font-mono text-[11px]"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={pending}
                        data-testid={`manage-dxf-links-change-path-${l.id}`}
                        onClick={() => void submitUpdateDxf(l.id, { sourcePath: dxfPathDraft(l) })}
                        className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-surface-strong disabled:opacity-50"
                      >
                        Change Path
                      </button>
                    </div>
                    {layerRows.length > 0 ? (
                      <div
                        className="mt-1 border-t border-border pt-1"
                        data-testid={`manage-dxf-links-layers-${l.id}`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase text-muted">
                          <span>Layers</span>
                          <span className="normal-case">
                            {hiddenLayerSet.size}/{layerRows.length} hidden
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                          {layerRows.map((layer) => {
                            const hidden = hiddenLayerSet.has(layer.name);
                            const nextHidden = hidden
                              ? hiddenLayerNames.filter((name) => name !== layer.name)
                              : [...hiddenLayerNames, layer.name];
                            return (
                              <label
                                key={layer.name}
                                className="flex min-w-0 items-center gap-1 text-[11px]"
                              >
                                <input
                                  type="checkbox"
                                  checked={!hidden}
                                  disabled={pending}
                                  data-testid={`manage-dxf-links-layer-visible-${l.id}-${layer.name}`}
                                  onChange={() =>
                                    void submitUpdateDxf(l.id, {
                                      hiddenLayerNames: nextHidden,
                                    })
                                  }
                                />
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-sm border border-border"
                                  style={{ backgroundColor: layer.color ?? '#7f7f7f' }}
                                />
                                <span className="truncate" title={layer.name}>
                                  {layer.name}
                                </span>
                                <span className="ml-auto shrink-0 font-mono text-[10px] text-muted">
                                  {layer.primitiveCount}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-[10px] uppercase text-muted" style={{ letterSpacing: '0.06em' }}>
            Add Link
          </h3>
          <div className="flex flex-col gap-2">
            <label className="flex flex-col text-xs">
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="manage-links-name-input"
                className="rounded border border-border bg-surface-strong px-2 py-1 text-xs"
              />
            </label>
            <label className="flex flex-col text-xs">
              Source model UUID
              <input
                type="text"
                value={sourceModelId}
                onChange={(e) => setSourceModelId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                data-testid="manage-links-source-input"
                className="rounded border border-border bg-surface-strong px-2 py-1 font-mono text-[11px]"
              />
            </label>
            <div className="flex gap-2">
              {[
                { label: 'x (mm)', value: posXMm, setter: setPosXMm, testId: 'manage-links-pos-x' },
                { label: 'y (mm)', value: posYMm, setter: setPosYMm, testId: 'manage-links-pos-y' },
                { label: 'z (mm)', value: posZMm, setter: setPosZMm, testId: 'manage-links-pos-z' },
              ].map((f) => (
                <label key={f.testId} className="flex flex-1 flex-col text-xs">
                  {f.label}
                  <input
                    type="number"
                    value={f.value}
                    onChange={(e) => f.setter(e.target.value)}
                    data-testid={f.testId}
                    className="rounded border border-border bg-surface-strong px-2 py-1 text-xs"
                  />
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col text-xs">
                Alignment
                <select
                  value={addAlign}
                  onChange={(e) => setAddAlign(e.target.value as AlignMode)}
                  data-testid="manage-links-add-align"
                  className="rounded border border-border bg-surface-strong px-2 py-1 text-xs"
                >
                  {(Object.keys(ALIGN_LABELS) as AlignMode[]).map((m) => (
                    <option key={m} value={m}>
                      {ALIGN_LABELS[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-1 flex-col text-xs">
                Visibility
                <select
                  value={addVis}
                  onChange={(e) => setAddVis(e.target.value as VisibilityMode)}
                  data-testid="manage-links-add-visibility"
                  className="rounded border border-border bg-surface-strong px-2 py-1 text-xs"
                >
                  {(Object.keys(VIS_LABELS) as VisibilityMode[]).map((m) => (
                    <option key={m} value={m}>
                      {VIS_LABELS[m]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending}
                aria-busy={pending}
                onClick={() => void submitAdd()}
                data-testid="manage-links-add"
                className="rounded border border-border bg-surface-strong px-3 py-1 text-xs hover:bg-surface disabled:opacity-50"
              >
                Add Link
              </button>
              {error ? (
                <span role="alert" className="text-xs text-danger" data-testid="manage-links-error">
                  {error}
                </span>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
