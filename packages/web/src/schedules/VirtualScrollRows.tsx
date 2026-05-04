import { Fragment, type ReactNode, useRef, useState } from 'react';

/** Constant-row-height windowing inside a scroll area (avoid huge DOM for large models). */

export function VirtualScrollRows<T extends { id: string }>(props: {
  header: ReactNode;
  rows: T[];
  maxHeightPx: number;
  rowHeightPx: number;
  colSpan: number;
  tableClassName?: string;
  emptyHint?: ReactNode;
  renderRow: (row: T) => ReactNode;
}) {
  const { rows, maxHeightPx, rowHeightPx, colSpan, renderRow, emptyHint, header, tableClassName } =
    props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const viewH = maxHeightPx;
  const overscan = 6;
  const start = Math.max(0, Math.floor(scrollTop / rowHeightPx) - overscan);
  const visible = Math.ceil(viewH / rowHeightPx) + overscan * 2;
  const end = Math.min(rows.length, start + visible);
  const slice = rows.slice(start, end);
  const padTop = start * rowHeightPx;
  const padBottom = Math.max(0, (rows.length - end) * rowHeightPx);

  if (!rows.length) {
    return emptyHint ?? null;
  }

  return (
    <div
      ref={scrollRef}
      style={{ maxHeight: maxHeightPx }}
      className="overflow-auto"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <table className={tableClassName ?? 'mt-2 w-full text-left text-[11px]'}>
        <thead className="sticky top-0 z-[1] bg-surface shadow-sm">{header}</thead>
        <tbody>
          {padTop > 0 ? (
            <tr aria-hidden className="border-none">
              <td colSpan={colSpan} className="border-none p-0" style={{ height: padTop }} />
            </tr>
          ) : null}
          {slice.map((r) => (
            <Fragment key={r.id}>{renderRow(r)}</Fragment>
          ))}
          {padBottom > 0 ? (
            <tr aria-hidden className="border-none">
              <td colSpan={colSpan} className="border-none p-0" style={{ height: padBottom }} />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
