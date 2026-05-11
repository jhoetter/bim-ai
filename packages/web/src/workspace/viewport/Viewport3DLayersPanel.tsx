import { type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import { useBimStore } from '../../state/store';
import type { ViewerRenderStyle } from '../../state/storeTypes';
import { VIEWER_CATEGORY_KEYS, type ViewerCatKey } from '../../viewport/sceneUtils';

export const VIEWER_HIDDEN_KIND_KEYS = VIEWER_CATEGORY_KEYS;

export type ViewerHiddenKindKey = ViewerCatKey;
type ViewerEdgeWidth = 1 | 2 | 3 | 4;

type ViewerGdoRuntimeState = {
  viewerShadowsEnabled?: boolean;
  viewerAmbientOcclusionEnabled?: boolean;
  viewerDepthCueEnabled?: boolean;
  viewerSilhouetteEdgeWidth?: ViewerEdgeWidth;
  viewerPhotographicExposureEv?: number;
};

const GDO_STORAGE_KEYS = {
  shadows: 'bim.viewer.shadowsEnabled',
  ambientOcclusion: 'bim.viewer.ambientOcclusionEnabled',
  depthCue: 'bim.viewer.depthCueEnabled',
  silhouetteEdgeWidth: 'bim.viewer.silhouetteEdgeWidth',
  photographicExposureEv: 'bim.viewer.photographicExposureEv',
} as const;

const PHOTOGRAPHIC_EXPOSURE_EV_MIN = -2;
const PHOTOGRAPHIC_EXPOSURE_EV_MAX = 2;
const PHOTOGRAPHIC_EXPOSURE_EV_STEP = 0.25;

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    /* noop */
  }
  return fallback;
}

function readStoredEdgeWidth(): ViewerEdgeWidth {
  try {
    const raw = Number(localStorage.getItem(GDO_STORAGE_KEYS.silhouetteEdgeWidth));
    if (raw === 1 || raw === 2 || raw === 3 || raw === 4) return raw;
  } catch {
    /* noop */
  }
  return 1;
}

function normalizeExposureEv(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const stepped = Math.round(n / PHOTOGRAPHIC_EXPOSURE_EV_STEP) * PHOTOGRAPHIC_EXPOSURE_EV_STEP;
  return Math.min(PHOTOGRAPHIC_EXPOSURE_EV_MAX, Math.max(PHOTOGRAPHIC_EXPOSURE_EV_MIN, stepped));
}

function readStoredExposureEv(): number {
  try {
    const raw = localStorage.getItem(GDO_STORAGE_KEYS.photographicExposureEv);
    if (raw != null) return normalizeExposureEv(raw);
  } catch {
    /* noop */
  }
  return 0;
}

function formatExposureEv(value: number): string {
  const fixed = value.toFixed(2).replace(/\.?0+$/, '');
  return value > 0 ? `+${fixed}` : fixed;
}

function writeStoredString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

