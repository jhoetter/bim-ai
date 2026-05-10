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
type ViewerRenderStyle = 'shaded' | 'wireframe' | 'consistent-colors' | 'hidden-line';

const GRAPHIC_STYLE_OPTIONS: Array<{
  value: ViewerRenderStyle;
  label: string;
  title: string;
}> = [
  {
    value: 'shaded',
    label: 'Shaded',
    title: 'Show material lighting and surface depth',
  },
  {
    value: 'consistent-colors',
    label: 'Colors',
    title: 'Show clear category colors for scanning the model',
  },
  {
    value: 'wireframe',
    label: 'Wire',
    title: 'Show transparent wireframe geometry',
  },
  {
    value: 'hidden-line',
    label: 'Hidden',
    title: 'Show clean documentation-style outlines',
  },
];

const BACKGROUND_OPTIONS: Array<{
  value: 'light_grey' | 'white' | 'dark';
  label: string;
  swatchClassName: string;
}> = [
  {
    value: 'light_grey',
    label: 'Sky',
    swatchClassName: 'bg-gradient-to-b from-sky-100 to-stone-100',
  },
  {
    value: 'white',
    label: 'White',
    swatchClassName: 'bg-white',
  },
  {
    value: 'dark',
    label: 'Dark',
    swatchClassName: 'bg-slate-900',
  },
];

const CAMERA_OPTIONS: Array<{
  value: 'perspective' | 'orthographic';
  label: string;
  Icon: typeof Icons.viewpoint;
}> = [
  { value: 'perspective', label: 'Perspective', Icon: Icons.viewpoint },
  { value: 'orthographic', label: 'Ortho', Icon: Icons.planView },
];

