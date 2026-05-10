import { useState } from 'react';
import type { ReactElement } from 'react';
import type { AssetLibraryEntry, ParamSchemaEntry } from '@bim-ai/core';

type AssetPreviewPaneProps = {
  entry: AssetLibraryEntry | null;
  onPlace: (entry: AssetLibraryEntry, paramValues: Record<string, unknown>) => void;
};

function ParamField({
  param,
  value,
  onChange,
}: {
  param: ParamSchemaEntry;
  value: unknown;
  onChange: (v: unknown) => void;
}): ReactElement {
  if (param.kind === 'bool') {
    return (
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 'var(--text-xs)',
          color: 'var(--color-foreground)',
        }}
      >
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {param.key}
      </label>
    );
  }
  if (param.kind === 'mm') {
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
          {param.key} (mm)
        </span>
        <input
          type="number"
          value={value as number}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            background: 'var(--color-surface-strong)',
            border: '1px solid var(--color-border)',
            borderRadius: 3,
            color: 'var(--color-foreground)',
            fontSize: 'var(--text-xs)',
            padding: '2px 6px',
            width: '100%',
          }}
        />
      </label>
    );
  }
  if (param.kind === 'enum') {
    const opts = Array.isArray(param.constraints) ? (param.constraints as string[]) : [];
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>{param.key}</span>
        <select
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          style={{
            background: 'var(--color-surface-strong)',
            border: '1px solid var(--color-border)',
            borderRadius: 3,
            color: 'var(--color-foreground)',
            fontSize: 'var(--text-xs)',
            padding: '2px 6px',
          }}
        >
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }
  // material or fallback — text input
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>{param.key}</span>
      <input
        type="text"
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--color-surface-strong)',
          border: '1px solid var(--color-border)',
          borderRadius: 3,
          color: 'var(--color-foreground)',
          fontSize: 'var(--text-xs)',
          padding: '2px 6px',
          width: '100%',
        }}
      />
    </label>
  );
}

export function AssetPreviewPane({ entry, onPlace }: AssetPreviewPaneProps): ReactElement {
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});

  function handleParamChange(key: string, value: unknown): void {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  }

  function handlePlace(): void {
    if (!entry) return;
    const resolved: Record<string, unknown> = {};
    if (entry.paramSchema) {
      for (const p of entry.paramSchema) {
        resolved[p.key] = p.key in paramValues ? paramValues[p.key] : p.default;
      }
    }
    onPlace(entry, resolved);
  }

  if (!entry) {
    return (
      <div
        style={{
          padding: 16,
          color: 'var(--color-muted)',
          fontSize: 'var(--text-xs)',
          textAlign: 'center',
        }}
      >
        Select an asset to preview
      </div>
    );
  }

  return (
    <div
      data-testid="asset-preview-pane"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 12,
        overflowY: 'auto',
        flex: 1,
      }}
    >
      <div
        style={{ fontSize: 'var(--text-sm)', color: 'var(--color-foreground)', fontWeight: 500 }}
      >
        {entry.name}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
        {entry.category}
        {entry.description ? ` — ${entry.description}` : ''}
      </div>
      {entry.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {entry.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-muted)',
                background: 'var(--color-surface-muted)',
                borderRadius: 2,
                padding: '1px 4px',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {entry.paramSchema && entry.paramSchema.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Parameters
          </div>
          {entry.paramSchema.map((p) => (
            <ParamField
              key={p.key}
              param={p}
              value={p.key in paramValues ? paramValues[p.key] : p.default}
              onChange={(v) => handleParamChange(p.key, v)}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        data-testid="asset-place-btn"
        onClick={handlePlace}
        style={{
          marginTop: 'auto',
          background: 'var(--color-accent)',
          color: 'var(--text-on-accent)',
          border: 'none',
          borderRadius: 4,
          padding: '6px 12px',
          fontSize: 'var(--text-xs)',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        Place
      </button>
    </div>
  );
}
