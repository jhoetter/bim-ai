import type * as React from 'react';

export {
  Icons,
  IconLabels,
  ICON_SIZE,
  StairsIcon,
  type IconName,
  type LucideLikeIcon,
} from './icons';

export function Panel(props: React.PropsWithChildren<{ title: string }>) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {props.title}
      </div>
      <div className="text-sm">{props.children}</div>
    </div>
  );
}

export function Btn({
  variant,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'quiet' }) {
  const quiet = variant === 'quiet';
  return (
    <button
      {...props}
      className={[
        'rounded-md px-3 py-1 text-sm outline-none ring-ring transition-colors',
        quiet
          ? 'bg-transparent text-accent hover:bg-background'
          : 'bg-accent text-accent-foreground hover:opacity-90',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
