import type { KeyboardEvent as ReactKb } from 'react';

type Props = {
  expanded: boolean;

  onExpandedChange(v: boolean): void;

  onSubmit(raw: string): void;
};

export function CommandBar({ expanded, onExpandedChange, onSubmit }: Props) {
  function onKD(ev: ReactKb<HTMLInputElement>) {
    if (ev.key === 'Escape') {
      onExpandedChange(false);
    }

    if (ev.key === 'Enter') {
      const raw = ev.currentTarget.value;

      ev.currentTarget.value = '';

      if (raw.trim()) onSubmit(raw);

      ev.preventDefault();
    }
  }

  return (
    <div className="border-t border-border bg-surface/90 px-2 py-2">
      {!expanded ? (
        <div className="text-[11px] text-muted">
          Command bar · Press <kbd className="rounded border px-1">:</kbd> then type{' '}
          <code className="text-foreground">room rect 4200×3000</code> or paste JSON.
        </div>
      ) : (
        <input
          aria-label="Command bar"
          placeholder="Try: room rect 4500×3200 · or paste JSON commands"
          autoFocus
          className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
          onKeyDown={onKD}
        />
      )}
    </div>
  );
}
