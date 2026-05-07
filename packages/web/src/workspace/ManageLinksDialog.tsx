import { type JSX, useMemo, useState } from 'react';
import type { Element } from '@bim-ai/core';

import { applyCommand, ApiHttpError } from '../lib/api';
import { useBimStore } from '../state/store';

/**
 * FED-01 — minimal Manage Links dialog.
 *
 * Lists every `link_model` row in the host model and lets the user add or
 * delete a link via the standard command API. The reload / pin-revision /
 * source-replace controls are deferred to a follow-up WP — the load-bearing
 * slice ships create + delete only.
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

export function ManageLinksDialog({
  open,
  onClose,
  applyCommandImpl,
}: ManageLinksDialogProps): JSX.Element | null {
  const elementsById = useBimStore((s) => s.elementsById);
  const modelId = useBimStore((s) => s.modelId);

  const links: LinkRow[] = useMemo(
    () =>
      Object.values(elementsById)
        .filter((e): e is LinkRow => e.kind === 'link_model')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [elementsById],
  );

  const [name, setName] = useState('Linked structure');
  const [sourceModelId, setSourceModelId] = useState('');
  const [posXMm, setPosXMm] = useState('0');
  const [posYMm, setPosYMm] = useState('0');
  const [posZMm, setPosZMm] = useState('0');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        originAlignmentMode: 'origin_to_origin',
      });
      setSourceModelId('');
      setName('Linked structure');
      setPosXMm('0');
      setPosYMm('0');
      setPosZMm('0');
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

  return (
    <div
      role="dialog"
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
        className="rounded-md border border-border bg-surface text-foreground shadow-elev-3"
        style={{ minWidth: 480, maxWidth: 640, padding: 16 }}
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
              {links.map((l) => (
                <li
                  key={l.id}
                  data-testid={`manage-links-row-${l.id}`}
                  className="flex items-center justify-between rounded border border-border px-2 py-1"
                >
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
                </li>
              ))}
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => void submitAdd()}
                data-testid="manage-links-add"
                className="rounded border border-border bg-surface-strong px-3 py-1 text-xs hover:bg-surface disabled:opacity-50"
              >
                Add Link
              </button>
              {error ? (
                <span className="text-xs text-error" data-testid="manage-links-error">
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
