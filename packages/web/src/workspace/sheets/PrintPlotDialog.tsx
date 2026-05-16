import { type JSX, useState } from 'react';

import { exportSheetToPdf, exportSheetsToPdf, type PaperSize } from '../../export/pdfExporter';

export interface PrintPlotSheet {
  id: string;
  name: string;
  element: HTMLElement | HTMLCanvasElement | null;
}

export interface PrintPlotDialogProps {
  open: boolean;
  onClose: () => void;
  sheets: PrintPlotSheet[];
}

export function PrintPlotDialog({
  open,
  onClose,
  sheets,
}: PrintPlotDialogProps): JSX.Element | null {
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const currentSheet = sheets[0] ?? null;

  const handleExport = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    try {
      if (scope === 'all') {
        const validSheets = sheets
          .filter((s) => s.element !== null)
          .map((s) => ({ element: s.element as HTMLElement | HTMLCanvasElement }));
        if (validSheets.length > 0) {
          await exportSheetsToPdf(validSheets, {
            paperSize,
            orientation,
            filename: 'sheets-export.pdf',
          });
        }
      } else {
        if (!currentSheet?.element) return;
        const safeFilename = (currentSheet.name || 'sheet').replace(/[^a-zA-Z0-9_-]/g, '_');
        await exportSheetToPdf(currentSheet.element, {
          paperSize,
          orientation,
          filename: `${safeFilename}.pdf`,
        });
      }
    } finally {
      setExporting(false);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Print / Plot"
      data-testid="print-plot-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      className="bg-black/40"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="rounded-lg border border-border bg-surface shadow-elev-3 w-80 p-4 flex flex-col gap-3">
        <div className="text-sm font-medium text-foreground">Print / Plot</div>

        <label className="flex flex-col gap-1 text-xs text-foreground">
          Paper size
          <select
            data-testid="print-paper-size"
            value={paperSize}
            onChange={(e) => setPaperSize(e.currentTarget.value as PaperSize)}
            className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
          >
            <option value="A4">A4</option>
            <option value="A3">A3</option>
            <option value="A2">A2</option>
            <option value="A1">A1</option>
            <option value="A0">A0</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-foreground">
          Orientation
          <select
            data-testid="print-orientation"
            value={orientation}
            onChange={(e) => setOrientation(e.currentTarget.value as 'portrait' | 'landscape')}
            className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
          >
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </select>
        </label>

        <div className="flex flex-col gap-1 text-xs text-foreground">
          Sheets
          <div data-testid="print-scope" className="flex gap-3">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="print-scope"
                value="current"
                checked={scope === 'current'}
                onChange={() => setScope('current')}
              />
              Current Sheet
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="print-scope"
                value="all"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
              />
              All Sheets
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-strong"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="print-export-pdf"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-strong disabled:opacity-60"
          >
            {exporting ? 'Exporting…' : 'Print / Export PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
