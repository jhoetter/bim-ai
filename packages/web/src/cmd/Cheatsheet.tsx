import type { ViewerMode } from '../state/store';

type Props = { open: boolean; onClose: () => void; viewerMode: ViewerMode };

const rows: [string, string][] = [
  ['⌘K', 'Palette'],
  ['⌘Z', 'Undo'],
  ['⌘⇧Z', 'Redo'],
  [': then Enter', 'Command bar phrase / JSON'],
  ['?', 'This sheet'],
  ['⌘⇧Space', 'Plan ⇄ 3D'],
  ['⇧drag', 'Pan plan'],
  ['⇧wall draw', 'Ortho snap'],
  ['Esc', 'Cancel draft'],
  ['R click-drag', 'Room rectangle (rectangle tool)'],
  ['W/D/N', 'Wall / door / window tools'],
];

export function Cheatsheet({ open, onClose, viewerMode }: Props) {
  void viewerMode;
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg border bg-background p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex justify-between gap-2">
          <div className="text-sm font-semibold">Keyboard cheatsheet</div>
          <button type="button" className="text-xs text-muted" onClick={onClose}>
            Close · Esc{' '}
          </button>
        </div>

        <ul className="space-y-2 text-xs">
          {rows.map(([k, lab]) => (
            <li
              key={`${k}:${lab}`}
              className="flex justify-between gap-4 border-b border-border/70 pb-1"
            >
              <code className="shrink-0 rounded border px-2 py-0.5">{k}</code>

              <span className="text-right text-muted">{lab}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
