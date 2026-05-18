import React from 'react';

import { useBimStore } from '../state/store';

interface QuickAccessToolbarProps {
  onInvokeCommand?: (commandId: string) => void;
  onRemoveFromQAT?: (commandId: string) => void;
}

export function QuickAccessToolbar({
  onInvokeCommand,
  onRemoveFromQAT,
}: QuickAccessToolbarProps): JSX.Element | null {
  const quickAccessItems = useBimStore((s: any) => s.quickAccessItems ?? []);

  if (quickAccessItems.length === 0) return null;

  return (
    <div
      data-testid="quick-access-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '2px 8px',
        borderBottom: '1px solid var(--border, #333)',
      }}
    >
      {quickAccessItems.map((cmdId: string) => (
        <button
          key={cmdId}
          data-testid={`qat-btn-${cmdId}`}
          title={cmdId}
          onClick={() => onInvokeCommand?.(cmdId)}
          onContextMenu={(e) => {
            e.preventDefault();
            onRemoveFromQAT?.(cmdId);
          }}
          style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 3,
            border: '1px solid var(--border, #444)',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {cmdId.split('.').pop()}
        </button>
      ))}
    </div>
  );
}
