import type { CSSProperties, JSX } from 'react';

import type { MaterialPbrSpec } from '../viewport/materials';

export type MaterialPreviewMode =
  | 'glass-sphere'
  | 'metal-sphere'
  | 'brick-panel'
  | 'timber-panel'
  | 'concrete-slab'
  | 'stone-panel'
  | 'hatch-panel'
  | 'color-chip';

export function previewModeForMaterial(material: MaterialPbrSpec): MaterialPreviewMode {
  if (material.category === 'glass') return 'glass-sphere';
  if (material.category === 'metal' || material.category === 'metal_roof') return 'metal-sphere';
  if (material.category === 'brick') return 'brick-panel';
  if (material.category === 'timber' || material.category === 'cladding') return 'timber-panel';
  if (material.category === 'concrete' || material.category === 'render') return 'concrete-slab';
  if (material.category === 'stone') return 'stone-panel';
  if (material.graphics?.surfacePattern || material.graphics?.cutPattern || material.hatchPattern)
    return 'hatch-panel';
  return 'color-chip';
}

function previewBackground(material: MaterialPbrSpec, mode: MaterialPreviewMode): string {
  const color = material.baseColor;
  switch (mode) {
    case 'brick-panel':
      return `linear-gradient(0deg, transparent 86%, rgba(255,255,255,.45) 86%),
        linear-gradient(90deg, transparent 47%, rgba(255,255,255,.35) 47%, rgba(255,255,255,.35) 53%, transparent 53%),
        ${color}`;
    case 'timber-panel':
      return `repeating-linear-gradient(90deg, ${color}, ${color} 9px, rgba(0,0,0,.12) 10px, ${color} 18px)`;
    case 'concrete-slab':
      return `radial-gradient(circle at 25% 35%, rgba(255,255,255,.22), transparent 18%),
        radial-gradient(circle at 70% 65%, rgba(0,0,0,.12), transparent 20%),
        ${color}`;
    case 'stone-panel':
      return `linear-gradient(90deg, transparent 48%, rgba(255,255,255,.22) 48%, rgba(255,255,255,.22) 52%, transparent 52%),
        linear-gradient(0deg, transparent 48%, rgba(0,0,0,.14) 48%, rgba(0,0,0,.14) 52%, transparent 52%),
        ${color}`;
    case 'hatch-panel':
      return `repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,.24) 5px, rgba(0,0,0,.24) 6px), ${color}`;
    default:
      return color;
  }
}

export function MaterialPreview({ material }: { material: MaterialPbrSpec }): JSX.Element {
  const mode = previewModeForMaterial(material);
  const relief = material.normalMapUrl || material.bumpMapUrl || material.heightMapUrl;
  const style: CSSProperties = {
    background: previewBackground(material, mode),
    opacity: material.opacity ?? (material.category === 'glass' ? 0.58 : 1),
  };
  return (
    <span
      aria-label={`${material.displayName} preview`}
      className="relative block h-10 w-12 overflow-hidden rounded border border-border"
      data-testid={`material-preview-${material.key}`}
      data-preview-mode={mode}
      style={style}
    >
      {mode.endsWith('sphere') ? (
        <span className="absolute inset-1 rounded-full bg-white/20 shadow-[inset_-8px_-8px_12px_rgba(0,0,0,.28),inset_5px_5px_8px_rgba(255,255,255,.45)]" />
      ) : null}
      {relief ? (
        <span
          className="absolute bottom-0 right-0 h-2 w-2 rounded-tl border-l border-t border-border bg-surface/80"
          data-testid={`material-preview-relief-${material.key}`}
        />
      ) : null}
    </span>
  );
}
