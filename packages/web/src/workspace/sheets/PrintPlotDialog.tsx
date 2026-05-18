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
  const [sheetOrientations, setSheetOrientations] = useState<
    Record<string, 'portrait' | 'landscape'>
  >({});
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [exporting, setExporting] = useState(false);
  const [marginMm, setMarginMm] = useState(10);

  if (!open) return null;

  const currentSheet = sheets[0] ?? null;

  function handleBrowserPrint(): void {
    const sheetEl = sheets.find((s) => s.element !== null)?.element;
    if (!sheetEl) return;

    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) {
      alert('Allow popups to use browser print.');
      return;
    }

    const clone = sheetEl.cloneNode(true) as HTMLElement;
    const styles = Array.from(document.styleSheets)
      .map((ss) => {
        try {
          return Array.from(ss.cssRules)
            .map((r) => r.cssText)
            .join('\n');
        } catch {
          return '';
        }
      })
      .join('\n');

    win.document.write(`<!DOCTYPE html><html><head>
    <style>${styles}
    @media print { body { margin: 0; } }
    </style>
  </head><body>${clone.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  function handleBrowserPrintAll(): void {
    const validSheets = sheets.filter((s) => s.element !== null);
    if (validSheets.length === 0) return;

    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) {
      alert('Allow popups to use browser print.');
      return;
    }

    const styles = Array.from(document.styleSheets)
      .map((ss) => {
        try {
          return Array.from(ss.cssRules)
            .map((r) => r.cssText)
            .join('\n');
        } catch {
          return '';
        }
      })
      .join('\n');

    const sheetsHtml = validSheets
      .map((s) => {
        const clone = s.element!.cloneNode(true) as HTMLElement;
        return `<div style="break-after: page;">${clone.outerHTML}</div>`;
      })
      .join('\n');

    win.document.write(`<!DOCTYPE html><html><head>
    <style>${styles}
    @page { size: A4 landscape; }
    @media print { body { margin: 0; } }
    </style>
  </head><body>${sheetsHtml}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

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
            marginMm,
          });
        }
      } else {
        if (!currentSheet?.element) return;
        const safeFilename = (currentSheet.name || 'sheet').replace(/[^a-zA-Z0-9_-]/g, '_');
        await exportSheetToPdf(currentSheet.element, {
          paperSize,
          orientation,
          filename: `${safeFilename}.pdf`,
          marginMm,
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
            data-testid="print-paper-size-select"
            value={paperSize}
            onChange={(e) => setPaperSize(e.currentTarget.value as PaperSize)}
            className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
          >
            <option value="A0">A0 (841×1189mm)</option>
            <option value="A1">A1 (594×841mm)</option>
            <option value="A2">A2 (420×594mm)</option>
            <option value="A3">A3 (297×420mm)</option>
            <option value="A4">A4 (210×297mm)</option>
            <option value="Letter">Letter (216×279mm)</option>
            <option value="Tabloid">Tabloid (279×432mm)</option>
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

        <label className="flex flex-col gap-1 text-xs text-foreground">
          Margin (mm)
          <input
            type="number"
            data-testid="print-margin-mm"
            value={marginMm}
            min={0}
            max={50}
            onChange={(e) => setMarginMm(+e.target.value)}
            className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
          />
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
          {sheets.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              {sheets.map((sheet) => (
                <div key={sheet.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-foreground/70">{sheet.name}</span>
                  <select
                    data-testid={`sheet-orientation-${sheet.id}`}
                    value={sheetOrientations[sheet.id] ?? orientation}
                    onChange={(e) =>
                      setSheetOrientations((prev) => ({
                        ...prev,
                        [sheet.id]: e.target.value as 'portrait' | 'landscape',
                      }))
                    }
                    className="text-xs border border-border/30 rounded px-1"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
              ))}
            </div>
          )}
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
            data-testid="print-browser-btn"
            disabled={exporting}
            onClick={() => {
              handleBrowserPrint();
            }}
            className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-strong disabled:opacity-60"
          >
            Print (Browser)…
          </button>
          <button
            type="button"
            data-testid="print-all-views-browser-btn"
            onClick={() => {
              handleBrowserPrintAll();
            }}
            className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-strong"
          >
            Print All Views (Browser)
          </button>
          <button
            type="button"
            data-testid="print-all-sheets-btn"
            disabled={exporting}
            onClick={async () => {
              if (exporting) return;
              setExporting(true);
              try {
                const validSheets = sheets
                  .filter((s) => s.element !== null)
                  .map((s) => ({ element: s.element as HTMLElement | HTMLCanvasElement }));
                if (validSheets.length > 0) {
                  await exportSheetsToPdf(validSheets, {
                    paperSize,
                    orientation,
                    filename: 'all-sheets.pdf',
                    marginMm,
                  });
                }
              } finally {
                setExporting(false);
                onClose();
              }
            }}
            className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-strong disabled:opacity-60"
          >
            Print All Sheets
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
