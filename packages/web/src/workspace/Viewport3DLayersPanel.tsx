import { type JSX } from 'react';
import { useTranslation } from 'react-i18next';

export const VIEWER_HIDDEN_KIND_KEYS = [
  'wall',
  'floor',
  'roof',
  'stair',
  'door',
  'window',
  'room',
] as const;

export type ViewerHiddenKindKey = (typeof VIEWER_HIDDEN_KIND_KEYS)[number];

export interface Viewport3DLayersPanelProps {
  viewerCategoryHidden: Record<string, boolean>;
  onToggleCategory: (kind: ViewerHiddenKindKey) => void;
  viewerClipElevMm: number | null;
  onSetClipElevMm: (mm: number | null) => void;
  viewerClipFloorElevMm: number | null;
  onSetClipFloorElevMm: (mm: number | null) => void;
  onClipElevBlur?: () => void;
  onClipFloorBlur?: () => void;
  activeViewpointId?: string;
}

export function Viewport3DLayersPanel({
  viewerCategoryHidden,
  onToggleCategory,
  viewerClipElevMm,
  onSetClipElevMm,
  viewerClipFloorElevMm,
  onSetClipFloorElevMm,
  onClipElevBlur,
  onClipFloorBlur,
  activeViewpointId,
}: Viewport3DLayersPanelProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="viewport3d-layers-panel" className="flex flex-col gap-3 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        {t('layers3d.heading')}
      </div>

      {activeViewpointId ? (
        <p className="text-[10px] text-muted">
          {t('layers3d.viewpointToggleHint', { id: activeViewpointId })}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {VIEWER_HIDDEN_KIND_KEYS.map((lk) => (
          <label key={lk} className="flex cursor-pointer items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              data-testid={`layer-toggle-${lk}`}
              checked={!viewerCategoryHidden[lk]}
              onChange={() => onToggleCategory(lk)}
            />
            <span>{t(`tools.${lk}.label`)}</span>
          </label>
        ))}
      </div>

      <label className="block text-[10px] text-muted">
        {t('layers3d.sectionBoxCap')}
        <input
          data-testid="clip-elev-input"
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
          placeholder="e.g. 5600"
          inputMode="numeric"
          value={viewerClipElevMm ?? ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              onSetClipElevMm(null);
              return;
            }
            const n = Number(raw);
            onSetClipElevMm(Number.isFinite(n) ? n : null);
          }}
          onBlur={onClipElevBlur}
        />
      </label>

      <label className="block text-[10px] text-muted">
        {t('layers3d.sectionBoxFloor')}
        <input
          data-testid="clip-floor-input"
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
          placeholder="e.g. 2500"
          inputMode="numeric"
          value={viewerClipFloorElevMm ?? ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              onSetClipFloorElevMm(null);
              return;
            }
            const n = Number(raw);
            onSetClipFloorElevMm(Number.isFinite(n) ? n : null);
          }}
          onBlur={onClipFloorBlur}
        />
      </label>
    </div>
  );
}
