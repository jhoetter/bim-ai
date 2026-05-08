import { useEffect, type ReactElement } from 'react';
import type { ViewTemplatePropagation } from '@bim-ai/core';

type PropagationToastProps = {
  propagation: ViewTemplatePropagation;
  onDismiss: () => void;
  onViewList: () => void;
};

export function PropagationToast({
  propagation,
  onDismiss,
  onViewList,
}: PropagationToastProps): ReactElement | null {
  const { affected, unbound } = propagation;

  useEffect(() => {
    const id = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(id);
  }, [onDismiss]);

  if (affected.length === 0 && unbound.length === 0) return null;

  const parts: string[] = [];
  if (affected.length > 0) {
    parts.push(`${affected.length} view${affected.length === 1 ? '' : 's'} updated`);
  }
  if (unbound.length > 0) {
    parts.push(`${unbound.length} unbound`);
  }
  const message = parts.join(', ');

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-md px-4 py-2.5 text-sm shadow-lg"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        animation: 'slide-up 200ms var(--ease-paper) both',
      }}
    >
      <span>{message}.</span>
      {affected.length > 0 && (
        <button
          type="button"
          className="underline underline-offset-2 hover:opacity-70"
          onClick={() => {
            onViewList();
            onDismiss();
          }}
        >
          View list
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        className="ml-1 opacity-50 hover:opacity-100"
        onClick={onDismiss}
      >
        ✕
      </button>
    </div>
  );
}
