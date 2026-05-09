/**
 * FAM-10 — Recent Clipboard tray.
 *
 * Listens for the `bim-ai:clipboard-copy` window event the PlanCanvas
 * keydown handler dispatches, plus reads localStorage on mount so the
 * tray hydrates if a payload was copied in a previous session. Click
 * the chip → modal preview with a "Paste this" button that re-dispatches
 * a synthetic Cmd+V keyboard event so the same paste pipeline fires.
 *
 * Self-contained: caller drops <RecentClipboardTray /> wherever it
 * fits (status bar slot, header, etc.) and the component handles its
 * own state.
 */
import { useCallback, useEffect, useState, type JSX } from 'react';
import { readClipboardSync } from './clipboardStore';
import type { ClipboardPayload } from './payload';

export function RecentClipboardTray(): JSX.Element | null {
  const [payload, setPayload] = useState<ClipboardPayload | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setPayload(readClipboardSync());
    const onCopy = (ev: Event) => {
      const detail = (ev as CustomEvent<ClipboardPayload>).detail;
      if (detail?.format === 'bim-ai-clipboard-v1') setPayload(detail);
    };
    window.addEventListener('bim-ai:clipboard-copy', onCopy as EventListener);
    return () => window.removeEventListener('bim-ai:clipboard-copy', onCopy as EventListener);
  }, []);

  const closePreview = useCallback(() => setPreviewOpen(false), []);

  useEffect(() => {
    if (!previewOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreview();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [previewOpen, closePreview]);

  if (!payload) return null;

  const elementCount = payload.elements.length;
  const familyCount = payload.familyDefinitions.length;

  function dispatchSyntheticPaste() {
    closePreview();
    const ev = new KeyboardEvent('keydown', {
      key: 'v',
      code: 'KeyV',
      metaKey: true,
      ctrlKey: true,
    });
    window.dispatchEvent(ev);
  }

  return (
    <div className="flex items-center gap-1 text-xs" data-testid="recent-clipboard-tray">
      <button
        type="button"
        className="rounded border px-2 py-0.5"
        aria-label="Recent clipboard"
        onClick={() => setPreviewOpen(true)}
      >
        📋 {elementCount} el / {familyCount} fam
      </button>
      {previewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Recent clipboard preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closePreview}
        >
          <div
            className="w-full max-w-md rounded border border-border bg-surface p-4 shadow-elev-2"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 font-semibold text-foreground">Recent clipboard</h3>
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-muted">Source project</dt>
              <dd>{payload.sourceProjectId}</dd>
              <dt className="text-muted">Source model</dt>
              <dd>{payload.sourceModelId}</dd>
              <dt className="text-muted">Elements</dt>
              <dd>{elementCount}</dd>
              <dt className="text-muted">Families</dt>
              <dd>{familyCount}</dd>
              <dt className="text-muted">Captured</dt>
              <dd>{payload.timestamp}</dd>
            </dl>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePreview}
                className="rounded border border-border px-3 py-1 text-sm hover:bg-surface-strong"
              >
                Close
              </button>
              <button
                type="button"
                onClick={dispatchSyntheticPaste}
                className="rounded bg-accent px-3 py-1 text-sm text-accent-foreground hover:opacity-90"
              >
                Paste this
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
