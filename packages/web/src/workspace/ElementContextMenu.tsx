import type { JSX } from 'react';
import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  separator?: boolean;
}

interface ElementContextMenuProps {
  open: boolean;
  anchorX: number;
  anchorY: number;
  items: ContextMenuItem[];
  onClose: () => void;
  'data-testid'?: string;
}

function toLabelKebab(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function ElementContextMenu({
  open,
  anchorX,
  anchorY,
  items,
  onClose,
  'data-testid': testId,
}: ElementContextMenuProps): JSX.Element | null {
  const ref = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onAway = (ev: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(ev.target as Node)) return;
      onClose();
    };
    const onEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onAway);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onAway);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <ul
      ref={ref}
      data-testid={testId}
      role="menu"
      style={{ position: 'fixed', left: anchorX, top: anchorY, zIndex: 1000 }}
      className="m-0 min-w-[200px] list-none overflow-hidden rounded border border-border bg-surface p-0 py-1 text-foreground shadow-lg"
    >
      {items.map((item, idx) => {
        if (item.separator) {
          return <hr key={idx} className="my-1 border-border" />;
        }
        return (
          <li key={idx} role="none">
            <button
              type="button"
              role="menuitem"
              data-testid={`ctx-item-${toLabelKebab(item.label)}`}
              disabled={item.disabled}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-accent/20 disabled:opacity-40"
            >
              {item.label}
              {item.shortcut && <span className="ml-auto pl-6 text-muted">{item.shortcut}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
