import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import type { Element } from '@bim-ai/core';

import { FieldRow, fmtMm } from './inspectorRows';
import { MaterialAssignmentRow, type OpenMaterialBrowser } from './materialInspectorSections';
import { PhaseSection } from './phaseInspectorSection';

type ColumnInspectorElement = Extract<Element, { kind: 'column' }> & {
  isNonStructural?: boolean;
};
type CuttableInspectorElement = Element & {
  cutBy?: string[];
};

const DEFAULT_GRAPHICS_OVERRIDE_COLOR = `#${'000000'}`;

function resolveElName(id: string | null | undefined, eb: Record<string, Element>): string {
  if (!id) return '—';
  const target = eb[id];
  return target ? ((target as { name?: string }).name ?? id) : id;
}

interface ColumnInspectorSectionProps {
  el: Extract<Element, { kind: 'column' }>;
  t: TFunction;
  options?: {
    onPropertyChange?: (property: string, value: unknown) => void;
  };
  elementsById: Record<string, Element>;
  onOpenMaterialBrowser?: OpenMaterialBrowser;
  onOpenAppearanceAssetBrowser?: OpenMaterialBrowser;
  onSemanticCommand?: (cmd: Record<string, unknown>) => void;
}

export function ColumnInspectorSection({
  el,
  t,
  options,
  elementsById,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
  onSemanticCommand,
}: ColumnInspectorSectionProps): JSX.Element {
  const f = (key: string) => t(`inspector.fields.${key}`);
  const { onPropertyChange: colPropChange } = options ?? {};
  return (
    <div className="flex flex-col gap-2">
      <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
      <MaterialAssignmentRow
        label="Material"
        materialKey={el.materialKey ?? null}
        fallback="By category"
        onOpenMaterialBrowser={onOpenMaterialBrowser}
        onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
      />
      <FieldRow label={f('width')} value={fmtMm(el.bMm)} />
      <FieldRow label={f('depth')} value={fmtMm(el.hMm)} />
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Height (mm)</span>
        <input
          type="number"
          className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
          defaultValue={el.heightMm}
          key={`${el.id}-height`}
          step={100}
          onBlur={(e) => colPropChange?.('heightMm', Number(e.currentTarget.value))}
          data-testid="inspector-column-height"
        />
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Usage</span>
        <select
          className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
          value={el.columnUsage ?? 'architectural'}
          onChange={(e) =>
            colPropChange?.('columnUsage', e.target.value as 'architectural' | 'structural')
          }
          data-testid="inspector-column-usage"
        >
          <option value="architectural">Architectural</option>
          <option value="structural">Structural</option>
        </select>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        <input
          data-testid="inspector-column-non-structural"
          type="checkbox"
          checked={(el as ColumnInspectorElement).isNonStructural ?? false}
          onChange={() => onSemanticCommand?.({ type: 'toggleColumnStructural', columnId: el.id })}
        />
        Non-structural (architectural)
      </label>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Rotation (°)</span>
        <input
          type="number"
          className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
          defaultValue={el.rotationDeg ?? 0}
          key={`${el.id}-rotation`}
          step={15}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (!isNaN(v)) colPropChange?.('rotationDeg', v);
          }}
          data-testid="inspector-column-rotation"
          aria-label="Column rotation in degrees"
        />
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Top Offset X (mm)</span>
        <input
          type="number"
          className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
          defaultValue={el.topOffsetXMm ?? 0}
          key={`${el.id}-top-offset-x`}
          step={100}
          onBlur={(e) => {
            const v = Number(e.currentTarget.value);
            if (!isNaN(v)) colPropChange?.('topOffsetXMm', v);
          }}
          data-testid="inspector-column-top-offset-x"
        />
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Top Offset Y (mm)</span>
        <input
          type="number"
          className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
          defaultValue={el.topOffsetYMm ?? 0}
          key={`${el.id}-top-offset-y`}
          step={100}
          onBlur={(e) => {
            const v = Number(e.currentTarget.value);
            if (!isNaN(v)) colPropChange?.('topOffsetYMm', v);
          }}
          data-testid="inspector-column-top-offset-y"
        />
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Top Constraint</span>
        <select
          className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
          value={el.topConstraintLevelId ?? ''}
          onChange={(e) => colPropChange?.('topConstraintLevelId', e.target.value || null)}
          data-testid="inspector-column-top-level"
        >
          <option value="">Unconnected</option>
          {Object.values(elementsById)
            .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
            .sort((a, b) => a.elevationMm - b.elevationMm)
            .map((lvl) => (
              <option key={lvl.id} value={lvl.id}>
                {lvl.name}
              </option>
            ))}
        </select>
      </div>
      {el.topConstraintLevelId && (
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-xs text-muted w-28 shrink-0">Top Offset (mm)</span>
          <input
            type="number"
            className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
            defaultValue={el.topConstraintOffsetMm ?? 0}
            key={`${el.id}-col-top`}
            step={1}
            min={-10000}
            max={10000}
            onBlur={(e) => colPropChange?.('topConstraintOffsetMm', Number(e.currentTarget.value))}
            data-testid="inspector-column-top-offset"
          />
        </div>
      )}
      <PhaseSection
        phaseCreated={el.phaseCreated}
        phaseDemolished={el.phaseDemolished}
        phases={Object.values(elementsById).filter(
          (e): e is Extract<Element, { kind: 'phase' }> => e.kind === 'phase',
        )}
        onPropertyChange={colPropChange}
      />
      <div className="border-t border-border pt-1.5">
        <div className="mb-1 text-xs text-muted">Graphics Override</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Fill color</span>
            <input
              type="color"
              className="h-6 w-10 cursor-pointer rounded border border-border"
              value={el.graphicsOverride?.fillColorHex ?? DEFAULT_GRAPHICS_OVERRIDE_COLOR}
              key={`${el.id}-fill-color-${el.graphicsOverride?.fillColorHex ?? 'none'}`}
              onChange={(e) =>
                colPropChange?.('graphicsOverride', {
                  ...el.graphicsOverride,
                  fillColorHex: e.target.value,
                })
              }
              data-testid="inspector-override-fill-color"
            />
            <button
              type="button"
              className="text-xs rounded border border-border px-1.5 py-0.5 text-muted hover:text-foreground"
              onClick={() =>
                colPropChange?.('graphicsOverride', {
                  ...el.graphicsOverride,
                  fillColorHex: null,
                })
              }
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Surface color</span>
            <input
              type="color"
              className="h-6 w-10 cursor-pointer rounded border border-border"
              value={el.graphicsOverride?.surfaceColorHex ?? DEFAULT_GRAPHICS_OVERRIDE_COLOR}
              key={`${el.id}-surface-color-${el.graphicsOverride?.surfaceColorHex ?? 'none'}`}
              onChange={(e) =>
                colPropChange?.('graphicsOverride', {
                  ...el.graphicsOverride,
                  surfaceColorHex: e.target.value,
                })
              }
              data-testid="inspector-override-surface-color"
            />
            <button
              type="button"
              className="text-xs rounded border border-border px-1.5 py-0.5 text-muted hover:text-foreground"
              onClick={() =>
                colPropChange?.('graphicsOverride', {
                  ...el.graphicsOverride,
                  surfaceColorHex: null,
                })
              }
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      {/* Cut geometry readout */}
      {((el as CuttableInspectorElement).cutBy?.length ?? 0) > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary
            data-testid="inspector-cut-by-summary"
            style={{ cursor: 'pointer', fontSize: 12 }}
          >
            Cut By ({(el as CuttableInspectorElement).cutBy?.length ?? 0})
          </summary>
          <div style={{ marginTop: 4 }}>
            {((el as CuttableInspectorElement).cutBy ?? []).map((cutterId, i) => (
              <div
                key={cutterId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  marginBottom: 2,
                }}
              >
                <span
                  data-testid={`inspector-cut-by-id-${i}`}
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  {cutterId.slice(-8)}
                </span>
                <button
                  data-testid={`inspector-cut-by-remove-${i}`}
                  onClick={() =>
                    onSemanticCommand?.({ type: 'removeCutGeometry', cutterId, hostId: el.id })
                  }
                  style={{ color: 'var(--color-danger)', fontSize: 11 }}
                >
                  Remove Cut
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

interface BeamInspectorSectionProps {
  el: Extract<Element, { kind: 'beam' }>;
  t: TFunction;
  options?: {
    onPropertyChange?: (property: string, value: unknown) => void;
  };
  elementsById: Record<string, Element>;
  onOpenMaterialBrowser?: OpenMaterialBrowser;
  onOpenAppearanceAssetBrowser?: OpenMaterialBrowser;
  onDispatchCommand?: (cmd: Record<string, unknown>) => void;
}

export function BeamInspectorSection({
  el,
  t,
  options,
  elementsById,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
  onDispatchCommand,
}: BeamInspectorSectionProps): JSX.Element {
  const f = (key: string) => t(`inspector.fields.${key}`);
  const { onPropertyChange: beamPropChange } = options ?? {};
  return (
    <div className="flex flex-col gap-2">
      <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
      <MaterialAssignmentRow
        label="Material"
        materialKey={el.materialKey ?? null}
        fallback="By category"
        onOpenMaterialBrowser={onOpenMaterialBrowser}
        onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
      />
      <FieldRow label="Start" value={`${fmtMm(el.startMm.xMm)} · ${fmtMm(el.startMm.yMm)}`} mono />
      <FieldRow label="End" value={`${fmtMm(el.endMm.xMm)} · ${fmtMm(el.endMm.yMm)}`} mono />
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Height (mm)</span>
        <input
          type="number"
          className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
          defaultValue={el.heightMm}
          key={`${el.id}-height`}
          step={50}
          aria-label="Beam height in millimetres"
          onBlur={(e) => {
            const v = Number(e.currentTarget.value);
            if (!isNaN(v) && v > 0) beamPropChange?.('heightMm', v);
          }}
          data-testid="inspector-beam-height"
        />
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Width (mm)</span>
        <input
          type="number"
          className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
          defaultValue={el.widthMm}
          key={`${el.id}-width`}
          step={50}
          aria-label="Beam width in millimetres"
          onBlur={(e) => {
            const v = Number(e.currentTarget.value);
            if (!isNaN(v) && v > 0) beamPropChange?.('widthMm', v);
          }}
          data-testid="inspector-beam-width"
        />
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Section Profile</span>
        <select
          className="w-32 text-xs bg-surface border border-border rounded px-1 py-0.5"
          value={el.sectionProfile ?? 'rectangular'}
          onChange={(e) => {
            beamPropChange?.('sectionProfile', e.currentTarget.value || 'rectangular');
          }}
          data-testid="inspector-beam-section-profile"
        >
          <option value="rectangular">Rectangular</option>
          <option value="I">I-Beam</option>
          <option value="H">H-Beam</option>
          <option value="C">C-Channel</option>
          <option value="L">L-Angle</option>
          <option value="T">T-Section</option>
          <option value="HSS">HSS</option>
        </select>
      </div>
      {(el.sectionProfile === 'I' || el.sectionProfile === 'H' || el.sectionProfile === 'C') && (
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-xs text-muted w-28 shrink-0">Flange Width (mm)</span>
          <input
            type="number"
            className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
            defaultValue={el.flangeWidthMm ?? el.widthMm}
            key={`${el.id}-flange-width`}
            step={10}
            onBlur={(e) => {
              const v = Number(e.currentTarget.value);
              if (!isNaN(v) && v > 0) beamPropChange?.('flangeWidthMm', v);
            }}
            data-testid="inspector-beam-flange-width"
          />
        </div>
      )}
      {(el.sectionProfile === 'I' || el.sectionProfile === 'H') && (
        <>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Web Thickness (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.webThicknessMm ?? Math.max(20, el.widthMm * 0.1)}
              key={`${el.id}-web-thickness`}
              step={5}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) beamPropChange?.('webThicknessMm', v);
              }}
              data-testid="inspector-beam-web-thickness"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Flange Thickness (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.flangeThicknessMm ?? Math.max(15, el.heightMm * 0.1)}
              key={`${el.id}-flange-thickness`}
              step={5}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) beamPropChange?.('flangeThicknessMm', v);
              }}
              data-testid="inspector-beam-flange-thickness"
            />
          </div>
        </>
      )}
      {/* §9.2 (WP-B): beamProfileType — 3D geometry profile */}
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Profile</span>
        <select
          className="w-32 text-xs bg-surface border border-border rounded px-1 py-0.5"
          value={el.beamProfileType ?? 'rectangular'}
          onChange={(e) => beamPropChange?.('beamProfileType', e.currentTarget.value)}
          data-testid="inspector-beam-profile-type"
        >
          <option value="rectangular">Rectangular</option>
          <option value="I-beam">I-Beam</option>
          <option value="H-beam">H-Beam (Wide Flange)</option>
          <option value="HSS-round">HSS Round</option>
          <option value="HSS-square">HSS Square</option>
        </select>
      </div>
      {(el.beamProfileType === 'I-beam' || el.beamProfileType === 'H-beam') && (
        <>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Flange Width (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.flangeWidthMm ?? el.widthMm}
              key={`${el.id}-bp-flange-width`}
              step={10}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) beamPropChange?.('flangeWidthMm', v);
              }}
              data-testid="inspector-beam-flange-width-bp"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Flange Thickness (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.flangeThicknessMm ?? 15}
              key={`${el.id}-bp-flange-thickness`}
              step={5}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) beamPropChange?.('flangeThicknessMm', v);
              }}
              data-testid="inspector-beam-flange-thickness-bp"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Web Thickness (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.webThicknessMm ?? 10}
              key={`${el.id}-bp-web-thickness`}
              step={5}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) beamPropChange?.('webThicknessMm', v);
              }}
              data-testid="inspector-beam-web-thickness-bp"
            />
          </div>
        </>
      )}
      {(el.beamProfileType === 'HSS-round' || el.beamProfileType === 'HSS-square') && (
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-xs text-muted w-28 shrink-0">Wall Thickness (mm)</span>
          <input
            type="number"
            className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
            defaultValue={el.wallThicknessMm ?? 8}
            key={`${el.id}-bp-wall-thickness`}
            step={1}
            onBlur={(e) => {
              const v = Number(e.currentTarget.value);
              if (!isNaN(v) && v > 0) beamPropChange?.('wallThicknessMm', v);
            }}
            data-testid="inspector-beam-wall-thickness"
          />
        </div>
      )}
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Custom Section ID</span>
        <input
          type="text"
          className="w-32 text-xs bg-surface border border-border rounded px-1 py-0.5"
          defaultValue={(el as { sectionProfileId?: string | null }).sectionProfileId ?? ''}
          key={`${el.id}-section-profile-id`}
          onBlur={(e) => {
            const profileId = e.currentTarget.value.trim() || null;
            onDispatchCommand?.({ type: 'setBeamSectionProfile', beamId: el.id, profileId });
          }}
          data-testid="inspector-beam-section-profile-id"
        />
      </div>
      <PhaseSection
        phaseCreated={el.phaseCreated}
        phaseDemolished={el.phaseDemolished}
        phases={Object.values(elementsById).filter(
          (e): e is Extract<Element, { kind: 'phase' }> => e.kind === 'phase',
        )}
        onPropertyChange={beamPropChange}
      />
    </div>
  );
}
