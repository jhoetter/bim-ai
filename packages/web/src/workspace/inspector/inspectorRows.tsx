import type { JSX } from 'react';

interface FieldRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

export function FieldRow({ label, value, mono }: FieldRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-1.5 last:border-b-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={['text-sm text-foreground', mono ? 'font-mono text-xs' : ''].join(' ')}>
        {value}
      </span>
    </div>
  );
}

export function fmtMm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(2)} m`;
  return `${value.toFixed(0)} mm`;
}
