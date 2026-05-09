import { useEffect, useRef, useState } from 'react';

type ScheduleRow = {
  elementId: string;
  fields: Record<string, unknown>;
};

type ScheduleViewProps = {
  modelId: string;
  scheduleId: string;
  onHighlightElement?: (elementId: string | null) => void;
};

export function ScheduleView({ modelId, scheduleId, onHighlightElement }: ScheduleViewProps) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [filterExpr, setFilterExpr] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const filterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRows = (expr?: string, sk?: string | null, sd?: 'asc' | 'desc') => {
    const params = new URLSearchParams();
    if (expr) params.set('filterExpr', expr);
    if (sk) params.set('sortKey', sk);
    if (sd) params.set('sortDir', sd);
    fetch(`/api/v3/models/${modelId}/schedules/${scheduleId}/rows?${params}`)
      .then((r) => r.json())
      .then((data: ScheduleRow[]) => {
        setRows(data);
        if (data.length > 0) {
          const allKeys = new Set<string>();
          data.forEach((r) => Object.keys(r.fields).forEach((k) => allKeys.add(k)));
          setColumns(Array.from(allKeys));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchRows();
  }, [modelId, scheduleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (val: string) => {
    setFilterExpr(val);
    if (filterTimer.current) clearTimeout(filterTimer.current);
    filterTimer.current = setTimeout(() => fetchRows(val, sortKey, sortDir), 300);
  };

  const handleSort = (col: string) => {
    const newDir = sortKey === col && sortDir === 'asc' ? 'desc' : 'asc';
    setSortKey(col);
    setSortDir(newDir);
    fetchRows(filterExpr, col, newDir);
  };

  const startEdit = (rowId: string, col: string, current: unknown) => {
    setEditingCell({ rowId, col });
    setEditValue(current == null ? '' : String(current));
  };

  const commitEdit = (rowId: string, col: string) => {
    setEditingCell(null);
    fetch(`/api/v3/models/${modelId}/bundles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bundle: {
          schemaVersion: 'cmd-v3.0',
          commands: [{ type: 'set_element_prop', elementId: rowId, key: col, value: editValue }],
          assumptions: [],
          parentRevision: 0,
        },
      }),
    }).then(() => fetchRows(filterExpr, sortKey, sortDir));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--color-border)' }}>
        <input
          type="text"
          placeholder="Filter…"
          value={filterExpr}
          onChange={(e) => handleFilterChange(e.target.value)}
          style={{
            width: '100%',
            padding: 'var(--space-1) var(--space-2)',
            background: 'var(--surface-2)',
            color: 'var(--color-foreground)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)',
          }}
        />
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--text-sm)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: 'var(--surface-1)', zIndex: 1 }}>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderBottom: '2px solid var(--color-border)',
                    color: 'var(--color-muted)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col}
                  {sortKey === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.elementId}
                onMouseEnter={() => onHighlightElement?.(row.elementId)}
                onMouseLeave={() => onHighlightElement?.(null)}
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    onClick={() => startEdit(row.elementId, col, row.fields[col])}
                    style={{
                      padding: 'var(--space-1) var(--space-2)',
                      color: 'var(--color-foreground)',
                      cursor: 'text',
                      minWidth: 80,
                    }}
                  >
                    {editingCell?.rowId === row.elementId && editingCell.col === col ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(row.elementId, col)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(row.elementId, col);
                          if (e.key === 'Escape') setEditingCell(null);
                        }}
                        style={{
                          width: '100%',
                          background: 'var(--surface-2)',
                          color: 'var(--color-foreground)',
                          border: '1px solid var(--color-accent)',
                          padding: '2px var(--space-1)',
                          fontSize: 'var(--text-sm)',
                        }}
                      />
                    ) : (
                      String(row.fields[col] ?? '')
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div
            style={{
              padding: 'var(--space-4)',
              textAlign: 'center',
              color: 'var(--color-muted)',
            }}
          >
            No rows
          </div>
        )}
      </div>
    </div>
  );
}
