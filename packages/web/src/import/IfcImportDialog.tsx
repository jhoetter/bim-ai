/** §12.1.2 — IFC import dialog: file picker → STEP parse → element preview → import. */

import { useRef, useState } from 'react';
import type { Element } from '@bim-ai/core';
import { parseIfcStep } from './ifcParser';
import { convertIfcToElements } from './ifcImportConverter';

export function IfcImportDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (elements: Element[]) => void;
}): JSX.Element | null {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [previewText, setPreviewText] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (!open) return null;

  function buildPreviewText(els: Element[]): string {
    const counts: Record<string, number> = {};
    for (const el of els) {
      counts[el.kind] = (counts[el.kind] ?? 0) + 1;
    }
    if (Object.keys(counts).length === 0) return 'No supported elements found.';
    return Object.entries(counts)
      .map(([kind, n]) => `${n} ${kind}${n !== 1 ? 's' : ''}`)
      .join(', ');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setElements([]);
    setPreviewText('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text !== 'string') {
        setError('Failed to read file.');
        return;
      }
      try {
        const entityMap = parseIfcStep(text);
        const els = convertIfcToElements(entityMap);
        setElements(els);
        setPreviewText(`Found: ${buildPreviewText(els)}`);
      } catch (err) {
        setError(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.onerror = () => setError('Failed to read file.');
    reader.readAsText(file);
  }

  function handleImport(): void {
    onImport(elements);
    onClose();
    setElements([]);
    setPreviewText('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleCancel(): void {
    onClose();
    setElements([]);
    setPreviewText('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: 'var(--color-surface, #fff)',
          borderRadius: 8,
          padding: 24,
          minWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Import IFC</h2>

        <input
          ref={fileInputRef}
          type="file"
          accept=".ifc"
          data-testid="ifc-import-file-input"
          onChange={handleFileChange}
        />

        {error && <p style={{ color: 'red', margin: 0, fontSize: 13 }}>{error}</p>}

        {previewText && (
          <p data-testid="ifc-import-preview-count" style={{ margin: 0, fontSize: 13 }}>
            {previewText}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            data-testid="ifc-import-cancel"
            onClick={handleCancel}
            style={{ padding: '6px 16px' }}
          >
            Cancel
          </button>
          <button
            data-testid="ifc-import-btn"
            onClick={handleImport}
            disabled={elements.length === 0}
            style={{ padding: '6px 16px' }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
