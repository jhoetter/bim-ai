import React, { useEffect } from 'react';

export type MarkupShapeMode = 'freehand' | 'arrow' | 'cloud' | 'text';

interface MarkupToolbarProps {
  active: boolean;
  shapeMode: MarkupShapeMode;
  onShapeMode: (mode: MarkupShapeMode) => void;
  onToggle: (active: boolean) => void;
}

const SHAPE_MODES: Array<{ mode: MarkupShapeMode; label: string; key: string }> = [
  { mode: 'freehand', label: 'Freehand', key: '1' },
  { mode: 'arrow', label: 'Arrow', key: '2' },
  { mode: 'cloud', label: 'Cloud', key: '3' },
  { mode: 'text', label: 'Text', key: '4' },
];

export function MarkupToolbar({ active, shapeMode, onShapeMode, onToggle }: MarkupToolbarProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'a' && e.shiftKey) {
        // AN shortcut: Shift+A then N, but simpler: treat "A"+"N" as two-key.
        // Implemented as Shift+A (AN mnemonic) to keep it single-key friendly.
        onToggle(!active);
        return;
      }

      if (!active) return;

      const found = SHAPE_MODES.find((m) => m.key === e.key);
      if (found) {
        onShapeMode(found.mode);
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active, onToggle, onShapeMode]);

  if (!active) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: '4px 6px',
        background: 'var(--surface-raised)',
        borderRadius: 6,
        border: '1px solid var(--border-default)',
      }}
    >
      {SHAPE_MODES.map(({ mode, label, key }) => (
        <button
          key={mode}
          onClick={() => onShapeMode(mode)}
          aria-pressed={shapeMode === mode}
          title={`${label} (${key})`}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            background: shapeMode === mode ? 'var(--brand-primary)' : 'transparent',
            color: shapeMode === mode ? 'var(--text-on-brand)' : 'var(--text-default)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
