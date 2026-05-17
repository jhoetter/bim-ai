import React, { useRef, useState } from 'react';
import { parseDxfContours } from '../tools/dxfContourImport';

interface Props {
  onImport: (dxfText: string) => void;
  onClose: () => void;
}

export function DxfImportDialog({ onImport, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [contourCount, setContourCount] = useState<number>(0);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const contours = parseDxfContours(text);
    setContourCount(contours.length);
    setPreview(text);
  };

  return (
    <div data-testid="dxf-import-dialog" style={{ padding: 16 }}>
      <h3>Import Terrain from DXF</h3>
      <input
        ref={fileRef}
        type="file"
        accept=".dxf"
        data-testid="dxf-file-input"
        onChange={handleFile}
      />
      {preview && (
        <p data-testid="dxf-contour-count">
          {contourCount} contour line{contourCount !== 1 ? 's' : ''} found
        </p>
      )}
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button
          data-testid="dxf-import-btn"
          disabled={!preview}
          onClick={() => preview && onImport(preview)}
        >
          Import
        </button>
        <button data-testid="dxf-cancel-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
