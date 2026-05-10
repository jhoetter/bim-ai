import { type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Icons, ICON_SIZE } from '@bim-ai/ui';

export const VIEWER_HIDDEN_KIND_KEYS = [
  'wall',
  'floor',
  'roof',
  'stair',
  'door',
  'window',
  'room',
  'site_origin',
] as const;

export type ViewerHiddenKindKey = (typeof VIEWER_HIDDEN_KIND_KEYS)[number];

export interface Viewport3DLayersPanelProps {
  viewerCategoryHidden: Record<string, boolean>;
  onToggleCategory: (kind: ViewerHiddenKindKey) => void;
  viewerRenderStyle: 'shaded' | 'wireframe' | 'consistent-colors' | 'hidden-line';
  onSetRenderStyle: (style: 'shaded' | 'wireframe' | 'consistent-colors' | 'hidden-line') => void;
  viewerBackground: 'white' | 'light_grey' | 'dark';
  onSetBackground: (bg: 'white' | 'light_grey' | 'dark') => void;
  viewerEdges: 'normal' | 'none';
  onSetEdges: (edges: 'normal' | 'none') => void;
  viewerClipElevMm: number | null;
  onSetClipElevMm: (mm: number | null) => void;
  viewerClipFloorElevMm: number | null;
  onSetClipFloorElevMm: (mm: number | null) => void;
  onClipElevBlur?: () => void;
  onClipFloorBlur?: () => void;
  activeViewpointId?: string;
  onResetToSavedView?: () => void;
  onUpdateSavedView?: () => void;
}

export function Viewport3DLayersPanel({
  viewerCategoryHidden,
  onToggleCategory,
  viewerRenderStyle,
  onSetRenderStyle,
  viewerBackground,
  onSetBackground,
  viewerEdges,
  onSetEdges,
  viewerClipElevMm,
  onSetClipElevMm,
  viewerClipFloorElevMm,
  onSetClipFloorElevMm,
  onClipElevBlur,
  onClipFloorBlur,
  activeViewpointId,
  onResetToSavedView,
  onUpdateSavedView,
}: Viewport3DLayersPanelProps): JSX.Element {
  const { t } = useTranslation();
  const iconForKind: Record<ViewerHiddenKindKey, typeof Icons.wall> = {
    wall: Icons.wall,
    floor: Icons.floor,
    roof: Icons.roof,
    stair: Icons.stair,
    door: Icons.door,
    window: Icons.window,
    room: Icons.room,
    site_origin: Icons.grid,
  };
  return (
    <div data-testid="viewport3d-layers-panel" className="flex flex-col gap-3 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase text-muted">View controls</div>

      <section className="rounded border border-border bg-surface-strong p-2">
        <div className="mb-1.5 text-[10px] font-semibold uppercase text-muted">Graphics</div>
        <div className="grid grid-cols-2 gap-1">
          {[
            ['shaded', 'Shaded'],
            ['consistent-colors', 'Colors'],
            ['wireframe', 'Wire'],
            ['hidden-line', 'Hidden'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                onSetRenderStyle(
                  value as 'shaded' | 'wireframe' | 'consistent-colors' | 'hidden-line',
                )
              }
              data-active={viewerRenderStyle === value ? 'true' : 'false'}
              className={[
                'h-7 rounded border px-2 text-[11px]',
                viewerRenderStyle === value
                  ? 'border-accent bg-accent/15 font-medium text-foreground'
                  : 'border-border bg-background text-muted hover:text-foreground',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block text-[10px] text-muted">
            Background
            <select
              value={viewerBackground}
              onChange={(e) => onSetBackground(e.target.value as 'white' | 'light_grey' | 'dark')}
              className="mt-1 h-7 w-full rounded border border-border bg-background px-2 text-[11px] text-foreground"
            >
              <option value="light_grey">Sky</option>
              <option value="white">White</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="block text-[10px] text-muted">
            Edges
            <select
              value={viewerEdges}
              onChange={(e) => onSetEdges(e.target.value as 'normal' | 'none')}
              className="mt-1 h-7 w-full rounded border border-border bg-background px-2 text-[11px] text-foreground"
            >
              <option value="normal">Normal</option>
              <option value="none">None</option>
            </select>
          </label>
        </div>
      </section>

      {activeViewpointId ? (
        <div className="rounded border border-border bg-surface-strong p-2">
          <p className="truncate text-[10px] text-muted">
            {t('layers3d.viewpointToggleHint', { id: activeViewpointId })}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              className="rounded border border-border bg-background px-2 py-1 text-[10px] text-foreground hover:bg-surface"
              onClick={onResetToSavedView}
              disabled={!onResetToSavedView}
            >
              Reset to saved
            </button>
            <button
              type="button"
              className="rounded border border-accent bg-accent/15 px-2 py-1 text-[10px] font-medium text-foreground hover:bg-accent/20"
              onClick={onUpdateSavedView}
              disabled={!onUpdateSavedView}
            >
              Update saved view
            </button>
          </div>
        </div>
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
            {(() => {
              const Icon = iconForKind[lk];
              return <Icon size={ICON_SIZE.chrome} aria-hidden="true" className="text-muted" />;
            })()}
            <span>{t(`tools.${lk}.label`)}</span>
          </label>
        ))}
      </div>

      <details className="rounded border border-border bg-surface-strong px-2 py-1.5" open>
        <summary className="cursor-pointer text-[10px] font-semibold uppercase text-muted">
          Section box
        </summary>
        <div className="mt-2 space-y-2">
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
      </details>
    </div>
  );
}
