import { useState } from 'react';

interface TerracePresetDialogProps {
  floorId: string;
  onApply: (railingHeightMm: number) => void;
  onClose: () => void;
}

export function TerracePresetDialog({
  floorId: _floorId,
  onApply,
  onClose,
}: TerracePresetDialogProps) {
  const [railingHeightMm, setRailingHeightMm] = useState(1100);

  return (
    <div
      data-testid="terrace-preset-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      <div
        style={{ background: '#1a1a2e', color: '#eee', padding: 24, borderRadius: 8, width: 320 }}
      >
        <h3 style={{ marginTop: 0 }}>Create Terrace</h3>
        <p style={{ fontSize: 13, color: '#aaa' }}>
          A perimeter railing will be added along all edges of the selected floor boundary.
        </p>
        <label style={{ display: 'block', marginBottom: 16 }}>
          Railing Height (mm)
          <input
            type="number"
            data-testid="terrace-railing-height-input"
            value={railingHeightMm}
            min={800}
            max={2000}
            step={50}
            onChange={(e) => setRailingHeightMm(+e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '4px 8px' }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button data-testid="terrace-preset-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            data-testid="terrace-preset-apply"
            onClick={() => {
              onApply(railingHeightMm);
              onClose();
            }}
          >
            Create Terrace
          </button>
        </div>
      </div>
    </div>
  );
}
