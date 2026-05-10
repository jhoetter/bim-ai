import type { ReactElement } from 'react';
import type { AssetLibraryEntry } from '@bim-ai/core';

type AssetCardProps = {
  entry: AssetLibraryEntry;
  selected?: boolean;
  onSelect: (entry: AssetLibraryEntry) => void;
  onPlace: (entry: AssetLibraryEntry) => void;
};

/** Schematic-plan thumbnail SVG drawn at 1:50 paper scale with --draft-* line weights. */
function SchematicThumbnail({ entry }: { entry: AssetLibraryEntry }): ReactElement {
  const w = entry.thumbnailMm?.widthMm ?? 60;
  const h = entry.thumbnailMm?.heightMm ?? 60;
  const cat = entry.category;
  const symbolKind = entry.planSymbolKind ?? entry.renderProxyKind;

  let body: ReactElement;
  if (symbolKind === 'bed') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <rect
          x={w * 0.16}
          y={h * 0.14}
          width={w * 0.28}
          height={h * 0.18}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <rect
          x={w * 0.56}
          y={h * 0.14}
          width={w * 0.28}
          height={h * 0.18}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <line
          x1={w * 0.12}
          y1={h * 0.38}
          x2={w * 0.88}
          y2={h * 0.86}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'wardrobe') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <line
          x1={w / 2}
          y1={4}
          x2={w / 2}
          y2={h - 4}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <circle
          cx={w * 0.42}
          cy={h * 0.62}
          r={Math.min(w, h) * 0.03}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <circle
          cx={w * 0.58}
          cy={h * 0.62}
          r={Math.min(w, h) * 0.03}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'lamp') {
    body = (
      <>
        <circle
          cx={w / 2}
          cy={h / 2}
          r={Math.min(w, h) * 0.34}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <circle
          cx={w / 2}
          cy={h / 2}
          r={Math.min(w, h) * 0.12}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'rug') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          rx={Math.min(w, h) * 0.05}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <rect
          x={w * 0.12}
          y={h * 0.16}
          width={w * 0.76}
          height={h * 0.68}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'fridge') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <line
          x1={w / 2}
          y1={4}
          x2={w / 2}
          y2={h - 4}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <line
          x1={w * 0.72}
          y1={h * 0.22}
          x2={w * 0.72}
          y2={h * 0.78}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <line
          x1={w * 0.18}
          y1={h * 0.64}
          x2={w * 0.82}
          y2={h * 0.64}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'oven') {
    const r = Math.min(w, h) * 0.07;
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        {[0.3, 0.5, 0.7].map((x) => (
          <circle
            key={x}
            cx={w * x}
            cy={h * 0.28}
            r={r}
            fill="none"
            stroke="var(--draft-cut)"
            strokeWidth={0.25}
          />
        ))}
        <rect
          x={w * 0.24}
          y={h * 0.52}
          width={w * 0.52}
          height={h * 0.26}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'sink') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--cat-fixture)"
          strokeWidth={0.5}
        />
        <rect
          x={w * 0.18}
          y={h * 0.24}
          width={w * 0.64}
          height={h * 0.52}
          rx={Math.min(w, h) * 0.08}
          fill="none"
          stroke="var(--cat-fixture)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'counter') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        {[0.25, 0.5, 0.75].map((x) => (
          <line
            key={x}
            x1={w * x}
            y1={4}
            x2={w * x}
            y2={h - 4}
            stroke="var(--draft-cut)"
            strokeWidth={0.25}
          />
        ))}
      </>
    );
  } else if (symbolKind === 'toilet') {
    body = (
      <>
        <rect
          x={w * 0.28}
          y={4}
          width={w * 0.44}
          height={h * 0.26}
          fill="none"
          stroke="var(--cat-fixture)"
          strokeWidth={0.5}
        />
        <ellipse
          cx={w / 2}
          cy={h * 0.62}
          rx={Math.min(w, h) * 0.22}
          ry={Math.min(w, h) * 0.28}
          fill="none"
          stroke="var(--cat-fixture)"
          strokeWidth={0.5}
        />
      </>
    );
  } else if (cat === 'kitchen' || cat === 'bathroom') {
    const r = Math.min(w, h) * 0.15;
    const cx = w / 2;
    const cy = h / 2;
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          rx={r}
          ry={r}
          fill="none"
          stroke="var(--cat-fixture)"
          strokeWidth={0.5}
        />
        <line x1={cx} y1={8} x2={cx} y2={h - 8} stroke="var(--cat-fixture)" strokeWidth={0.25} />
        <line x1={8} y1={cy} x2={w - 8} y2={cy} stroke="var(--cat-fixture)" strokeWidth={0.25} />
      </>
    );
  } else if (cat === 'door') {
    const r = Math.min(w, h) - 8;
    body = (
      <>
        <line x1={4} y1={4} x2={4} y2={4 + r} stroke="var(--draft-cut)" strokeWidth={0.5} />
        <line x1={4} y1={4} x2={4 + r} y2={4} stroke="var(--draft-cut)" strokeWidth={0.5} />
        <path
          d={`M ${4 + r} 4 A ${r} ${r} 0 0 0 4 ${4 + r}`}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
          strokeDasharray="1 1"
        />
      </>
    );
  } else if (cat === 'window') {
    const mid = h / 2;
    body = (
      <>
        <rect
          x={4}
          y={mid - 2}
          width={w - 8}
          height={4}
          fill="var(--color-canvas-paper)"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <line x1={4} y1={mid} x2={w - 4} y2={mid} stroke="var(--draft-cut)" strokeWidth={0.25} />
      </>
    );
  } else if (cat === 'furniture' || cat === 'casework') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <line
          x1={4}
          y1={h / 2}
          x2={w - 4}
          y2={h / 2}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else {
    body = (
      <rect
        x={4}
        y={4}
        width={w - 8}
        height={h - 8}
        fill="none"
        stroke="var(--draft-cut)"
        strokeWidth={0.5}
      />
    );
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      style={{ overflow: 'visible', display: 'block' }}
      aria-hidden="true"
    >
      {body}
    </svg>
  );
}

export function AssetCard({ entry, selected, onSelect, onPlace }: AssetCardProps): ReactElement {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      data-testid="asset-card"
      aria-label={entry.name}
      aria-selected={selected}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 8,
        borderRadius: 4,
        cursor: 'grab',
        background: selected ? 'var(--color-accent-soft)' : 'var(--color-surface-strong)',
        border: selected ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
        fontSize: 'var(--text-xs)',
        color: 'var(--color-foreground)',
        userSelect: 'none',
      }}
      onClick={() => onSelect(entry)}
      onDoubleClick={() => onPlace(entry)}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/bim-asset-id', entry.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onDragEnd={() => {
        // Placement is initiated via onPlace when drag ends on canvas
        onPlace(entry);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onPlace(entry);
        if (e.key === ' ') {
          e.preventDefault();
          onSelect(entry);
        }
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-canvas-paper)',
          borderRadius: 2,
        }}
      >
        <SchematicThumbnail entry={entry} />
      </div>
      <span
        style={{
          width: '100%',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 80,
        }}
        title={entry.name}
      >
        {entry.name}
      </span>
    </div>
  );
}
