import { useEffect, useState } from 'react';

/**
 * EmptyStateHint — CHR-V3-10
 *
 * Shown on the canvas when nothing is selected and no drawing tool is active.
 * Fades out after 6 s; reappears after 60 s of idle (reset on any mouse move).
 * Uses 320ms var(--ease-paper) opacity transition.
 */
export function EmptyStateHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Fade out after 6 s
    const hideTimer = setTimeout(() => setVisible(false), 6000);
    // Re-show after 60 s idle (reset on any mouse move)
    let idleTimer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      setVisible(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setVisible(true), 60_000);
    };
    window.addEventListener('mousemove', resetIdle);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(idleTimer);
      window.removeEventListener('mousemove', resetIdle);
    };
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 320ms var(--ease-paper)',
        zIndex: 4,
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-display, var(--text-xl))',
          color: 'var(--color-muted-foreground)',
          textAlign: 'center',
          userSelect: 'none',
          margin: 0,
        }}
      >
        Select an element, or press{' '}
        <kbd
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            background: 'var(--color-surface-2, var(--color-surface-strong))',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '1px 5px',
            lineHeight: 1.5,
            verticalAlign: 'baseline',
          }}
        >
          W
        </kbd>{' '}
        to draw a wall.
      </p>
    </div>
  );
}
