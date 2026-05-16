import { useEffect, useRef, useState } from 'react';

export type Save3dViewAsDialogProps = {
  isOpen: boolean;
  suggestedName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
};

/**
 * D5 — modal prompt for naming a saved 3D view before it is persisted.
 * Displayed when the user clicks "Save View As…" in the 3D view ribbon.
 */
export function Save3dViewAsDialog({
  isOpen,
  suggestedName,
  onSave,
  onCancel,
}: Save3dViewAsDialogProps) {
  const [draft, setDraft] = useState(suggestedName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(suggestedName);
      requestAnimationFrame(() => {
        inputRef.current?.select();
      });
    }
  }, [isOpen, suggestedName]);

  const commit = () => {
    const name = draft.trim();
    if (name) onSave(name);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Save 3D View As"
      data-testid="save-3d-view-as-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg, 8px)',
          padding: 'var(--space-5, 20px)',
          minWidth: 320,
          maxWidth: 480,
          boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: '0 0 var(--space-3) 0',
            fontSize: 'var(--text-base, 14px)',
            fontWeight: 600,
            color: 'var(--color-foreground)',
          }}
        >
          Save 3D View As…
        </h2>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--text-sm, 12.5px)',
            color: 'var(--color-muted-foreground)',
            marginBottom: 'var(--space-1)',
          }}
        >
          View name
        </label>
        <input
          ref={inputRef}
          data-testid="save-3d-view-as-name-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
          style={{
            width: '100%',
            padding: 'var(--space-1-5, 6px) var(--space-2, 8px)',
            background: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm, 4px)',
            color: 'var(--color-foreground)',
            fontSize: 'var(--text-sm, 12.5px)',
            boxSizing: 'border-box',
          }}
          autoFocus
          placeholder="Saved 3D View 1"
        />
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            justifyContent: 'flex-end',
            marginTop: 'var(--space-4, 16px)',
          }}
        >
          <button
            type="button"
            data-testid="save-3d-view-as-cancel"
            onClick={onCancel}
            style={{
              padding: 'var(--space-1-5, 6px) var(--space-3, 12px)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm, 4px)',
              color: 'var(--color-foreground)',
              fontSize: 'var(--text-sm, 12.5px)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="save-3d-view-as-save"
            disabled={!draft.trim()}
            onClick={commit}
            style={{
              padding: 'var(--space-1-5, 6px) var(--space-3, 12px)',
              background: 'var(--color-accent)',
              border: '1px solid transparent',
              borderRadius: 'var(--radius-sm, 4px)',
              color: 'var(--color-accent-foreground, white)',
              fontSize: 'var(--text-sm, 12.5px)',
              cursor: 'pointer',
              opacity: draft.trim() ? 1 : 0.5,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
