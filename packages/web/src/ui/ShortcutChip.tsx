import { type JSX } from 'react';

export function ShortcutChip({ label }: { label: string }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        bottom: 2,
        right: 2,
        fontSize: 'var(--text-2xs, 10px)',
        color: 'var(--color-muted-foreground)',
        background: 'var(--color-surface-2, var(--color-surface-strong))',
        padding: '0 2px',
        borderRadius: 2,
        lineHeight: 1,
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: 'var(--font-mono, monospace)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {label}
    </span>
  );
}
