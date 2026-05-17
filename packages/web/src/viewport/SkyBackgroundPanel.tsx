import { useBimStore } from '../state/store';

export function SkyBackgroundPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const skyBackground = useBimStore((s) => s.skyBackground);
  const setSkyBackground = useBimStore((s) => s.setSkyBackground);
  const skyBackgroundColor = useBimStore((s) => s.skyBackgroundColor);
  const setSkyBackgroundColor = useBimStore((s) => s.setSkyBackgroundColor);

  if (!open) return null;

  return (
    <div
      data-testid="sky-background-panel"
      style={{
        position: 'absolute',
        bottom: 48,
        right: 8,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        padding: 12,
        zIndex: 100,
        minWidth: 180,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Background</div>

      {(['default', 'gradient-sky', 'overcast', 'solid'] as const).map((mode) => (
        <label
          key={mode}
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            marginBottom: 4,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <input
            type="radio"
            name="sky-mode"
            data-testid={`sky-mode-${mode}`}
            checked={skyBackground === mode}
            onChange={() => setSkyBackground(mode)}
          />
          {mode === 'default'
            ? 'Grey (Default)'
            : mode === 'gradient-sky'
              ? 'Sky Blue'
              : mode === 'overcast'
                ? 'Overcast'
                : 'Solid Color'}
        </label>
      ))}

      {skyBackground === 'solid' && (
        <div style={{ marginTop: 4 }}>
          <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Color</label>
          <input
            type="color"
            data-testid="sky-solid-color"
            value={skyBackgroundColor}
            onChange={(e) => setSkyBackgroundColor(e.currentTarget.value)}
            style={{ width: '100%' }}
          />
        </div>
      )}

      <button
        type="button"
        data-testid="sky-panel-close"
        onClick={onClose}
        style={{ marginTop: 8, fontSize: 11, width: '100%' }}
      >
        Close
      </button>
    </div>
  );
}