function setViewerGdoRuntimeState(partial: ViewerGdoRuntimeState): void {
  useBimStore.setState(partial as object);
}

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
  {
    value: 'realistic',
    label: 'Realistic',
    title: 'Show physically lit materials with photographic tone mapping',
  },
  {
    value: 'ray-trace',
    label: 'Ray trace',
    title: 'Show a high-quality ray-trace-style preview with soft shadows',
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

const VIEWER_LAYER_LABELS: Record<ViewerHiddenKindKey, string> = {
  wall: 'Walls',
  floor: 'Floors',
  roof: 'Roofs',
  ceiling: 'Ceilings',
  stair: 'Stairs',
  railing: 'Railings',
  column: 'Columns',
  beam: 'Beams',
  door: 'Doors',
  window: 'Windows',
  room: 'Rooms',
  family_instance: 'Loaded families',
  placed_asset: 'Placed assets',
  mass: 'Masses',
  site: 'Site',
  reference_plane: 'Reference planes',
  text_3d: '3D text',
  sweep: 'Sweeps',
  dormer: 'Dormers',
  site_origin: 'Origins',
};

export interface Viewport3DLayersPanelProps {
  viewerCategoryHidden: Record<string, boolean>;
  onToggleCategory: (kind: ViewerHiddenKindKey) => void;
  viewerRenderStyle: ViewerRenderStyle;
  onSetRenderStyle: (style: ViewerRenderStyle) => void;
  viewerBackground: 'white' | 'light_grey' | 'dark';
  onSetBackground: (bg: 'white' | 'light_grey' | 'dark') => void;
  viewerEdges: 'normal' | 'none';
  onSetEdges: (edges: 'normal' | 'none') => void;
  viewerShadowsEnabled?: boolean;
  onSetShadowsEnabled?: (enabled: boolean) => void;
  viewerAmbientOcclusionEnabled?: boolean;
  onSetAmbientOcclusionEnabled?: (enabled: boolean) => void;
  viewerDepthCueEnabled?: boolean;
  onSetDepthCueEnabled?: (enabled: boolean) => void;
  viewerSilhouetteEdgeWidth?: ViewerEdgeWidth;
  onSetSilhouetteEdgeWidth?: (width: ViewerEdgeWidth) => void;
  viewerPhotographicExposureEv?: number;
  onSetPhotographicExposureEv?: (ev: number) => void;
  viewerProjection: 'perspective' | 'orthographic';
  onSetProjection: (projection: 'perspective' | 'orthographic') => void;
  sectionBoxActive: boolean;
  onSetSectionBoxActive: (active: boolean) => void;
  viewerWalkModeActive: boolean;
  onSetWalkModeActive: (active: boolean) => void;
  onRequestCameraAction: (kind: 'fit' | 'reset') => void;
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
  viewerShadowsEnabled,
  onSetShadowsEnabled,
  viewerAmbientOcclusionEnabled,
  onSetAmbientOcclusionEnabled,
  viewerDepthCueEnabled,
  onSetDepthCueEnabled,
  viewerSilhouetteEdgeWidth,
  onSetSilhouetteEdgeWidth,
  viewerPhotographicExposureEv,
  onSetPhotographicExposureEv,
  viewerProjection,
  onSetProjection,
  sectionBoxActive,
  onSetSectionBoxActive,
  viewerWalkModeActive,
  onSetWalkModeActive,
  onRequestCameraAction,
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
  const storedGdo = useBimStore((s) => s as typeof s & ViewerGdoRuntimeState);
  const resolvedShadowsEnabled =
    viewerShadowsEnabled ??
    storedGdo.viewerShadowsEnabled ??
    readStoredBoolean(GDO_STORAGE_KEYS.shadows, true);
  const resolvedAmbientOcclusionEnabled =
    viewerAmbientOcclusionEnabled ??
    storedGdo.viewerAmbientOcclusionEnabled ??
    readStoredBoolean(GDO_STORAGE_KEYS.ambientOcclusion, true);
  const resolvedDepthCueEnabled =
    viewerDepthCueEnabled ??
    storedGdo.viewerDepthCueEnabled ??
    readStoredBoolean(GDO_STORAGE_KEYS.depthCue, false);
  const resolvedSilhouetteEdgeWidth =
    viewerSilhouetteEdgeWidth ?? storedGdo.viewerSilhouetteEdgeWidth ?? readStoredEdgeWidth();
  const resolvedPhotographicExposureEv = normalizeExposureEv(
    viewerPhotographicExposureEv ??
      storedGdo.viewerPhotographicExposureEv ??
      readStoredExposureEv(),
  );

  const setShadowsEnabled = (enabled: boolean): void => {
    writeStoredString(GDO_STORAGE_KEYS.shadows, String(enabled));
    setViewerGdoRuntimeState({ viewerShadowsEnabled: enabled });
    onSetShadowsEnabled?.(enabled);
  };
  const setAmbientOcclusionEnabled = (enabled: boolean): void => {
    writeStoredString(GDO_STORAGE_KEYS.ambientOcclusion, String(enabled));
    setViewerGdoRuntimeState({ viewerAmbientOcclusionEnabled: enabled });
    onSetAmbientOcclusionEnabled?.(enabled);
  };
  const setDepthCueEnabled = (enabled: boolean): void => {
    writeStoredString(GDO_STORAGE_KEYS.depthCue, String(enabled));
    setViewerGdoRuntimeState({ viewerDepthCueEnabled: enabled });
    onSetDepthCueEnabled?.(enabled);
  };
  const setSilhouetteEdgeWidth = (width: ViewerEdgeWidth): void => {
    writeStoredString(GDO_STORAGE_KEYS.silhouetteEdgeWidth, String(width));
    setViewerGdoRuntimeState({ viewerSilhouetteEdgeWidth: width });
    onSetSilhouetteEdgeWidth?.(width);
  };
  const setPhotographicExposureEv = (ev: number): void => {
    const next = normalizeExposureEv(ev);
    writeStoredString(GDO_STORAGE_KEYS.photographicExposureEv, String(next));
    setViewerGdoRuntimeState({ viewerPhotographicExposureEv: next });
    onSetPhotographicExposureEv?.(next);
  };
  const iconForKind: Record<ViewerHiddenKindKey, typeof Icons.wall> = {
    wall: Icons.wall,
    floor: Icons.floor,
    roof: Icons.roof,
    ceiling: Icons.ceiling,
    stair: Icons.stair,
    railing: Icons.railing,
    column: Icons.column,
    beam: Icons.beam,
    door: Icons.door,
    window: Icons.window,
    room: Icons.room,
    family_instance: Icons.family,
    placed_asset: Icons.familyType,
    mass: Icons.assembly,
    site: Icons.grid,
    reference_plane: Icons.gridLine,
    text_3d: Icons.tag,
    sweep: Icons.wallLayer,
    dormer: Icons.roof,
    site_origin: Icons.grid,
  };
  const activeStyleLabel =
    GRAPHIC_STYLE_OPTIONS.find((option) => option.value === viewerRenderStyle)?.label ?? 'Shaded';
  const hiddenLayerCount = VIEWER_HIDDEN_KIND_KEYS.filter(
    (key) => viewerCategoryHidden[key],
  ).length;
  return (
    <div data-testid="viewport3d-layers-panel" className="flex flex-col gap-3 px-3 py-3">
      <div className="space-y-1">
        <div className="text-[10px] font-semibold uppercase text-muted">View controls</div>
        <div className="flex flex-wrap gap-1">
          <ViewStatePill label={activeStyleLabel} />
          <ViewStatePill label={viewerProjection === 'orthographic' ? 'Ortho' : 'Perspective'} />
          <ViewStatePill label={resolvedShadowsEnabled ? 'Shadows' : 'No shadows'} />
          <ViewStatePill label={`EV ${formatExposureEv(resolvedPhotographicExposureEv)}`} />
          {resolvedDepthCueEnabled ? <ViewStatePill label="Depth cue" /> : null}
          <ViewStatePill label={sectionBoxActive ? 'Section box' : 'No section box'} />
          {hiddenLayerCount > 0 ? <ViewStatePill label={`${hiddenLayerCount} hidden`} /> : null}
        </div>
      </div>

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
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-muted">
              <span>Edges</span>
              <span>Width {resolvedSilhouetteEdgeWidth}</span>
            </div>
            <div className="grid grid-cols-[1fr_1fr_92px] gap-1">
              <button
                type="button"
                onClick={() => onSetEdges('normal')}
                aria-label="On model edges"
                title="On model edges"
                data-active={viewerEdges === 'normal' ? 'true' : 'false'}
                className={[
                  'h-7 rounded border px-2 text-[11px] transition-colors',
                  viewerEdges === 'normal'
                    ? 'border-accent bg-accent/15 font-medium text-foreground'
                    : 'border-border bg-background text-muted hover:text-foreground',
                ].join(' ')}
              >
                On
              </button>
              <button
                type="button"
                onClick={() => onSetEdges('none')}
                aria-label="Off model edges"
                title="Off model edges"
                data-active={viewerEdges === 'none' ? 'true' : 'false'}
                className={[
                  'h-7 rounded border px-2 text-[11px] transition-colors',
                  viewerEdges === 'none'
                    ? 'border-accent bg-accent/15 font-medium text-foreground'
                    : 'border-border bg-background text-muted hover:text-foreground',
                ].join(' ')}
              >
                Off
              </button>
              <select
                aria-label="Silhouette edge width"
                title="Silhouette edge width"
                className="h-7 rounded border border-border bg-background px-1 text-[11px] text-foreground"
                value={resolvedSilhouetteEdgeWidth}
                onChange={(e) => setSilhouetteEdgeWidth(Number(e.target.value) as ViewerEdgeWidth)}
              >
                {[1, 2, 3, 4].map((width) => (
                  <option key={width} value={width}>
                    {width}px
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] text-muted">Lighting</div>
            <div className="grid grid-cols-2 gap-1">
              <GdoToggleButton
                label="Shadows"
                pressed={resolvedShadowsEnabled}
                onClick={() => setShadowsEnabled(!resolvedShadowsEnabled)}
              />
              <GdoToggleButton
                label="Ambient occlusion"
                pressed={resolvedAmbientOcclusionEnabled}
                onClick={() => setAmbientOcclusionEnabled(!resolvedAmbientOcclusionEnabled)}
              />
              <GdoToggleButton
                label="Depth cue"
                pressed={resolvedDepthCueEnabled}
                onClick={() => setDepthCueEnabled(!resolvedDepthCueEnabled)}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-muted">
              <span>Exposure</span>
              <span>EV {formatExposureEv(resolvedPhotographicExposureEv)}</span>
            </div>
            <input
              type="range"
              aria-label="Photographic exposure"
              title="Photographic exposure"
              min={PHOTOGRAPHIC_EXPOSURE_EV_MIN}
              max={PHOTOGRAPHIC_EXPOSURE_EV_MAX}
              step={PHOTOGRAPHIC_EXPOSURE_EV_STEP}
              value={resolvedPhotographicExposureEv}
              onChange={(e) => setPhotographicExposureEv(Number(e.target.value))}
              className="w-full accent-accent"
            />
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
        <div className="mt-2 grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => onSetWalkModeActive(!viewerWalkModeActive)}
            aria-pressed={viewerWalkModeActive}
            aria-label={viewerWalkModeActive ? 'Exit walk mode' : 'Enter walk mode'}
            title={viewerWalkModeActive ? 'Exit walk mode' : 'Enter walk mode'}
            data-active={viewerWalkModeActive ? 'true' : 'false'}
            className={[
              'flex h-8 items-center justify-center gap-1 rounded border px-1.5 text-[11px] transition-colors',
              viewerWalkModeActive
                ? 'border-accent bg-accent/15 font-medium text-foreground'
                : 'border-border bg-background text-muted hover:text-foreground',
            ].join(' ')}
          >
            <Icons.viewpoint size={ICON_SIZE.chrome} aria-hidden="true" />
            Walk
          </button>
          <button
            type="button"
            onClick={() => onRequestCameraAction('fit')}
            aria-label="Fit model to view"
            title="Fit model to view"
            className="flex h-8 items-center justify-center gap-1 rounded border border-border bg-background px-1.5 text-[11px] text-muted transition-colors hover:text-foreground"
          >
            <Icons.orbitView size={ICON_SIZE.chrome} aria-hidden="true" />
            Fit
          </button>
          <button
            type="button"
            onClick={() => onRequestCameraAction('reset')}
            aria-label="Reset camera home"
            title="Reset camera home"
            className="flex h-8 items-center justify-center gap-1 rounded border border-border bg-background px-1.5 text-[11px] text-muted transition-colors hover:text-foreground"
          >
            <Icons.viewCubeReset size={ICON_SIZE.chrome} aria-hidden="true" />
            Reset
          </button>
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
            <span>{VIEWER_LAYER_LABELS[lk]}</span>
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

function GdoToggleButton({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={`${pressed ? 'Disable' : 'Enable'} ${label}`}
      title={`${pressed ? 'Disable' : 'Enable'} ${label}`}
      data-active={pressed ? 'true' : 'false'}
      onClick={onClick}
      className={[
        'h-7 rounded border px-2 text-[11px] transition-colors',
        pressed
          ? 'border-accent bg-accent/15 font-medium text-foreground'
          : 'border-border bg-background text-muted hover:text-foreground',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function ViewStatePill({ label }: { label: string }): JSX.Element {
  return (
    <span className="rounded-pill border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted">
      {label}
    </span>
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

  if (style === 'realistic') {
    return (
      <span
        data-testid="graphic-style-preview-realistic"
        aria-hidden="true"
        className={`relative h-7 w-10 overflow-hidden rounded border ${border} bg-gradient-to-br from-sky-100 via-surface to-stone-200`}
      >
        <span className="absolute bottom-1 left-1.5 h-4 w-4 rounded-sm border border-border bg-stone-300 shadow-md" />
        <span className="absolute bottom-2 left-4 h-5 w-4 rounded-sm border border-border bg-emerald-200 shadow-sm" />
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-white shadow" />
      </span>
    );
  }

  if (style === 'ray-trace') {
    return (
      <span
        data-testid="graphic-style-preview-ray-trace"
        aria-hidden="true"
        className={`relative h-7 w-10 overflow-hidden rounded border ${border} bg-gradient-to-br from-slate-100 via-white to-sky-100`}
      >
        <span className="absolute bottom-1 left-1 h-4 w-6 rounded-sm border border-border bg-surface shadow-lg" />
        <span className="absolute bottom-4 left-5 h-px w-4 rotate-[-18deg] bg-white/90 shadow" />
        <span className="absolute bottom-1 right-1 h-1 w-7 rounded-full bg-foreground/15 blur-[1px]" />
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
