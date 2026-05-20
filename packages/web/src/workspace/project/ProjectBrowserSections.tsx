import React from 'react';
import type { JSX } from 'react';

export function PbCollapsibleSection({
  label,
  collapsed,
  onToggle,
  testId,
  children,
}: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  testId: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div data-testid={testId} style={{ marginBottom: 'var(--space-2)' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: 'var(--space-1)',
          padding: 'var(--space-1) var(--space-3)',
          fontSize: 'var(--text-sm, 12.5px)',
          color: 'var(--color-muted-foreground)',
          letterSpacing: 'var(--text-eyebrow-tracking, 0.04em)',
          textTransform: 'uppercase',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span>{collapsed ? '▸' : '▾'}</span>
        {label}
      </button>
      {!collapsed ? children : null}
    </div>
  );
}

export function PbGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div style={{ marginBottom: 'var(--space-2)' }} data-pb-group={label}>
      <div
        style={{
          padding: 'var(--space-1) var(--space-3)',
          fontSize: 'var(--text-sm, 12.5px)',
          color: 'var(--color-muted-foreground)',
          letterSpacing: 'var(--text-eyebrow-tracking, 0.04em)',
          textTransform: 'uppercase',
        }}
        data-testid={`pb-group-${label}`}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

export function PbContextMenu({
  x,
  y,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
  onProperties,
  onLockToggle,
  isLocked,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onProperties?: () => void;
  onLockToggle?: () => void;
  isLocked?: boolean;
}): JSX.Element {
  return (
    <div
      data-testid="pb-context-menu"
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 9999,
        minWidth: 140,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm, 4px)',
        boxShadow: 'var(--shadow-modal, 0 4px 16px rgba(0,0,0,0.24))',
        padding: 'var(--space-1) 0',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        data-testid="pb-ctx-rename"
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: 'var(--space-1) var(--space-3)',
          fontSize: 'var(--text-sm, 12.5px)',
          color: 'var(--color-foreground)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        Rename
      </button>
      <button
        type="button"
        data-testid="pb-ctx-duplicate"
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: 'var(--space-1) var(--space-3)',
          fontSize: 'var(--text-sm, 12.5px)',
          color: 'var(--color-foreground)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onClick={onDuplicate}
      >
        Duplicate
      </button>
      <button
        type="button"
        data-testid="pb-ctx-delete"
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: 'var(--space-1) var(--space-3)',
          fontSize: 'var(--text-sm, 12.5px)',
          color: 'var(--color-foreground)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onClick={onDelete}
      >
        Delete
      </button>
      {onProperties ? (
        <button
          type="button"
          data-testid="pb-ctx-properties"
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: 'var(--space-1) var(--space-3)',
            fontSize: 'var(--text-sm, 12.5px)',
            color: 'var(--color-foreground)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={onProperties}
        >
          Properties
        </button>
      ) : null}
      {onLockToggle ? (
        <button
          type="button"
          data-testid="pb-ctx-lock"
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: 'var(--space-1) var(--space-3)',
            fontSize: 'var(--text-sm, 12.5px)',
            color: 'var(--color-foreground)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={() => {
            onLockToggle();
            onClose();
          }}
        >
          {isLocked ? 'Unlock Camera' : 'Lock Camera'}
        </button>
      ) : null}
    </div>
  );
}
