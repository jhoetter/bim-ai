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
import { useEffect, useState, type JSX } from 'react';
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

  if (!payload) return null;

  const elementCount = payload.elements.length;
  const familyCount = payload.familyDefinitions.length;

  function dispatchSyntheticPaste() {
    setPreviewOpen(false);
    const ev = new KeyboardEvent('keydown', {
      key: 'v',
      code: 'KeyV',
      metaKey: true,
      ctrlKey: true,
    });
    window.dispatchEvent(ev);
  }

  return (
    <div className="text-xs flex items-center gap-1" data-testid="recent-clipboard-tray">
      <button
        type="button"
        className="px-2 py-0.5 rounded border"
        aria-label="Recent clipboard"
        onClick={() => setPreviewOpen(true)}
      >
        📋 {elementCount} el / {familyCount} fam
      </button>
      {previewOpen && (
        <div
          role="dialog"
          aria-label="Recent clipboard preview"
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="bg-white p-4 rounded shadow max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-2">Recent clipboard</h3>
            <dl className="text-sm grid grid-cols-2 gap-1">
              <dt>Source project</dt>
              <dd>{payload.sourceProjectId}</dd>
              <dt>Source model</dt>
              <dd>{payload.sourceModelId}</dd>
              <dt>Elements</dt>
              <dd>{elementCount}</dd>
              <dt>Families</dt>
              <dd>{familyCount}</dd>
              <dt>Captured</dt>
              <dd>{payload.timestamp}</dd>
            </dl>
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="px-3 py-1 rounded border"
              >
                Close
              </button>
              <button
                type="button"
                onClick={dispatchSyntheticPaste}
                className="px-3 py-1 rounded bg-primary text-white"
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
