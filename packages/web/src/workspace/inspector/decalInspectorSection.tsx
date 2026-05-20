import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

type DecalElement = Extract<Element, { kind: 'decal' }>;
type PropertyChangeHandler = (property: string, value: unknown) => void;

export function DecalInspectorSection({
  el,
  onPropertyChange,
}: {
  el: DecalElement;
  onPropertyChange?: PropertyChangeHandler;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2" data-testid="inspector-decal">
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Image</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {(el as { imageSrc?: string | null }).imageSrc ? (
            <img
              src={(el as { imageSrc?: string | null }).imageSrc!}
              alt="decal preview"
              data-testid="inspector-decal-preview"
              style={{
                width: 64,
                height: 64,
                objectFit: 'contain',
                border: '1px solid var(--color-border)',
              }}
            />
          ) : (
            <div
              data-testid="inspector-decal-no-image"
              style={{
                width: 64,
                height: 64,
                background: 'var(--color-muted, #f0f0f0)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
              }}
            >
              No image
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            data-testid="inspector-decal-file-input"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (readerEvent) => {
                const dataUrl = readerEvent.target?.result as string;
                onPropertyChange?.('imageSrc', dataUrl);
              };
              reader.readAsDataURL(file);
            }}
            style={{ fontSize: 11 }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Width (mm)</span>
        <input
          type="number"
          className="w-24 text-xs bg-surface border border-border rounded px-1 py-0.5"
          data-testid="inspector-decal-width"
          value={(el as { widthMm?: number }).widthMm ?? 500}
          onChange={(event) => onPropertyChange?.('widthMm', +event.currentTarget.value)}
        />
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Height (mm)</span>
        <input
          type="number"
          className="w-24 text-xs bg-surface border border-border rounded px-1 py-0.5"
          data-testid="inspector-decal-height"
          value={(el as { heightMm?: number }).heightMm ?? 500}
          onChange={(event) => onPropertyChange?.('heightMm', +event.currentTarget.value)}
        />
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Opacity</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          data-testid="inspector-decal-opacity"
          value={(el as { opacity?: number }).opacity ?? 1}
          onChange={(event) => onPropertyChange?.('opacity', +event.currentTarget.value)}
        />
      </div>
    </div>
  );
}
