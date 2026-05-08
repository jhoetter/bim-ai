import { useEffect, useState, type JSX } from 'react';

type SheetChipEntry = {
  kind: 'sheet_comment_chip';
  viewId: string;
  sheetId: string;
  commentId: string;
  sheetNumber: string;
};

export type SourceViewChipProps = {
  viewId: string;
  modelId: string;
  onNavigateToSheet?: (sheetId: string, commentId: string) => void;
};

export function SourceViewChip({
  viewId,
  modelId,
  onNavigateToSheet,
}: SourceViewChipProps): JSX.Element | null {
  const [chips, setChips] = useState<SheetChipEntry[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/v3/models/${encodeURIComponent(modelId)}/activity/sheet-chips?viewId=${encodeURIComponent(viewId)}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { chips?: SheetChipEntry[] };
        setChips(data.chips ?? []);
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelId, viewId]);

  if (chips.length === 0) return null;

  return (
    <div data-testid="source-view-chip" className="relative">
      <button
        type="button"
        aria-label={`${chips.length} comment${chips.length === 1 ? '' : 's'} from sheet`}
        onClick={() => setPanelOpen((v) => !v)}
        className="relative flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface hover:text-foreground"
        style={{ color: 'var(--draft-comment-pin)' }}
      >
        <FlagGlyph />
        <span
          data-testid="source-view-chip-count"
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent px-1 text-xs text-accent-foreground"
        >
          {chips.length}
        </span>
      </button>

      {panelOpen && (
        <ChipPanel
          chips={chips}
          onClose={() => setPanelOpen(false)}
          onNavigate={(sheetId, commentId) => {
            setPanelOpen(false);
            onNavigateToSheet?.(sheetId, commentId);
          }}
        />
      )}
    </div>
  );
}

function FlagGlyph(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      data-testid="flag-glyph"
    >
      <path d="M3 2v12h1.5V9.5H11l-2-3.5 2-3.5H4.5V2H3z" />
    </svg>
  );
}

function ChipPanel({
  chips,
  onClose,
  onNavigate,
}: {
  chips: SheetChipEntry[];
  onClose: () => void;
  onNavigate: (sheetId: string, commentId: string) => void;
}): JSX.Element {
  return (
    <div
      data-testid="source-view-chip-panel"
      className="absolute right-0 top-8 z-50 w-[300px] overflow-hidden rounded-lg border border-border bg-background shadow-elev-2"
      style={{
        animation: 'slideInRight 200ms var(--ease-paper) forwards',
      }}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-foreground">Sheet comments</span>
        <button
          type="button"
          aria-label="Close sheet comments panel"
          onClick={onClose}
          className="rounded p-0.5 text-muted hover:bg-surface hover:text-foreground"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
      <ul className="max-h-64 overflow-auto">
        {chips.map((chip) => (
          <li key={chip.commentId}>
            <button
              type="button"
              onClick={() => onNavigate(chip.sheetId, chip.commentId)}
              className="w-full px-3 py-2 text-left text-xs text-foreground hover:bg-surface"
            >
              <span className="font-medium text-muted">
                Sheet {chip.sheetNumber || chip.sheetId}
              </span>
              <span className="ml-2 text-foreground">comment #{chip.commentId.slice(0, 8)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
