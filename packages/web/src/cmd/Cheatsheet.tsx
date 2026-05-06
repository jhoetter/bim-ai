import type { ViewerMode } from '../state/store';
import { CHEATSHEET } from './cheatsheetData';

type Props = { open: boolean; onClose: () => void; viewerMode: ViewerMode };

// Navigation sections shown in the sidebar cheatsheet.
const NAV_SECTION_IDS = new Set(['nav3d', 'walk', 'nav2d', 'global', 'history']);

export function Cheatsheet({ open, onClose, viewerMode }: Props) {
  void viewerMode;
  if (!open) return null;

  const sections = CHEATSHEET.filter((s) => NAV_SECTION_IDS.has(s.id));

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
        <div className="mb-3 flex justify-between gap-2">
          <div className="text-sm font-semibold">Keyboard shortcuts</div>
          <button type="button" className="text-xs text-muted" onClick={onClose}>
            Close · Esc
          </button>
        </div>

        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.id}>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {section.label}
              </div>
              <ul className="space-y-1.5">
                {section.entries.map((entry) => (
                  <li
                    key={`${section.id}:${entry.action}`}
                    className="flex items-start justify-between gap-4 border-b border-border/50 pb-1.5 text-xs"
                  >
                    <span className="text-foreground">{entry.action}</span>
                    <kbd className="shrink-0 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
                      {entry.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
