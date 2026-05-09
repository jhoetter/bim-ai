import React from 'react';

interface Props {
  displayName?: string;
}

export function PublicLinkBanner({ displayName }: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 32,
        background: 'var(--color-surface-2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: 'var(--text-sm)',
        zIndex: 100,
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <span>{displayName ? `Shared by ${displayName}` : 'Shared model (read-only)'}</span>
      <a
        href="/login"
        style={{
          color: 'var(--color-accent)',
          textDecoration: 'none',
          fontSize: 'var(--text-sm)',
        }}
      >
        Sign in to edit
      </a>
    </div>
  );
}