export interface Viewport3DLayersPanelProps {
  viewerCategoryHidden: Record<string, boolean>;
  onToggleCategory: (kind: ViewerHiddenKindKey) => void;
  viewerRenderStyle: ViewerRenderStyle;
  onSetRenderStyle: (style: ViewerRenderStyle) => void;
  viewerBackground: 'white' | 'light_grey' | 'dark';
  onSetBackground: (bg: 'white' | 'light_grey' | 'dark') => void;
  viewerEdges: 'normal' | 'none';
  onSetEdges: (edges: 'normal' | 'none') => void;
  viewerProjection: 'perspective' | 'orthographic';
  onSetProjection: (projection: 'perspective' | 'orthographic') => void;
  sectionBoxActive: boolean;
  onSetSectionBoxActive: (active: boolean) => void;
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
  viewerProjection,
  onSetProjection,
  sectionBoxActive,
  onSetSectionBoxActive,
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
        <div className="grid grid-cols-2 gap-1.5">
          {GRAPHIC_STYLE_OPTIONS.map(({ value, label, title }) => (
            <button
              key={value}
              type="button"
              onClick={() => onSetRenderStyle(value)}
              data-active={viewerRenderStyle === value ? 'true' : 'false'}
              aria-label={title}
              title={title}
              className={[
                'flex h-[66px] flex-col items-center justify-center gap-1 rounded border px-1.5 text-[11px] transition-colors',
                viewerRenderStyle === value
                  ? 'border-accent bg-accent/15 font-medium text-foreground'
                  : 'border-border bg-background text-muted hover:text-foreground',
              ].join(' ')}
            >
              <GraphicStylePreview style={value} active={viewerRenderStyle === value} />
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 space-y-2">
          <div>
            <div className="mb-1 text-[10px] text-muted">Background</div>
            <div className="grid grid-cols-3 gap-1">
              {BACKGROUND_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSetBackground(option.value)}
                  aria-label={`Use ${option.label} background`}
                  title={`Use ${option.label} background`}
                  data-active={viewerBackground === option.value ? 'true' : 'false'}
                  className={[
                    'flex h-8 items-center gap-1 rounded border px-1 text-[10px] transition-colors',
                    viewerBackground === option.value
                      ? 'border-accent bg-accent/15 font-medium text-foreground'
                      : 'border-border bg-background text-muted hover:text-foreground',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className={`h-4 w-4 rounded-sm border border-border ${option.swatchClassName}`}
                  />
                  <span className="min-w-0 truncate">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] text-muted">Edges</div>
            <div className="grid grid-cols-2 gap-1">
              {[
                ['normal', 'On'],
                ['none', 'Off'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onSetEdges(value as 'normal' | 'none')}
                  aria-label={`${label} model edges`}
                  title={`${label} model edges`}
                  data-active={viewerEdges === value ? 'true' : 'false'}
                  className={[
                    'h-7 rounded border px-2 text-[11px] transition-colors',
                    viewerEdges === value
                      ? 'border-accent bg-accent/15 font-medium text-foreground'
                      : 'border-border bg-background text-muted hover:text-foreground',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded border border-border bg-surface-strong p-2">
        <div className="mb-1.5 text-[10px] font-semibold uppercase text-muted">Camera</div>
        <div className="grid grid-cols-2 gap-1">
          {CAMERA_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => onSetProjection(value)}
              aria-label={`Use ${label} projection`}
              title={`Use ${label} projection`}
              data-active={viewerProjection === value ? 'true' : 'false'}
              className={[
                'flex h-8 items-center justify-center gap-1.5 rounded border px-2 text-[11px] transition-colors',
                viewerProjection === value
                  ? 'border-accent bg-accent/15 font-medium text-foreground'
                  : 'border-border bg-background text-muted hover:text-foreground',
              ].join(' ')}
            >
              <Icon size={ICON_SIZE.chrome} aria-hidden="true" />
              {label}
            </button>
          ))}
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
          <button
            type="button"
            onClick={() => onSetSectionBoxActive(!sectionBoxActive)}
            aria-pressed={sectionBoxActive}
            data-active={sectionBoxActive ? 'true' : 'false'}
            className={[
              'flex h-8 w-full items-center justify-center gap-1.5 rounded border px-2 text-[11px] transition-colors',
              sectionBoxActive
                ? 'border-accent bg-accent/15 font-medium text-foreground'
                : 'border-border bg-background text-muted hover:text-foreground',
            ].join(' ')}
          >
            <Icons.sectionBox size={ICON_SIZE.chrome} aria-hidden="true" />
            {sectionBoxActive ? 'Section box on' : 'Section box off'}
          </button>
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

function GraphicStylePreview({
  style,
  active,
}: {
  style: ViewerRenderStyle;
  active: boolean;
}): JSX.Element {
  const accentLine = active ? 'bg-accent/70' : 'bg-muted/70';
  const border = active ? 'border-accent' : 'border-border';

  if (style === 'wireframe') {
    return (
      <span
        data-testid="graphic-style-preview-wireframe"
        aria-hidden="true"
        className={`relative h-7 w-10 overflow-hidden rounded border ${border} bg-background`}
      >
        <span className={`absolute left-2 top-1 h-5 w-5 rotate-45 border ${border}`} />
        <span className={`absolute left-4 top-1 h-5 w-5 rotate-45 border ${border}`} />
        <span className={`absolute left-1 top-3 h-px w-8 ${accentLine}`} />
        <span className={`absolute left-5 top-1 h-5 w-px ${accentLine}`} />
      </span>
    );
  }

  if (style === 'hidden-line') {
    return (
      <span
        data-testid="graphic-style-preview-hidden-line"
        aria-hidden="true"
        className={`relative h-7 w-10 overflow-hidden rounded border ${border} bg-background`}
      >
        <span className="absolute bottom-1 left-1.5 h-4 w-7 rounded-sm border border-foreground/70 bg-surface" />
        <span className="absolute bottom-3 left-5 h-3 w-3 border-l border-t border-foreground/60" />
        <span className="absolute bottom-2 left-3 h-px w-5 border-t border-dashed border-muted" />
      </span>
    );
  }

  if (style === 'consistent-colors') {
    return (
      <span
        data-testid="graphic-style-preview-consistent-colors"
        aria-hidden="true"
        className={`relative h-7 w-10 overflow-hidden rounded border ${border} bg-background`}
      >
        <span className="absolute bottom-1 left-1.5 h-4 w-3 rounded-sm border border-border bg-sky-300/80" />
        <span className="absolute bottom-1 left-4 h-5 w-3 rounded-sm border border-border bg-emerald-300/80" />
        <span className="absolute bottom-1 right-1.5 h-3 w-3 rounded-sm border border-border bg-amber-300/80" />
      </span>
    );
  }

  return (
    <span
      data-testid="graphic-style-preview-shaded"
      aria-hidden="true"
      className={`relative h-7 w-10 overflow-hidden rounded border ${border} bg-gradient-to-br from-surface via-surface-strong to-muted/40`}
    >
      <span className="absolute bottom-1 left-2 h-4 w-5 rounded-sm border border-border bg-surface shadow-sm" />
      <span className="absolute bottom-3 left-4 h-3 w-4 rounded-sm border border-border bg-surface-strong shadow-sm" />
      <span className="absolute left-2 top-1 h-1.5 w-1.5 rounded-full bg-white/80" />
    </span>
  );
}
