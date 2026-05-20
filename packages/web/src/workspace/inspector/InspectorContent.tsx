import { useState, type JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { DisciplineTag, Element, ViewTemplateControlledField } from '@bim-ai/core';

import { BUILT_IN_FAMILIES, getFamilyById, getTypeById } from '../../families/familyCatalog';
import { DEFAULT_CHECKPOINT_RETENTION_LIMIT } from '../../state/backupRetention';
import {
  planViewGraphicsMatrixRows,
  viewTemplateGraphicsMatrixRows,
} from '../../plan/planProjection';
import { roomAreaM2, roomNetAreaM2 } from '../../plan/roomArea';
import { topLayerIndex } from '../../viewport/hostMaterialLayerTargets';
import { PlanViewGraphicsMatrix } from './PlanViewGraphicsMatrix';
import { SavedViewTagGraphicsAuthoring, SavedViewTemplateGraphicsAuthoring } from '../authoring';
import { computeFloorTypeThicknessMm } from '../../tools/floorTypeThickness';
import { WallTypeLayerEditor } from '../families/WallTypeLayerEditor';
import { stairBoundaryMm } from '../../plan/stairBoundingBox';
import { FamilyInspectorSection } from './familyInspectorSections';
import {
  FaceMaterialOverridesSection,
  GenericMaterialAssignmentFor,
  MaterialAssignmentRow,
  MaterialSlotsSection,
  faceMaterialOverrideLabel,
  roofTypeTopMaterialKey,
  wallTypeExteriorMaterialKey,
  type MaterialBrowserTargetRequest,
  type OpenMaterialBrowser,
} from './materialInspectorSections';
import { ShaftSideWallsButton } from './shaftInspectorSections';
import { StairAssemblySection } from './stairAssemblyInspector';
import { FieldRow, fmtMm } from './inspectorRows';
import { LinkDxfInspectorSection } from './linkInspectorSections';
import { MepInspectorSection, fmtMepRecord } from './mepInspectorSections';
import { DetailDocumentationInspectorSection } from './detailDocumentationInspectorSections';
import { DecalInspectorSection } from './decalInspectorSection';
import { ProjectBasePointInspectorSection } from './projectBasePointInspectorSection';
import { SiteTerrainInspectorSection } from './siteTerrainInspectorSections';
import { AnnotationTagInspectorSection } from './annotationTagInspectorSections';
import { SpotAnnotationInspectorSection } from './spotAnnotationInspectorSections';
import { InteriorElevationMarkerInspectorSection } from './interiorElevationMarkerInspectorSection';
import { ModelingActionInspectorSection } from './modelingActionInspectorSections';
import { ViewReferenceInspectorSection } from './viewReferenceInspectorSections';
import {
  LeaderTextInspectorSection,
  TextNoteInspectorSection,
} from './textAnnotationInspectorSections';
import {
  AngularDimensionInspectorSection,
  ArcLengthDimensionInspectorSection,
  PermanentDimensionInspectorSection,
  RadialDimensionInspectorSection,
} from './dimensionInspectorSections';
import { FamilyTypeParameterTable, TypeLayerSummary, TypeTextInput } from './typeInspectorSections';
import { MonitorSourceRows } from './monitorSourceRows';
import { PhaseSection } from './phaseInspectorSection';
import { FloorNewTypeRow } from './floorTypeInspectorSections';
import { WallPartsPanel } from './wallPartsPanel';
import { FloorInspectorSection, WallInspectorSection } from './wallFloorInspectorSections';

export type { MaterialBrowserTargetRequest } from './materialInspectorSections';
export { FieldRow } from './inspectorRows';

/**
 * Inspector parameter renderers — spec §13.
 *
 * Read-only field panels per element kind. The Apply / Reset footer is
 * left to the controlling Inspector component (which only shows it when
 * dirty=true). Numeric writes through the engine command pipeline land
 * separately when the redesigned palette gains drawing flow.
 */

/**
 * DSC-V3-01 — reusable discipline tag picker row.
 *
 * Renders a labelled `<select>` with arch / struct / mep options plus a
 * "Default for kind" sentinel (value=""). Fires `onChange` with the new
 * value on every change (null when "Default for kind" is selected); the
 * caller is responsible for forwarding the value to the engine command
 * `setElementDiscipline`. A null discipline in the engine resolves to
 * DEFAULT_DISCIPLINE_BY_KIND[element.kind].
 */
export function InspectorDisciplineDropdown({
  value,
  onChange,
}: {
  value: DisciplineTag | null | undefined;
  onChange: (discipline: DisciplineTag | null) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs text-muted w-28 shrink-0">
        {t('inspector.fields.discipline', 'Discipline')}
      </span>
      <select
        aria-label={t('inspector.fields.discipline', 'Discipline')}
        className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : (v as DisciplineTag));
        }}
      >
        <option value="">{t('discipline.default', 'Default for kind')}</option>
        <option value="arch">{t('discipline.arch', 'Architecture')}</option>
        <option value="struct">{t('discipline.struct', 'Structure')}</option>
        <option value="mep">{t('discipline.mep', 'MEP')}</option>
      </select>
    </div>
  );
}

/** Look up a human-readable name for an element ID, falling back to the raw ID. */
function resolveElName(id: string | null | undefined, eb: Record<string, Element>): string {
  if (!id) return '—';
  const e = eb[id];
  if (!e) return id;
  return 'name' in e && typeof (e as { name?: unknown }).name === 'string'
    ? ((e as { name: string }).name ?? id)
    : id;
}

export function InspectorPropertiesFor(
  el: Element,
  t: TFunction,
  options?: {
    elementsById?: Record<string, Element>;
    onPropertyChange?: (property: string, value: unknown) => void;
    onMonitorReconcile?: (elementId: string, mode: 'accept_source' | 'keep_host') => void;
    onDisciplineChange?: (discipline: DisciplineTag | null) => void;
    onEditType?: (typeId: string) => void;
    onEditBoundary?: (element: Extract<Element, { kind: 'floor' | 'roof' | 'ceiling' }>) => void;
    onOpenMaterialBrowser?: OpenMaterialBrowser;
    onOpenAppearanceAssetBrowser?: OpenMaterialBrowser;
    onEditCurtainGrid?: (wallId: string) => void;
    onDispatchCommand?: (cmd: Record<string, unknown>) => void;
  },
): JSX.Element {
  const elementsById = options?.elementsById ?? {};
  const onMonitorReconcile = options?.onMonitorReconcile;
  const onDisciplineChange = options?.onDisciplineChange;
  const onEditType = options?.onEditType;
  const onOpenMaterialBrowser = options?.onOpenMaterialBrowser;
  const onOpenAppearanceAssetBrowser = options?.onOpenAppearanceAssetBrowser;
  const onEditCurtainGrid = options?.onEditCurtainGrid;
  const onDispatchCommand = options?.onDispatchCommand;
  const onSemanticCommand = onDispatchCommand;
  const f = (key: string) => t(`inspector.fields.${key}`);
  switch (el.kind) {
    case 'wall':
      return (
        <WallInspectorSection
          el={el}
          t={t}
          options={options}
          elementsById={elementsById}
          onDisciplineChange={onDisciplineChange}
          onEditType={onEditType}
          onOpenMaterialBrowser={onOpenMaterialBrowser}
          onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          onEditCurtainGrid={onEditCurtainGrid}
          onDispatchCommand={onDispatchCommand}
        />
      );
    case 'door':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('family')} value={el.familyTypeId ?? 'Generic 900 × 2100'} mono />
          <MaterialAssignmentRow
            label="Material"
            materialKey={el.materialKey ?? null}
            fallback="By family/category"
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
          <MaterialSlotsSection
            elementId={el.id}
            slots={el.materialSlots}
            rows={[
              { slot: 'frame', label: 'Frame' },
              { slot: 'panel', label: 'Panel' },
              { slot: 'hardware', label: 'Hardware' },
              { slot: 'threshold', label: 'Threshold' },
            ]}
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('wall')} value={resolveElName(el.wallId, elementsById)} />
          <FieldRow label={f('alongT')} value={el.alongT.toFixed(3)} mono />
        </div>
      );
    case 'window':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('family')} value={el.familyTypeId ?? 'Generic 1200 × 1500'} mono />
          <MaterialAssignmentRow
            label="Material"
            materialKey={el.materialKey ?? null}
            fallback="By family/category"
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
          <MaterialSlotsSection
            elementId={el.id}
            slots={el.materialSlots}
            rows={[
              { slot: 'frame', label: 'Frame' },
              { slot: 'sash', label: 'Sash' },
              { slot: 'glass', label: 'Glass', fallback: 'Default clear glass' },
              { slot: 'spacer', label: 'Spacer' },
              { slot: 'hardware', label: 'Hardware' },
              { slot: 'shading', label: 'Shading' },
            ]}
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
          <FieldRow label={f('sillHeight')} value={fmtMm(el.sillHeightMm)} />
          <FieldRow label={f('wall')} value={resolveElName(el.wallId, elementsById)} />
        </div>
      );
    case 'floor':
      return (
        <FloorInspectorSection
          el={el}
          t={t}
          options={options}
          elementsById={elementsById}
          onDisciplineChange={onDisciplineChange}
          onEditType={onEditType}
          onOpenMaterialBrowser={onOpenMaterialBrowser}
          onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          onDispatchCommand={onDispatchCommand}
        />
      );
    case 'roof': {
      const { elementsById: roofElementsById = {}, onPropertyChange: roofOnPropertyChange } =
        options ?? {};
      const roofTypeMaterialKey = roofTypeTopMaterialKey(el, roofElementsById);
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('slope')} value={`${(el.slopeDeg ?? 0).toFixed(1)}°`} />
          <FieldRow label={f('overhang')} value={fmtMm(el.overhangMm)} />
          <FieldRow
            label={f('referenceLevel')}
            value={resolveElName(el.referenceLevelId, elementsById)}
          />
          <FieldRow label={f('footprintPoints')} value={String(el.footprintMm.length)} />
          {options?.onEditBoundary ? (
            <div
              className="flex items-center justify-between gap-2 rounded border border-border bg-surface px-2 py-1.5"
              data-testid="inspector-roof-boundary-actions"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground">Footprint</div>
                <div className="text-[10px] text-muted">Plan vertex grips</div>
              </div>
              <button
                type="button"
                data-testid="inspector-roof-edit-boundary"
                className="shrink-0 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-surface-strong"
                onClick={() => options.onEditBoundary?.(el)}
              >
                Edit Boundary
              </button>
            </div>
          ) : null}

          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">{f('roofType')}</span>
            <select
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.roofTypeId ?? ''}
              onChange={(e2) => roofOnPropertyChange?.('roofTypeId', e2.target.value || null)}
            >
              <option value="">— None —</option>
              {Object.values(roofElementsById)
                .filter((e): e is Extract<Element, { kind: 'roof_type' }> => e.kind === 'roof_type')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            {el.roofTypeId && onEditType ? (
              <button
                type="button"
                data-testid="inspector-edit-type"
                className="shrink-0 rounded border border-border px-2 py-0.5 text-xs text-muted hover:text-foreground"
                onClick={() => onEditType(el.roofTypeId!)}
              >
                Edit Type
              </button>
            ) : null}
          </div>
          {el.roofTypeId ? (
            <MaterialAssignmentRow
              label="Type Top Material"
              materialKey={roofTypeMaterialKey}
              fallback="By type"
              elementsById={roofElementsById}
              onOpenMaterialBrowser={
                roofElementsById[el.roofTypeId]?.kind === 'roof_type'
                  ? onOpenMaterialBrowser
                  : undefined
              }
              onOpenAppearanceAssetBrowser={
                roofElementsById[el.roofTypeId]?.kind === 'roof_type'
                  ? onOpenAppearanceAssetBrowser
                  : undefined
              }
            />
          ) : (
            <MaterialAssignmentRow
              label="Instance Material"
              materialKey={el.materialKey ?? null}
              fallback="By category"
              elementsById={roofElementsById}
              onOpenMaterialBrowser={onOpenMaterialBrowser}
              onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
            />
          )}
          {onDisciplineChange ? (
            <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
          ) : null}
          <PhaseSection
            phaseCreated={el.phaseCreated}
            phaseDemolished={el.phaseDemolished}
            phases={Object.values(roofElementsById).filter(
              (e): e is Extract<Element, { kind: 'phase' }> => e.kind === 'phase',
            )}
            onPropertyChange={roofOnPropertyChange}
          />
          <FaceMaterialOverridesSection
            elementId={el.id}
            overrides={el.faceMaterialOverrides}
            elementsById={elementsById}
            onDispatchCommand={onDispatchCommand}
          />
          <div className="border-t border-border pt-1.5">
            <div className="mb-1 text-xs font-semibold text-foreground">Slope Arrow</div>
            <div className="flex flex-col gap-1">
              <label
                data-testid="inspector-roof-use-slope-arrow"
                className="flex items-center gap-2 py-0.5 text-xs text-foreground cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={el.useSlopeArrow ?? false}
                  onChange={(e) => roofOnPropertyChange?.('useSlopeArrow', e.currentTarget.checked)}
                />
                Use Slope Arrow
              </label>
              {el.useSlopeArrow && el.slopeArrow ? (
                <div className="flex items-center gap-2 py-0.5">
                  <span className="text-xs text-muted w-28 shrink-0">Slope %</span>
                  <input
                    type="number"
                    className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                    data-testid="inspector-roof-slope-pct"
                    defaultValue={(el.slopeArrow.slopeRatio * 100).toFixed(0)}
                    key={`${el.id}-slope-pct`}
                    step={1}
                    min={0}
                    onBlur={(e) =>
                      roofOnPropertyChange?.('slopeArrow', {
                        ...el.slopeArrow,
                        slopeRatio: Number(e.currentTarget.value) / 100,
                      })
                    }
                  />
                  <span className="text-xs text-muted">%</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      );
    }
    case 'conical_roof': {
      const { onPropertyChange: conicalPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Level" value={resolveElName(el.levelId, elementsById)} />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Base Radius (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.baseRadiusMm}
              key={`${el.id}-radius`}
              step={100}
              min={100}
              onBlur={(e) => conicalPropChange?.('baseRadiusMm', Number(e.currentTarget.value))}
              data-testid="inspector-conical-roof-radius"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Height (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.heightMm}
              key={`${el.id}-height`}
              step={100}
              min={100}
              onBlur={(e) => conicalPropChange?.('heightMm', Number(e.currentTarget.value))}
              data-testid="inspector-conical-roof-height"
            />
          </div>
          <MaterialAssignmentRow
            label="Material"
            materialKey={el.materialId ?? null}
            fallback="By category"
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
        </div>
      );
    }
    case 'dome_roof': {
      const { onPropertyChange: domePropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Level" value={resolveElName(el.levelId, elementsById)} />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Base Radius (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.baseRadiusMm}
              key={`${el.id}-radius`}
              step={100}
              min={100}
              onBlur={(e) => domePropChange?.('baseRadiusMm', Number(e.currentTarget.value))}
              data-testid="inspector-dome-roof-radius"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Rise Ratio</span>
            <input
              type="range"
              className="flex-1"
              min={0.1}
              max={1.0}
              step={0.01}
              defaultValue={el.riseRatio}
              key={`${el.id}-rise`}
              onBlur={(e) => domePropChange?.('riseRatio', Number(e.currentTarget.value))}
              data-testid="inspector-dome-roof-rise-ratio"
            />
            <span className="text-xs text-muted w-10 text-right">
              {(el.riseRatio ?? 0.5).toFixed(2)}
            </span>
          </div>
          <MaterialAssignmentRow
            label="Material"
            materialKey={el.materialId ?? null}
            fallback="By category"
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
        </div>
      );
    }
    case 'spire_roof': {
      const { onPropertyChange: spirePropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Level" value={resolveElName(el.levelId, elementsById)} />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Base Radius (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.baseRadiusMm}
              key={`${el.id}-radius`}
              step={100}
              min={100}
              onBlur={(e) => spirePropChange?.('baseRadiusMm', Number(e.currentTarget.value))}
              data-testid="inspector-spire-roof-radius"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Height (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.heightMm}
              key={`${el.id}-height`}
              step={500}
              min={100}
              onBlur={(e) => spirePropChange?.('heightMm', Number(e.currentTarget.value))}
              data-testid="inspector-spire-roof-height"
            />
          </div>
          <MaterialAssignmentRow
            label="Material"
            materialKey={el.materialId ?? null}
            fallback="By category"
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
        </div>
      );
    }
    case 'family_extrusion':
    case 'family_blend':
    case 'family_sweep':
    case 'family_swept_blend':
    case 'family_opening_cut':
    case 'family_component':
    case 'family_definition':
    case 'family_parameter':
    case 'family_constraint':
    case 'family_reference_plane':
      return <FamilyInspectorSection el={el} options={options} />;
    case 'stair': {
      const { onPropertyChange: stairPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Width (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.widthMm}
              key={`${el.id}-width`}
              step={100}
              aria-label="Stair width in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) stairPropChange?.('widthMm', v);
              }}
              data-testid="inspector-stair-width"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Riser (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.riserMm}
              key={`${el.id}-riser`}
              step={10}
              aria-label="Stair riser height in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) stairPropChange?.('riserMm', v);
              }}
              data-testid="inspector-stair-riser"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Tread (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.treadMm}
              key={`${el.id}-tread`}
              step={10}
              aria-label="Stair tread depth in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) stairPropChange?.('treadMm', v);
              }}
              data-testid="inspector-stair-tread"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Riser Count</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.riserCount ?? undefined}
              key={`${el.id}-riser-count`}
              step={1}
              min={2}
              max={50}
              aria-label="Number of risers per run"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v >= 2 && v <= 50) stairPropChange?.('riserCount', v);
              }}
              data-testid="inspector-stair-riser-count"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Tread Depth (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.treadDepthMm ?? undefined}
              key={`${el.id}-tread-depth`}
              step={10}
              min={200}
              max={450}
              aria-label="Tread depth in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v >= 200 && v <= 450) stairPropChange?.('treadDepthMm', v);
              }}
              data-testid="inspector-stair-tread-depth"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Run Width (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.runWidthMm ?? el.widthMm}
              key={`${el.id}-run-width`}
              step={100}
              min={600}
              aria-label="Run width in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v >= 600) stairPropChange?.('runWidthMm', v);
              }}
              data-testid="inspector-stair-run-width"
            />
          </div>
          {(el.runs?.length ?? 0) >= 2 && (
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-xs text-muted w-28 shrink-0">Landing Depth (mm)</span>
              <input
                type="number"
                className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                defaultValue={el.landingDepthMm ?? 1200}
                key={`${el.id}-landing-depth`}
                step={100}
                min={600}
                aria-label="Landing depth in millimetres"
                onBlur={(e) => {
                  const v = Number(e.currentTarget.value);
                  if (!isNaN(v) && v >= 600) stairPropChange?.('landingDepthMm', v);
                }}
                data-testid="inspector-stair-landing-depth"
              />
            </div>
          )}
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Total Height (mm)</span>
            <span className="text-xs text-foreground" data-testid="inspector-stair-total-height">
              {el.totalHeightMm ?? (el.riserCount ?? 0) * (el.riserHeightMm ?? el.riserMm ?? 175)}
            </span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Riser Height (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.riserHeightMm ?? el.riserMm}
              key={`${el.id}-riser-height`}
              step={5}
              min={100}
              max={220}
              aria-label="Riser height in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v >= 100 && v <= 220) stairPropChange?.('riserHeightMm', v);
              }}
              data-testid="inspector-stair-riser-height"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Multi-storey</span>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border border-border"
              defaultChecked={el.multiStorey ?? false}
              key={`${el.id}-multi-storey`}
              aria-label="Multi-storey stair"
              onChange={(e) => stairPropChange?.('multiStorey', e.currentTarget.checked)}
              data-testid="inspector-stair-multi-storey"
            />
          </div>
          <FieldRow label={f('baseLevel')} value={resolveElName(el.baseLevelId, elementsById)} />
          <FieldRow label={f('topLevel')} value={resolveElName(el.topLevelId, elementsById)} />
          <MaterialSlotsSection
            elementId={el.id}
            slots={el.materialSlots}
            rows={[
              { slot: 'tread', label: 'Tread' },
              { slot: 'riser', label: 'Riser' },
              { slot: 'stringer', label: 'Stringer' },
              { slot: 'landing', label: 'Landing' },
              { slot: 'support', label: 'Support' },
              { slot: 'nosing', label: 'Nosing' },
            ]}
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
          <div className="flex flex-col gap-1 pt-1">
            <button
              type="button"
              data-testid="inspector-stair-create-opening"
              className="self-start text-xs border border-border rounded px-2 py-0.5 hover:bg-surface-strong"
              onClick={() => {
                const boundaryMm = stairBoundaryMm(el);
                onDispatchCommand?.({
                  type: 'create_shaft',
                  id: crypto.randomUUID(),
                  boundaryMm,
                  baseLevelId: el.baseLevelId,
                  topLevelId: el.topLevelId,
                });
              }}
            >
              Create Floor Opening
            </button>
            <p className="text-xs text-muted">
              Creates a shaft opening through the floor(s) above this stair.
            </p>
          </div>
          <div className="border-t border-border pt-1.5">
            <div className="mb-1 text-xs text-muted">Shaft Opening</div>
            {el.linkedShaftId ? (
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-foreground">Auto-created shaft</span>
                <span className="font-mono text-[10px] text-muted">
                  {el.linkedShaftId.slice(0, 8)}
                </span>
              </div>
            ) : (
              <button
                type="button"
                data-testid="inspector-stair-create-shaft"
                className="text-xs rounded border border-border px-2 py-0.5 text-muted hover:text-foreground"
                onClick={() =>
                  onDispatchCommand?.({ type: 'inspector_create_shaft_for_stair', stairId: el.id })
                }
              >
                Create Shaft Opening
              </button>
            )}
          </div>
          {onDisciplineChange ? (
            <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
          ) : null}
          {/* §8.6.4 stair edit mode panel */}
          <div style={{ marginTop: 8, borderTop: '1px solid #ddd', paddingTop: 8 }}>
            {(el as any).editStairActive ? (
              <>
                <strong data-testid="inspector-stair-edit-mode-active">Edit Mode</strong>
                {(
                  (el as any).runs ?? [
                    {
                      runIndex: 0,
                      riserCount: (el as any).riserCount ?? 10,
                      runWidthMm: (el as any).runWidthMm ?? 1200,
                    },
                  ]
                ).map((run: any) => (
                  <div
                    key={run.runIndex}
                    data-testid={`inspector-stair-run-${run.runIndex}`}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}
                  >
                    <span>Run {run.runIndex + 1}</span>
                    <label>
                      Risers
                      <input
                        type="number"
                        data-testid={`inspector-stair-run-risers-${run.runIndex}`}
                        value={run.riserCount}
                        min={1}
                        onChange={(e) =>
                          void onDispatchCommand?.({
                            type: 'updateStairRun',
                            stairId: el.id,
                            runIndex: run.runIndex,
                            riserCount: +e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Width (mm)
                      <input
                        type="number"
                        data-testid={`inspector-stair-run-width-${run.runIndex}`}
                        value={run.runWidthMm}
                        min={600}
                        onChange={(e) =>
                          void onDispatchCommand?.({
                            type: 'updateStairRun',
                            stairId: el.id,
                            runIndex: run.runIndex,
                            runWidthMm: +e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
                <button
                  data-testid="inspector-stair-finish-edit-btn"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    void onDispatchCommand?.({ type: 'exitStairEditMode', stairId: el.id })
                  }
                >
                  Finish Editing
                </button>
              </>
            ) : (
              <button
                data-testid="inspector-stair-edit-btn"
                onClick={() =>
                  void onDispatchCommand?.({ type: 'enterStairEditMode', stairId: el.id })
                }
              >
                Edit Stair
              </button>
            )}
          </div>
          {/* §8.6.2: Stair Assembly — list linked run/landing components */}
          <StairAssemblySection
            stairId={el.id}
            elementsById={elementsById}
            onSemanticCommand={onDispatchCommand as any}
          />
        </div>
      );
    }
    case 'stair_run': {
      const stairRunEl = el as Extract<Element, { kind: 'stair_run' }>;
      const { onPropertyChange: srPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Run Width (mm)</span>
            <input
              type="number"
              data-testid="inspector-stair-run-width"
              className="inspector-input"
              value={stairRunEl.runWidthMm}
              onChange={(e) => srPropChange?.('runWidthMm', +e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Riser Count</span>
            <input
              type="number"
              data-testid="inspector-stair-run-risers"
              className="inspector-input"
              value={stairRunEl.riserCount}
              onChange={(e) => srPropChange?.('riserCount', +e.target.value)}
            />
          </div>
          <span data-testid="inspector-stair-run-index" className="text-xs text-muted">
            Run {stairRunEl.runIndex + 1}
          </span>
        </div>
      );
    }
    case 'stair_landing': {
      const stairLandingEl = el as Extract<Element, { kind: 'stair_landing' }>;
      const { onPropertyChange: slPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Elevation (mm)</span>
            <input
              type="number"
              data-testid="inspector-stair-landing-elevation"
              className="inspector-input"
              value={stairLandingEl.elevationMm}
              onChange={(e) => slPropChange?.('elevationMm', +e.target.value)}
            />
          </div>
          <span data-testid="inspector-stair-landing-points" className="text-xs text-muted">
            {stairLandingEl.perimeterMm.length} boundary points
          </span>
        </div>
      );
    }
    case 'ramp': {
      const { onPropertyChange: rampPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Width (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.widthMm}
              key={`${el.id}-width`}
              step={100}
              aria-label="Ramp width in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) rampPropChange?.('widthMm', v);
              }}
              data-testid="inspector-ramp-width"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Slope (%)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.slopePercent}
              key={`${el.id}-slope`}
              step={0.5}
              min={0.5}
              max={20}
              aria-label="Ramp slope percentage"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) rampPropChange?.('slopePercent', v);
              }}
              data-testid="inspector-ramp-slope"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Railing Left</span>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border border-border"
              defaultChecked={el.hasRailingLeft}
              key={`${el.id}-railing-left`}
              aria-label="Ramp railing on left side"
              onChange={(e) => rampPropChange?.('hasRailingLeft', e.currentTarget.checked)}
              data-testid="inspector-ramp-handrails"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Railing Right</span>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border border-border"
              defaultChecked={el.hasRailingRight}
              key={`${el.id}-railing-right`}
              aria-label="Ramp railing on right side"
              onChange={(e) => rampPropChange?.('hasRailingRight', e.currentTarget.checked)}
            />
          </div>
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
        </div>
      );
    }
    case 'column': {
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
              checked={(el as any).isNonStructural ?? false}
              onChange={() =>
                onSemanticCommand?.({ type: 'toggleColumnStructural', columnId: el.id })
              }
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
                onBlur={(e) =>
                  colPropChange?.('topConstraintOffsetMm', Number(e.currentTarget.value))
                }
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
                  // eslint-disable-next-line bim-ai/no-hex-in-chrome
                  value={el.graphicsOverride?.fillColorHex ?? '#000000'}
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
                  // eslint-disable-next-line bim-ai/no-hex-in-chrome
                  value={el.graphicsOverride?.surfaceColorHex ?? '#000000'}
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
          {(el as any).cutBy?.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary
                data-testid="inspector-cut-by-summary"
                style={{ cursor: 'pointer', fontSize: 12 }}
              >
                Cut By ({(el as any).cutBy.length})
              </summary>
              <div style={{ marginTop: 4 }}>
                {(el as any).cutBy.map((cutterId: string, i: number) => (
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
                    <span data-testid={`inspector-cut-by-id-${i}`} style={{ color: '#aaa' }}>
                      {cutterId.slice(-8)}
                    </span>
                    <button
                      data-testid={`inspector-cut-by-remove-${i}`}
                      onClick={() =>
                        onSemanticCommand?.({ type: 'removeCutGeometry', cutterId, hostId: el.id })
                      }
                      style={{ color: '#f87171', fontSize: 11 }}
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
    case 'beam': {
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
          <FieldRow
            label="Start"
            value={`${fmtMm(el.startMm.xMm)} · ${fmtMm(el.startMm.yMm)}`}
            mono
          />
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
          {(el.sectionProfile === 'I' ||
            el.sectionProfile === 'H' ||
            el.sectionProfile === 'C') && (
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
    case 'steel_connection': {
      const { onPropertyChange: scPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Connection Type</span>
            <select
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.connectionType}
              onChange={(e) => scPropChange?.('connectionType', e.currentTarget.value)}
              data-testid="inspector-steel-connection-type"
            >
              <option value="end_plate">End Plate</option>
              <option value="bolted_flange">Bolted Flange</option>
              <option value="shear_tab">Shear Tab</option>
            </select>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Plate Width (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.plateSizeMm?.width ?? 150}
              key={`${el.id}-plate-w`}
              step={10}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) {
                  scPropChange?.('plateSizeMm', {
                    ...(el.plateSizeMm ?? { width: 150, height: 200, thickness: 10 }),
                    width: v,
                  });
                }
              }}
              data-testid="inspector-steel-plate-width"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Plate Height (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.plateSizeMm?.height ?? 200}
              key={`${el.id}-plate-h`}
              step={10}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) {
                  scPropChange?.('plateSizeMm', {
                    ...(el.plateSizeMm ?? { width: 150, height: 200, thickness: 10 }),
                    height: v,
                  });
                }
              }}
              data-testid="inspector-steel-plate-height"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Bolt Rows</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.boltRows ?? 2}
              key={`${el.id}-bolt-rows`}
              min={1}
              max={8}
              step={1}
              onBlur={(e) => {
                const v = Math.round(Number(e.currentTarget.value));
                if (!isNaN(v) && v >= 1 && v <= 8) scPropChange?.('boltRows', v);
              }}
              data-testid="inspector-steel-bolt-rows"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Bolt Columns</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.boltCols ?? 2}
              key={`${el.id}-bolt-cols`}
              min={1}
              max={8}
              step={1}
              onBlur={(e) => {
                const v = Math.round(Number(e.currentTarget.value));
                if (!isNaN(v) && v >= 1 && v <= 8) scPropChange?.('boltCols', v);
              }}
              data-testid="inspector-steel-bolt-cols"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Bolt Diameter (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.boltDiameterMm ?? 20}
              key={`${el.id}-bolt-diam`}
              step={2}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) scPropChange?.('boltDiameterMm', v);
              }}
              data-testid="inspector-steel-bolt-diameter"
            />
          </div>
          <FieldRow label="Host Element" value={el.hostElementId} mono />
        </div>
      );
    }
    case 'beam_system': {
      const { onPropertyChange: bsPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <div data-testid="inspector-beam-level">
            <FieldRow label="Level" value={resolveElName(el.levelId, elementsById)} />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Spacing (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.spacingMm}
              key={`${el.id}-spacing`}
              step={100}
              min={100}
              aria-label="Beam system spacing in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) bsPropChange?.('spacingMm', v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = Number(e.currentTarget.value);
                  if (!isNaN(v) && v > 0) bsPropChange?.('spacingMm', v);
                }
              }}
              data-testid="inspector-beam-spacing"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Direction (°)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.directionDeg}
              key={`${el.id}-direction`}
              step={1}
              min={0}
              max={359}
              aria-label="Beam system direction in degrees"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v)) bsPropChange?.('directionDeg', v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = Number(e.currentTarget.value);
                  if (!isNaN(v)) bsPropChange?.('directionDeg', v);
                }
              }}
              data-testid="inspector-beam-direction"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Beam Count</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.beamCount ?? ''}
              key={`${el.id}-count`}
              step={1}
              min={1}
              placeholder="—"
              aria-label="Beam count override"
              onBlur={(e) => {
                const raw = e.currentTarget.value;
                bsPropChange?.('beamCount', raw === '' ? null : Number(raw));
              }}
              data-testid="inspector-beam-count"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Justification</span>
            <select
              className="w-32 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.justification ?? 'center'}
              onChange={(e) => bsPropChange?.('justification', e.currentTarget.value || null)}
              data-testid="inspector-beam-justification"
            >
              <option value="beginning">Beginning</option>
              <option value="center">Center</option>
              <option value="end">End</option>
            </select>
          </div>
        </div>
      );
    }
    case 'room': {
      const roomColumns = Object.values(elementsById).filter(
        (e): e is Extract<Element, { kind: 'column' }> => e.kind === 'column',
      );
      const grossAreaM2 = roomAreaM2(el.outlineMm);
      const netAreaM2 = roomNetAreaM2(el.outlineMm, roomColumns);
      return (
        <div>
          <FieldRow label={f('programme')} value={el.programmeCode ?? '—'} />
          <FieldRow label={f('department')} value={el.department ?? '—'} />
          <FieldRow label={f('function')} value={el.functionLabel ?? '—'} />
          <FieldRow label={f('finishSet')} value={el.finishSet ?? '—'} />
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <FieldRow label={f('outlinePoints')} value={String(el.outlineMm.length)} />
          <div className="flex items-center gap-2 py-0.5" data-testid="inspector-room-gross-area">
            <span className="text-xs text-muted w-28 shrink-0">Gross Area</span>
            <span className="text-xs">{grossAreaM2.toFixed(2)} m²</span>
          </div>
          <div className="flex items-center gap-2 py-0.5" data-testid="inspector-room-net-area">
            <span className="text-xs text-muted w-28 shrink-0">Net Area</span>
            <span className="text-xs">{netAreaM2.toFixed(2)} m²</span>
          </div>
          {el.upperLimitLevelId ? (
            <FieldRow
              label={f('upperLimit')}
              value={resolveElName(el.upperLimitLevelId, elementsById)}
            />
          ) : null}
          {el.volumeM3 != null ? (
            <FieldRow label={f('volume')} value={`${el.volumeM3.toFixed(3)} m³`} />
          ) : null}
          <FieldRow label="Ventilation Zone" value={el.ventilationZone ?? '—'} />
          <FieldRow label="Heating/Cooling Zone" value={el.heatingCoolingZone ?? '—'} />
          <FieldRow
            label="Design ACH"
            value={
              el.designAirChangeRate != null ? `${el.designAirChangeRate.toFixed(2)} 1/h` : '—'
            }
          />
          <FieldRow
            label="Fixture/Equipment Loads"
            value={fmtMepRecord(el.fixtureEquipmentLoads)}
          />
          <FieldRow label="Electrical Loads" value={fmtMepRecord(el.electricalLoadSummary)} />
          <FieldRow
            label="Service Requirements"
            value={el.serviceRequirements?.join(', ') || '—'}
          />
        </div>
      );
    }
    case 'duct':
    case 'pipe':
    case 'cable_tray':
    case 'mep_equipment':
    case 'fixture':
    case 'mep_terminal':
    case 'mep_opening_request':
      return (
        <MepInspectorSection
          el={el}
          f={f}
          resolveName={(id) => resolveElName(id ?? null, elementsById)}
        />
      );
    case 'level': {
      const { onPropertyChange: lvlPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Elevation (mm)</span>
            <input
              type="number"
              className="w-24 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.elevationMm}
              key={`${el.id}-elev`}
              step={100}
              aria-label="Level elevation in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v)) lvlPropChange?.('elevationMm', v);
              }}
              data-testid="inspector-level-elevation"
            />
          </div>
          <FieldRow label={f('datumKind')} value={el.datumKind ?? '—'} mono />
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
          <MonitorSourceRows
            el={el}
            elementsById={elementsById}
            t={t}
            onMonitorReconcile={onMonitorReconcile}
          />
        </div>
      );
    }
    case 'area': {
      const { onPropertyChange: areaPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <label className={LABEL_CLS}>
            <span>Area Scheme</span>
            <select
              className={INPUT_CLS}
              value={el.areaScheme ?? 'gross_building'}
              onChange={(e) => areaPropChange?.('areaScheme', e.target.value)}
              data-testid="inspector-area-scheme"
            >
              <option value="gross_building">Gross Building</option>
              <option value="net">Net</option>
              <option value="rentable">Rentable</option>
            </select>
          </label>
          <FieldRow
            label="Rule Set"
            value={el.ruleSet === 'gross' ? 'Gross' : el.ruleSet === 'net' ? 'Net' : 'No Rules'}
          />
          {el.computedAreaSqMm !== undefined ? (
            <FieldRow
              label="Area"
              value={`${(el.computedAreaSqMm / 1_000_000).toFixed(2)} m²`}
              mono
            />
          ) : null}
          <FieldRow label="Boundary Vertices" value={String(el.boundaryMm.length)} mono />
        </div>
      );
    }
    case 'dimension': {
      const distMm = Math.hypot(el.bMm.xMm - el.aMm.xMm, el.bMm.yMm - el.aMm.yMm);
      const { onPropertyChange: dimPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <FieldRow
            label="Measured"
            value={`${(distMm / 1000).toFixed(3)} m (${Math.round(distMm)} mm)`}
            mono
          />
          <FieldRow label="Point A" value={`${fmtMm(el.aMm.xMm)} · ${fmtMm(el.aMm.yMm)}`} mono />
          <FieldRow label="Point B" value={`${fmtMm(el.bMm.xMm)} · ${fmtMm(el.bMm.yMm)}`} mono />
          {el.autoGenerated ? <FieldRow label="Auto-generated" value="Yes" /> : null}
          <div className="flex items-center gap-2 border-t border-border pt-2">
            <span className="w-20 shrink-0 text-xs text-muted">Binding</span>
            <div
              role="radiogroup"
              aria-label="Dimension binding state"
              className="flex rounded border border-border bg-surface-strong p-0.5 text-xs"
            >
              {(['linked', 'partial', 'unlinked'] as const).map((state) => {
                const active = (el.state ?? 'unlinked') === state;
                return (
                  <button
                    key={state}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`dimension-state-${state}`}
                    className={[
                      'rounded px-2 py-0.5 capitalize',
                      active
                        ? state === 'unlinked'
                          ? 'bg-drift text-background'
                          : 'bg-accent text-accent-foreground'
                        : 'text-muted hover:text-foreground',
                    ].join(' ')}
                    onClick={() => dimPropChange?.('state', state)}
                  >
                    {state}
                  </button>
                );
              })}
            </div>
          </div>
          {/* F-088 + ANN-11 — text label offset + text decoration inputs */}
          {dimPropChange ? (
            <>
              <div className="flex flex-col gap-1 border-t border-border pt-2">
                <span className="text-xs font-medium text-muted">Text label offset</span>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted">X offset (mm)</span>
                  <input
                    type="number"
                    className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                    defaultValue={el.textOffsetMm?.xMm ?? 0}
                    key={`${el.id}-text-x`}
                    step={10}
                    aria-label="Dimension text label X offset in millimetres"
                    data-testid="dimension-text-offset-x"
                    onBlur={(e) => {
                      const xMm = Number(e.currentTarget.value);
                      if (!isNaN(xMm)) {
                        dimPropChange('textOffsetMm', { xMm, yMm: el.textOffsetMm?.yMm ?? 0 });
                      }
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted">Y offset (mm)</span>
                  <input
                    type="number"
                    className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                    defaultValue={el.textOffsetMm?.yMm ?? 0}
                    key={`${el.id}-text-y`}
                    step={10}
                    aria-label="Dimension text label Y offset in millimetres"
                    data-testid="dimension-text-offset-y"
                    onBlur={(e) => {
                      const yMm = Number(e.currentTarget.value);
                      if (!isNaN(yMm)) {
                        dimPropChange('textOffsetMm', { xMm: el.textOffsetMm?.xMm ?? 0, yMm });
                      }
                    }}
                  />
                </div>
                <div className="flex gap-2 pt-0.5">
                  <button
                    className="rounded border border-border bg-surface px-2 py-0.5 text-xs hover:bg-surface-strong"
                    data-testid="dimension-text-offset-reset"
                    onClick={() => dimPropChange('textOffsetMm', null)}
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1 border-t border-border pt-2">
                <span className="text-xs font-medium text-muted">Text decoration</span>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted">Prefix</span>
                  <input
                    type="text"
                    className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                    defaultValue={el.textPrefix ?? ''}
                    key={`${el.id}-prefix`}
                    placeholder="e.g. ≈"
                    aria-label="Dimension text prefix"
                    data-testid="dimension-text-prefix"
                    onBlur={(e) => dimPropChange('textPrefix', e.currentTarget.value || null)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted">Suffix</span>
                  <input
                    type="text"
                    className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                    defaultValue={el.textSuffix ?? ''}
                    key={`${el.id}-suffix`}
                    placeholder="e.g. (EQ)"
                    aria-label="Dimension text suffix"
                    data-testid="dimension-text-suffix"
                    onBlur={(e) => dimPropChange('textSuffix', e.currentTarget.value || null)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted">Override</span>
                  <input
                    type="text"
                    className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                    defaultValue={el.textOverride ?? ''}
                    key={`${el.id}-override`}
                    placeholder="replaces measured value"
                    aria-label="Dimension text override"
                    data-testid="dimension-text-override"
                    onBlur={(e) => dimPropChange('textOverride', e.currentTarget.value || null)}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>
      );
    }
    case 'railing': {
      const { onPropertyChange: railPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('name')} value={el.name} />
          {el.hostedStairId ? (
            <FieldRow label="Hosted Stair" value={resolveElName(el.hostedStairId, elementsById)} />
          ) : null}
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Guard Height (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.guardHeightMm ?? 1100}
              key={`${el.id}-guard`}
              step={50}
              aria-label="Railing guard height in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) railPropChange?.('guardHeightMm', v);
              }}
              data-testid="inspector-railing-guard-height"
            />
          </div>
          <FieldRow label="Path Vertices" value={String(el.pathMm.length)} mono />
          <MaterialSlotsSection
            elementId={el.id}
            slots={el.materialSlots}
            rows={[
              { slot: 'topRail', label: 'Top rail' },
              { slot: 'handrail', label: 'Handrail' },
              { slot: 'post', label: 'Post' },
              { slot: 'baluster', label: 'Baluster' },
              { slot: 'panel', label: 'Panel' },
              { slot: 'cable', label: 'Cable' },
              { slot: 'bracket', label: 'Bracket' },
            ]}
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
        </div>
      );
    }
    case 'ceiling': {
      const { onPropertyChange: ceilPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Height Offset (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.heightOffsetMm ?? 0}
              key={`${el.id}-hoffset`}
              step={100}
              aria-label="Ceiling height offset in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v)) ceilPropChange?.('heightOffsetMm', v);
              }}
              data-testid="inspector-ceiling-height-offset"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Thickness (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.thicknessMm ?? 50}
              key={`${el.id}-thickness`}
              step={10}
              aria-label="Ceiling thickness in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) ceilPropChange?.('thicknessMm', v);
              }}
              data-testid="inspector-ceiling-thickness"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Grid tile (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.gridPatternMm ?? 0}
              key={`${el.id}-grid`}
              step={100}
              min={0}
              max={3000}
              aria-label="Ceiling grid tile size in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v)) ceilPropChange?.('gridPatternMm', v === 0 ? null : v);
              }}
              data-testid="inspector-ceiling-grid-size"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Grid angle (°)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.gridAngleDeg ?? 0}
              key={`${el.id}-gridangle`}
              step={5}
              min={0}
              max={90}
              aria-label="Ceiling grid angle in degrees"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v)) ceilPropChange?.('gridAngleDeg', v === 0 ? null : v);
              }}
              data-testid="inspector-ceiling-grid-angle"
            />
          </div>
          <FieldRow label="Boundary Vertices" value={String(el.boundaryMm?.length ?? 0)} mono />
          {options?.onEditBoundary ? (
            <div
              className="flex items-center justify-between gap-2 rounded border border-border bg-surface px-2 py-1.5"
              data-testid="inspector-ceiling-boundary-actions"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground">Boundary</div>
                <div className="text-[10px] text-muted">Plan vertex grips</div>
              </div>
              <button
                type="button"
                data-testid="inspector-ceiling-edit-boundary"
                className="shrink-0 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-surface-strong"
                onClick={() => options.onEditBoundary?.(el)}
              >
                Edit Boundary
              </button>
            </div>
          ) : null}
          <FaceMaterialOverridesSection
            elementId={el.id}
            overrides={el.faceMaterialOverrides}
            elementsById={elementsById}
            onDispatchCommand={onDispatchCommand}
          />
        </div>
      );
    }
    case 'property_line':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('name')} value={el.name ?? '—'} />
          <FieldRow
            label="Start"
            value={`(${Math.round(el.startMm.xMm)}, ${Math.round(el.startMm.yMm)}) mm`}
            mono
          />
          <FieldRow
            label="End"
            value={`(${Math.round(el.endMm.xMm)}, ${Math.round(el.endMm.yMm)}) mm`}
            mono
          />
          <FieldRow label="Setback" value={`${el.setbackMm ?? 0} mm`} />
          <FieldRow label="Classification" value={el.classification ?? '—'} />
        </div>
      );
    case 'reference_plane': {
      const levels = Object.values(elementsById).filter(
        (e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level',
      );
      const levelNames: Record<string, string> = Object.fromEntries(
        levels.map((lv) => [lv.id, lv.name]),
      );
      const levelId = 'levelId' in el ? el.levelId : undefined;
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('name')} value={el.name ?? '—'} />
          <FieldRow
            label={f('level')}
            value={levelId ? (levelNames[levelId] ?? levelId) : '—'}
            mono
          />
        </div>
      );
    }
    case 'link_dxf':
      return (
        <LinkDxfInspectorSection
          el={el}
          elementsById={elementsById}
          onPropertyChange={options?.onPropertyChange}
        />
      );
    case 'masking_region': {
      const { onPropertyChange: mrPropChange } = options ?? {};
      const hostView = elementsById[el.hostViewId];
      const viewName = hostView && 'name' in hostView ? String(hostView.name) : el.hostViewId;
      // eslint-disable-next-line bim-ai/no-hex-in-chrome -- fallback when element has no color
      const fillColor = el.fillColor ?? '#ffffff';
      return (
        <div className="space-y-1 text-[11px]">
          <FieldRow label="Host View" value={viewName} />
          <FieldRow label="Boundary Vertices" value={String(el.boundaryMm.length)} />
          <FieldRow label="Void Loops" value={String(el.voidBoundariesMm?.length ?? 0)} />
          {/* KRN-10 / F-077: editable fill color */}
          <div className="flex items-center justify-between gap-4 border-b border-border py-1.5 last:border-b-0">
            <span className="text-xs text-muted">Fill Color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={fillColor}
                data-testid="inspector-masking-fillcolor"
                onChange={(e) => mrPropChange?.('fillColor', e.target.value)}
                className="h-6 w-10 cursor-pointer rounded border border-border bg-transparent p-0"
              />
              <span className="font-mono text-[10px] text-muted">{fillColor}</span>
            </div>
          </div>
          <FieldRow label="Edit Boundary" value="Vertex grips" />
        </div>
      );
    }
    case 'section_cut': {
      const { onPropertyChange: scPropChange } = options ?? {};
      return (
        <div>
          <FieldRow
            label={f('lineStart')}
            value={`${fmtMm(el.lineStartMm.xMm)} · ${fmtMm(el.lineStartMm.yMm)}`}
            mono
          />
          <FieldRow
            label={f('lineEnd')}
            value={`${fmtMm(el.lineEndMm.xMm)} · ${fmtMm(el.lineEndMm.yMm)}`}
            mono
          />
          <FieldRow label={f('cropDepth')} value={fmtMm(el.cropDepthMm)} />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Level Lines</span>
            <input
              data-testid="inspector-section-cut-show-level-lines"
              type="checkbox"
              checked={el.showLevelLines ?? false}
              onChange={(e) => scPropChange?.('showLevelLines', e.target.checked)}
              className="accent-primary"
            />
          </div>
        </div>
      );
    }
    case 'plan_view': {
      const { onPropertyChange: pvPropChange } = options ?? {};
      const lineworkOverrides =
        (el as Extract<Element, { kind: 'plan_view' }>).lineworkOverrides ?? [];
      return (
        <div>
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <FieldRow label={f('presentation')} value={el.planPresentation ?? 'default'} />
          {el.viewTemplateId ? (
            <FieldRow
              label={f('template')}
              value={resolveElName(el.viewTemplateId, elementsById)}
            />
          ) : null}
          {el.underlayLevelId ? (
            <FieldRow
              label={f('underlay')}
              value={resolveElName(el.underlayLevelId, elementsById)}
            />
          ) : null}
          {lineworkOverrides.length > 0 ? (
            <div data-testid="inspector-linework-overrides" className="flex flex-col gap-1 mt-2">
              <span className="text-xs font-medium text-muted">Linework Overrides</span>
              {lineworkOverrides.map((ov) => (
                <div
                  key={ov.elementId}
                  data-testid={`inspector-linework-override-${ov.elementId}`}
                  className="flex items-center gap-1"
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      background: ov.colorHex,
                      border: '1px solid #888',
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span className="text-xs flex-1">
                    {ov.elementId.slice(0, 8)}… {ov.lineWeightPx}px
                  </span>
                  <button
                    type="button"
                    data-testid={`inspector-linework-remove-${ov.elementId}`}
                    className="text-xs"
                    onClick={() => {
                      const next = lineworkOverrides.filter((o) => o.elementId !== ov.elementId);
                      pvPropChange?.('lineworkOverrides', next);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                data-testid="inspector-linework-clear-all"
                className="text-xs mt-1"
                onClick={() => pvPropChange?.('lineworkOverrides', [])}
              >
                Clear All
              </button>
            </div>
          ) : null}
        </div>
      );
    }
    case 'viewpoint':
    case 'elevation_view':
    case 'callout':
      return <ViewReferenceInspectorSection el={el} elementsById={elementsById} fieldLabel={f} />;
    case 'family_type':
      return (
        <div className="flex flex-col gap-2">
          <TypeTextInput
            label={f('name')}
            value={String(el.parameters.name ?? el.name)}
            testId="inspector-family-type-name"
            onCommit={(value) => options?.onPropertyChange?.('name', value)}
          />
          <FieldRow label="Discipline" value={el.discipline} />
          <FamilyTypeParameterTable
            parameters={el.parameters}
            onPropertyChange={options?.onPropertyChange}
          />
          {el.isBuiltIn ? <FieldRow label="Type" value="Built-in" /> : null}
        </div>
      );
    case 'wall_type':
    case 'floor_type':
    case 'roof_type': {
      const PRIORITY_LABELS: Record<number, string> = {
        1: 'Structure',
        2: 'Substrate',
        3: 'Thermal/Air',
        4: 'Finish 1',
        5: 'Finish 2',
      };
      const uniquePriorities =
        el.kind === 'wall_type'
          ? [...new Set(el.layers.flatMap((l) => (l.priority != null ? [l.priority] : [])))].sort(
              (a, b) => a - b,
            )
          : [];
      const prioritySummary =
        uniquePriorities.length > 0
          ? uniquePriorities.map((p) => `${PRIORITY_LABELS[p] ?? String(p)} (${p})`).join(' · ')
          : null;
      return (
        <div className="flex flex-col gap-2">
          <WallTypeLayerEditor
            typeElement={el}
            onUpdate={(patch) =>
              onDispatchCommand?.({ type: 'update_wall_type', id: el.id, patch })
            }
          />
          {prioritySummary != null ? (
            <p data-testid="inspector-wall-type-priority-summary" className="text-xs text-muted">
              Layer Priorities: {prioritySummary}
            </p>
          ) : null}
          <button
            type="button"
            data-testid="inspector-save-to-library"
            className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-surface-strong"
            onClick={() =>
              onDispatchCommand?.({
                type: 'saveFamilyToLibrary',
                elementId: el.id,
                familyName: (el as { name?: string }).name,
              })
            }
          >
            Save to Family Library
          </button>
        </div>
      );
    }
    case 'view_template':
      return (
        <div>
          <FieldRow label={f('scale')} value={el.scale != null ? String(el.scale) : ''} mono />
          {el.planDetailLevel ? (
            <FieldRow label={f('detailLevel')} value={el.planDetailLevel} />
          ) : null}
        </div>
      );
    case 'shared_param_file':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('paramGroups')} value={String(el.groups.length)} />
        </div>
      );
    case 'project_param':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('paramGuid')} value={el.sharedParamGuid} mono />
          <FieldRow label={f('paramCategories')} value={el.categories.join(', ') || '—'} />
          <FieldRow label={f('instanceOrType')} value={el.instanceOrType} />
        </div>
      );
    case 'color_fill_legend':
      return (
        <div>
          <FieldRow
            label={f('colorFillLegend')}
            value={resolveElName(el.hostViewId, elementsById)}
          />
          <FieldRow label={f('schemeParameter')} value={el.schemeParameter} />
          <FieldRow label={f('title')} value={el.title} />
        </div>
      );
    case 'grid_line':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
          <MonitorSourceRows
            el={el}
            elementsById={elementsById}
            t={t}
            onMonitorReconcile={onMonitorReconcile}
          />
        </div>
      );
    case 'project_settings':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name ?? '—'} />
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
          <FieldRow
            label="Checkpoint Retention"
            value={String(el.checkpointRetentionLimit ?? DEFAULT_CHECKPOINT_RETENTION_LIMIT)}
            mono
          />
          {el.startingViewId ? (
            <FieldRow
              label={f('startingView')}
              value={resolveElName(el.startingViewId, elementsById)}
            />
          ) : null}
        </div>
      );
    case 'selection_set':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('ruleCount')} value={String(el.filterRules.length)} />
        </div>
      );
    case 'clash_test':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('toleranceMm')} value={`${el.toleranceMm} mm`} />
          <FieldRow label={f('clashResults')} value={String(el.results?.length ?? 0)} />
        </div>
      );
    case 'sheet': {
      const legacyViewportCount = Array.isArray(el.viewportsMm) ? el.viewportsMm.length : 0;
      const placementCount = el.viewPlacements?.length ?? 0;
      return (
        <div>
          {el.number ? <FieldRow label={f('number')} value={el.number} /> : null}
          {el.size ? <FieldRow label={f('size')} value={el.size} /> : null}
          {el.orientation ? <FieldRow label={f('orientation')} value={el.orientation} /> : null}
          {el.titleblockTypeId ? (
            <FieldRow label={f('titleblock')} value={el.titleblockTypeId} mono />
          ) : null}
          <FieldRow label={f('viewports')} value={String(legacyViewportCount + placementCount)} />
          <FieldRow
            label={f('viewPlacementSource')}
            value={legacyViewportCount ? 'sheet viewports' : 'view placements'}
          />
        </div>
      );
    }
    case 'schedule':
      return (
        <div>
          {el.category ? <FieldRow label={f('category')} value={el.category} /> : null}
          <FieldRow label={f('columns')} value={String(el.columns?.length ?? 0)} />
          {el.filterExpr ? <FieldRow label={f('filter')} value={el.filterExpr} mono /> : null}
          {el.sortKey ? (
            <FieldRow label={f('sort')} value={`${el.sortKey} ${el.sortDir ?? 'asc'}`} mono />
          ) : null}
        </div>
      );
    case 'text_note': {
      const { onPropertyChange: tnPropChange } = options ?? {};
      return <TextNoteInspectorSection element={el} onPropertyChange={tnPropChange} />;
    }
    case 'leader_text': {
      const { onPropertyChange: ltPropChange } = options ?? {};
      return <LeaderTextInspectorSection element={el} onPropertyChange={ltPropChange} />;
    }
    case 'angular_dimension': {
      const { onPropertyChange: angPropChange } = options ?? {};
      return <AngularDimensionInspectorSection element={el} onPropertyChange={angPropChange} />;
    }
    case 'radial_dimension':
    case 'diameter_dimension': {
      const { onPropertyChange: radPropChange } = options ?? {};
      return <RadialDimensionInspectorSection element={el} onPropertyChange={radPropChange} />;
    }
    case 'arc_length_dimension': {
      return <ArcLengthDimensionInspectorSection element={el} />;
    }
    case 'permanent_dimension': {
      const { onPropertyChange: pdPropChange } = options ?? {};
      return <PermanentDimensionInspectorSection element={el} onPropertyChange={pdPropChange} />;
    }
    case 'interior_elevation_marker': {
      return (
        <InteriorElevationMarkerInspectorSection
          el={el}
          elementsById={elementsById}
          onPropertyChange={options?.onPropertyChange}
        />
      );
    }
    case 'spot_elevation':
    case 'spot_coordinate':
    case 'spot_slope':
    case 'slope_annotation': {
      return (
        <SpotAnnotationInspectorSection el={el} onPropertyChange={options?.onPropertyChange} />
      );
    }
    case 'toposolid':
    case 'graded_region':
    case 'toposolid_excavation':
    case 'toposolid_pad': {
      return (
        <SiteTerrainInspectorSection
          el={el}
          onPropertyChange={options?.onPropertyChange}
          onDispatchCommand={onDispatchCommand}
        />
      );
    }
    case 'mass_box':
    case 'mass_extrusion':
    case 'mass_revolution': {
      return <ModelingActionInspectorSection el={el} onDispatchCommand={onDispatchCommand} />;
    }
    case 'placed_tag':
    case 'material_tag': {
      return (
        <AnnotationTagInspectorSection
          el={el}
          elementsById={elementsById}
          onPropertyChange={options?.onPropertyChange}
        />
      );
    }
    case 'detail_group': {
      return <ModelingActionInspectorSection el={el} onDispatchCommand={onDispatchCommand} />;
    }
    case 'project_base_point': {
      return (
        <ProjectBasePointInspectorSection el={el} onPropertyChange={options?.onPropertyChange} />
      );
    }
    case 'decal': {
      return <DecalInspectorSection el={el} onPropertyChange={options?.onPropertyChange} />;
    }
    case 'detail_line':
    case 'detail_filled_region':
    case 'detail_arc': {
      return (
        <DetailDocumentationInspectorSection el={el} onPropertyChange={options?.onPropertyChange} />
      );
    }
    case 'shaft': {
      const { onPropertyChange } = options ?? {};
      const levels = Object.values(elementsById)
        .filter((e): e is Extract<Element, { kind: 'level' }> => e?.kind === 'level')
        .sort((a, b) => a.elevationMm - b.elevationMm);
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Boundary Vertices" value={String(el.boundaryMm.length)} mono />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Base Level</span>
            <select
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              data-testid="inspector-shaft-base-level"
              value={el.baseLevelId ?? ''}
              onChange={(e) => onPropertyChange?.('baseLevelId', e.target.value || null)}
            >
              <option value="">— none —</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Top Level</span>
            <select
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              data-testid="inspector-shaft-top-level"
              value={el.topLevelId ?? ''}
              onChange={(e) => onPropertyChange?.('topLevelId', e.target.value || null)}
            >
              <option value="">— none —</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-surface-strong"
            data-testid="inspector-shaft-recompute"
            onClick={() => onDispatchCommand?.({ type: 'recomputeShaftCuts', shaftId: el.id })}
          >
            Recompute Cuts
          </button>
          <button
            type="button"
            className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-surface-strong"
            data-testid="inspector-shaft-apply-cut"
            onClick={() =>
              onDispatchCommand?.({ type: 'applyShaftCut', shaftId: el.id, cutFloorIds: [] })
            }
          >
            Apply Shaft Cut
          </button>
          <span data-testid="inspector-shaft-cut-floor-count" className="text-xs text-muted">
            Cuts {((el as any).cutFloorIds ?? []).length} floor(s)
          </span>
          <ShaftSideWallsButton shaft={el} onDispatchCommand={onDispatchCommand} />
        </div>
      );
    }
    default: {
      const materialAssignment = GenericMaterialAssignmentFor({
        el,
        elementsById,
        onOpenMaterialBrowser,
        onOpenAppearanceAssetBrowser,
      });
      if (materialAssignment)
        return <div className="flex flex-col gap-2">{materialAssignment}</div>;
      return <p className="text-sm text-muted">{t('inspector.noParams', { kind: el.kind })}</p>;
    }
  }
}

export function InspectorConstraintsFor(el: Element, t: TFunction): JSX.Element {
  const f = (key: string) => t(`inspector.fields.${key}`);
  switch (el.kind) {
    case 'wall':
      return (
        <div>
          <FieldRow label={f('wallJoin')} value="Auto" />
          <FieldRow label={f('wrapRule')} value="Default" />
          <FieldRow label={f('roomBounding')} value="Yes" />
          <FieldRow label={f('locationLine')} value="Wall centerline" />
        </div>
      );
    case 'floor':
      return (
        <div>
          <FieldRow label={f('roomBounding')} value={el.roomBounded ? 'Yes' : 'No'} />
          <FieldRow label={f('slabTopElevation')} value="(derived)" />
        </div>
      );
    case 'roof':
      return (
        <div>
          <FieldRow label={f('geometryMode')} value={el.roofGeometryMode ?? 'mass_box'} mono />
        </div>
      );
    default:
      return (
        <p className="text-sm text-muted">{t('inspector.noConstraints', { kind: el.kind })}</p>
      );
  }
}

export function InspectorIdentityFor(el: Element, t: TFunction): JSX.Element {
  const f = (key: string) => t(`inspector.fields.${key}`);
  return (
    <div>
      <FieldRow label={f('kind')} value={el.kind} mono />
      <FieldRow label={f('id')} value={el.id} mono />
      <FieldRow label={f('name')} value={(el as { name?: string }).name ?? '—'} />
      <FieldRow label={f('mark')} value={(el as { mark?: string }).mark ?? '—'} />
      <FieldRow label={f('comments')} value={(el as { comments?: string }).comments ?? '—'} />
    </div>
  );
}

/**
 * VIE-07: pin / unpin toggle exposed in the Inspector header. Renders nothing
 * for element kinds that don't carry a `pinned` field, so it's safe to drop in
 * unconditionally on any selected element.
 */
export function InspectorPinToggle({
  el,
  onPin,
  onUnpin,
}: {
  el: Element;
  onPin: (elementId: string) => void;
  onUnpin: (elementId: string) => void;
}): JSX.Element | null {
  const pinned = (el as { pinned?: boolean }).pinned ?? false;
  // The 'pinned' marker is optional on the union; treat its presence (even
  // when false) as "this kind supports pinning". Since TypeScript widens the
  // union at runtime, gate on a known set of pinnable kinds.
  const PINNABLE = new Set<string>([
    'wall',
    'door',
    'window',
    'level',
    'grid_line',
    'room',
    'floor',
    'roof',
    'stair',
    'slab_opening',
    'railing',
    'balcony',
    'dimension',
    'room_separation',
    'section_cut',
    'link_model',
    'link_dxf',
  ]);
  if (!PINNABLE.has(el.kind)) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pinned}
      data-pin-toggle="1"
      data-pinned={pinned ? '1' : '0'}
      onClick={() => (pinned ? onUnpin(el.id) : onPin(el.id))}
      className={[
        'inline-flex items-center gap-1 rounded border px-2 py-1 text-xs',
        pinned ? 'border-amber-500 bg-amber-100 text-amber-900' : 'border-border text-muted',
      ].join(' ')}
      title={pinned ? 'Unpin (UP)' : 'Pin (UP)'}
    >
      <span aria-hidden>📌</span>
      <span>{pinned ? 'Pinned' : 'Pin'}</span>
    </button>
  );
}

export function InspectorGraphicsFor({
  el,
  elementsById,
  revision,
  onPersistProperty,
}: {
  el: Element;
  elementsById: Record<string, Element>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element | null {
  if (el.kind === 'plan_view') {
    const rows = planViewGraphicsMatrixRows(elementsById, el.id);
    return (
      <div className="flex flex-col gap-4">
        <PlanViewGraphicsMatrix rows={rows} />
        <SavedViewTagGraphicsAuthoring
          variant="plan_view"
          selected={el as Extract<Element, { kind: 'plan_view' }>}
          revision={revision}
          elementsById={elementsById}
          onPersistProperty={onPersistProperty}
        />
      </div>
    );
  }
  if (el.kind === 'view_template') {
    const rows = viewTemplateGraphicsMatrixRows(elementsById, el.id);
    return (
      <div className="flex flex-col gap-4">
        <PlanViewGraphicsMatrix
          rows={rows}
          footnote="Template defaults — plan_view overrides these when linked."
        />
        <SavedViewTemplateGraphicsAuthoring
          selected={el as Extract<Element, { kind: 'view_template' }>}
          revision={revision}
          elementsById={elementsById}
          onPersistProperty={onPersistProperty}
        />
      </div>
    );
  }
  return null;
}

const INPUT_CLS =
  'mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]';
const LABEL_CLS = 'block text-[10px] text-muted';
const VIEW_TEMPLATE_CONTROL_FIELDS: Array<{
  field: ViewTemplateControlledField;
  label: string;
}> = [
  { field: 'scale', label: 'Scale' },
  { field: 'detailLevel', label: 'Detail level' },
  { field: 'phase', label: 'Phase' },
  { field: 'phaseFilter', label: 'Phase filter' },
  { field: 'elementOverrides', label: 'Element overrides' },
];

function viewTemplateControlState(
  el: Extract<Element, { kind: 'view_template' }>,
  field: ViewTemplateControlledField,
): { included: boolean; locked: boolean } {
  const control = el.templateControlMatrix?.[field];
  const included = control?.included ?? true;
  return { included, locked: control?.locked ?? included };
}

function viewTemplateControlPatch(
  field: ViewTemplateControlledField,
  included: boolean,
  locked: boolean,
): string {
  return JSON.stringify({
    templateControlMatrix: {
      [field]: { included, locked: included ? locked : false },
    },
  });
}

/** Editable inspector for plan_view elements (Properties tab). */
export function InspectorPlanViewEditor({
  el,
  elementsById,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'plan_view' }>;
  elementsById: Record<string, Element>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const levels = (Object.values(elementsById) as Element[]).filter(
    (e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level',
  );
  const templates = (Object.values(elementsById) as Element[]).filter(
    (e): e is Extract<Element, { kind: 'view_template' }> => e.kind === 'view_template',
  );

  const { t } = useTranslation();
  const pv = (key: string) => t(`inspector.planView.${key}`);

  const [cropDraft, setCropDraft] = useState({
    minX: el.cropMinMm ? String(el.cropMinMm.xMm) : '',
    minY: el.cropMinMm ? String(el.cropMinMm.yMm) : '',
    maxX: el.cropMaxMm ? String(el.cropMaxMm.xMm) : '',
    maxY: el.cropMaxMm ? String(el.cropMaxMm.yMm) : '',
  });

  return (
    <div className="space-y-2 text-[11px]">
      <label className={LABEL_CLS}>
        {pv('namePlaceholder')}
        <input
          className={INPUT_CLS}
          defaultValue={el.name}
          key={`pv-name-${el.id}-${el.name}-${revision}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v || v === el.name) return;
            onPersistProperty('name', v);
          }}
        />
      </label>

      <label className={LABEL_CLS}>
        {pv('planPresentation')}
        <select
          className={INPUT_CLS}
          value={el.planPresentation ?? 'default'}
          onChange={(e) => onPersistProperty('planPresentation', e.target.value)}
        >
          <option value="default">{pv('neutralPresentation')}</option>
          <option value="opening_focus">{pv('openingFocus')}</option>
          <option value="room_scheme">{pv('roomScheme')}</option>
        </select>
      </label>

      <label className={LABEL_CLS}>
        <span>Discipline</span>
        <select
          className={INPUT_CLS}
          value={el.discipline ?? ''}
          onChange={(e) => onPersistProperty('discipline', e.target.value)}
          data-testid="inspector-plan-view-discipline"
        >
          <option value="">(Default)</option>
          <option value="arch">Architecture</option>
          <option value="struct">Structural</option>
          <option value="mep">MEP</option>
          <option value="coordination">Coordination</option>
        </select>
      </label>

      <label className={LABEL_CLS}>
        <span>Sub-discipline</span>
        <select
          className={INPUT_CLS}
          value={el.viewSubdiscipline ?? ''}
          onChange={(e) => onPersistProperty('viewSubdiscipline', e.target.value)}
          data-testid="inspector-plan-view-subdiscipline"
        >
          <option value="">(None)</option>
          <option value="Architecture">Architecture</option>
          <option value="Interior">Interior</option>
          <option value="Structural">Structural</option>
          <option value="Mechanical">Mechanical</option>
          <option value="Electrical">Electrical</option>
          <option value="Plumbing">Plumbing</option>
          <option value="Coordination">Coordination</option>
        </select>
      </label>

      <label className={LABEL_CLS}>
        <span>View Type</span>
        <select
          className={INPUT_CLS}
          value={el.planViewSubtype ?? 'floor_plan'}
          onChange={(e) => onPersistProperty('planViewSubtype', e.target.value)}
          data-testid="inspector-plan-view-subtype"
        >
          <option value="floor_plan">Floor Plan</option>
          <option value="area_plan">Area Plan</option>
          <option value="lighting_plan">Lighting Plan</option>
          <option value="power_plan">Power Plan</option>
          <option value="coordination_plan">Coordination Plan</option>
        </select>
      </label>

      {el.planViewSubtype === 'area_plan' ? (
        <label className={LABEL_CLS}>
          <span>Area Scheme</span>
          <select
            className={INPUT_CLS}
            value={el.areaScheme ?? 'gross_building'}
            onChange={(e) => onPersistProperty('areaScheme', e.target.value)}
            data-testid="inspector-plan-view-area-scheme"
          >
            <option value="gross_building">Gross Building</option>
            <option value="net">Net</option>
            <option value="rentable">Rentable</option>
          </select>
        </label>
      ) : null}

      <label className={LABEL_CLS}>
        <span>Room Labels</span>
        <input
          type="checkbox"
          checked={el.planShowRoomLabels ?? false}
          onChange={(e) => onPersistProperty('planShowRoomLabels', String(e.target.checked))}
          data-testid="inspector-plan-show-room-labels"
        />
      </label>

      <label className={LABEL_CLS}>
        <span>Opening Tags</span>
        <input
          type="checkbox"
          checked={el.planShowOpeningTags ?? false}
          onChange={(e) => onPersistProperty('planShowOpeningTags', String(e.target.checked))}
          data-testid="inspector-plan-show-opening-tags"
        />
      </label>

      <label className={LABEL_CLS}>
        <span>Room Fill Opacity</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            defaultValue={el.planRoomFillOpacityScale ?? 1}
            key={`pv-rfill-${el.id}-${el.planRoomFillOpacityScale ?? 1}-${revision}`}
            className="w-24"
            onBlur={(e) => onPersistProperty('planRoomFillOpacityScale', e.target.value)}
            data-testid="inspector-plan-room-fill-opacity"
          />
          <span className="font-mono text-[10px]">
            {((el.planRoomFillOpacityScale ?? 1) * 100).toFixed(0)}%
          </span>
        </div>
      </label>

      <label className={LABEL_CLS}>
        <span>Detail Level</span>
        <select
          className={INPUT_CLS}
          value={el.planDetailLevel ?? ''}
          onChange={(e) => onPersistProperty('planDetailLevel', e.target.value)}
          data-testid="inspector-plan-detail-level"
        >
          <option value="">{pv('none')} (inherit)</option>
          <option value="coarse">Coarse</option>
          <option value="medium">Medium</option>
          <option value="fine">Fine</option>
        </select>
      </label>

      <label className={LABEL_CLS}>
        <span>Phase Filter</span>
        <select
          className={INPUT_CLS}
          value={el.phaseFilter ?? ''}
          onChange={(e) => onPersistProperty('phaseFilter', e.target.value)}
          data-testid="inspector-plan-phase-filter"
        >
          <option value="">— none —</option>
          <option value="all">All</option>
          <option value="existing">Existing</option>
          <option value="demolition">Demolition</option>
          <option value="new">New Construction</option>
        </select>
      </label>

      <label className={LABEL_CLS}>
        {pv('underlayLevel')}
        <select
          className={INPUT_CLS}
          value={
            el.underlayLevelId && levels.some((l) => l.id === el.underlayLevelId)
              ? el.underlayLevelId
              : ''
          }
          onChange={(e) => onPersistProperty('underlayLevelId', e.target.value)}
        >
          <option value="">{pv('none')}</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      {templates.length > 0 ? (
        <>
          <label className={LABEL_CLS}>
            {pv('viewTemplateLink')}
            <select
              className={INPUT_CLS}
              value={
                el.viewTemplateId && templates.some((tmpl) => tmpl.id === el.viewTemplateId)
                  ? el.viewTemplateId
                  : ''
              }
              onChange={(e) => onPersistProperty('viewTemplateId', e.target.value)}
            >
              <option value="">{pv('none')}</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}
                </option>
              ))}
            </select>
          </label>
          <div className={LABEL_CLS}>
            <span>View Template</span>
            <button
              type="button"
              data-testid="inspector-save-as-template"
              onClick={() =>
                onPersistProperty(
                  '__saveAsTemplate__',
                  JSON.stringify({
                    name: `Copy of ${el.name}`,
                    detailLevel: el.planDetailLevel ?? null,
                    phaseFilter: ((el as Record<string, unknown>).phaseFilter as string) ?? null,
                  }),
                )
              }
              style={{ fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}
              title="Create a new view template from this view's current settings"
            >
              Save as Template…
            </button>
          </div>
          <label className={LABEL_CLS}>
            {pv('applyTemplate')}
            <select
              className={INPUT_CLS}
              value=""
              onChange={(e) => {
                const tid = e.target.value;
                if (!tid) return;
                onPersistProperty(
                  '__applyTemplate__',
                  JSON.stringify({ planViewId: el.id, templateId: tid }),
                );
              }}
            >
              <option value="">{pv('selectToApply')}</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      <div className="border-t border-border pt-2 space-y-2">
        <div className="font-semibold text-muted">{pv('crop')}</div>
        <div className="grid grid-cols-2 gap-2">
          {(['minX', 'minY', 'maxX', 'maxY'] as const).map((k) => (
            <label key={k} className={LABEL_CLS}>
              {k}
              <input
                className={INPUT_CLS}
                value={cropDraft[k]}
                onChange={(e) => setCropDraft((d) => ({ ...d, [k]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-[10px] hover:bg-surface-strong"
            onClick={() => {
              const nx = Number(cropDraft.minX),
                ny = Number(cropDraft.minY);
              const xx = Number(cropDraft.maxX),
                xy = Number(cropDraft.maxY);
              if (![nx, ny, xx, xy].every(Number.isFinite)) return;
              onPersistProperty('cropMinMm', JSON.stringify({ xMm: nx, yMm: ny }));
              onPersistProperty('cropMaxMm', JSON.stringify({ xMm: xx, yMm: xy }));
            }}
          >
            {pv('applyCrop')}
          </button>
          <button
            type="button"
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-[10px] hover:bg-surface-strong"
            onClick={() => {
              onPersistProperty('cropMinMm', '');
              onPersistProperty('cropMaxMm', '');
              setCropDraft({ minX: '', minY: '', maxX: '', maxY: '' });
            }}
          >
            {pv('clearCrop')}
          </button>
        </div>
      </div>

      <div className="border-t border-border pt-2 space-y-2">
        <div className="font-semibold text-muted">{pv('viewRange')}</div>
        {(
          [
            {
              key: 'viewRangeBottomMm',
              label: pv('rangeBottom'),
              val: el.viewRangeBottomMm,
              defaultVal: -500,
              testid: 'inspector-plan-view-range-bottom',
              ariaLabel: 'View range bottom in mm',
            },
            {
              key: 'viewRangeTopMm',
              label: pv('rangeTop'),
              val: el.viewRangeTopMm,
              defaultVal: 2000,
              testid: 'inspector-plan-view-range-top',
              ariaLabel: 'View range top in mm',
            },
            {
              key: 'cutPlaneOffsetMm',
              label: pv('cutPlaneOffset'),
              val: el.cutPlaneOffsetMm,
              defaultVal: 1200,
              testid: 'inspector-plan-view-cut-plane',
              ariaLabel: 'Cut plane offset in mm',
            },
          ] as {
            key: string;
            label: string;
            val: number | null | undefined;
            defaultVal: number;
            testid: string;
            ariaLabel: string;
          }[]
        ).map(({ key, label, val, defaultVal, testid, ariaLabel }) => (
          <label key={key} className={LABEL_CLS}>
            {label}
            <input
              type="number"
              className={INPUT_CLS}
              defaultValue={val ?? defaultVal}
              key={`${key}-${el.id}-${val ?? 'null'}-${revision}`}
              step={100}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== '') onPersistProperty(key, v);
              }}
              data-testid={testid}
              aria-label={ariaLabel}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/** Editable inspector for room elements (Properties tab). */
export function InspectorRoomEditor({
  el,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'room' }>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const f = (key: string) => t(`inspector.fields.${key}`);
  const r = (key: string) => t(`inspector.room.${key}`);
  const roomPropString = (key: string): string => {
    const value = el.props?.[key];
    if (value == null) return '';
    return typeof value === 'string' ? value : String(value);
  };
  const fields: {
    key: string;
    label: string;
    val: string | null | undefined;
    inputMode?: string;
  }[] = [
    { key: 'name', label: f('name'), val: el.name },
    { key: 'programmeCode', label: r('programmeCode'), val: el.programmeCode },
    { key: 'department', label: f('department'), val: el.department },
    { key: 'functionLabel', label: r('functionLabel'), val: el.functionLabel },
    { key: 'finishSet', label: f('finishSet'), val: el.finishSet },
  ];
  const architectureFields: {
    key: string;
    label: string;
    val: string;
  }[] = [
    { key: 'roomFunction', label: r('roomFunction'), val: roomPropString('roomFunction') },
    { key: 'finishSetId', label: r('finishSetId'), val: roomPropString('finishSetId') },
    { key: 'designIntent', label: r('designIntent'), val: roomPropString('designIntent') },
    {
      key: 'documentationStatus',
      label: r('documentationStatus'),
      val: roomPropString('documentationStatus'),
    },
    { key: 'occupancyNotes', label: r('occupancyNotes'), val: roomPropString('occupancyNotes') },
    { key: 'roomBounding', label: r('roomBounding'), val: roomPropString('roomBounding') },
  ];
  const consultantBadges = [
    ['Fire', roomPropString('fireRating') || roomPropString('fireResistanceRating')],
    ['Acoustic', roomPropString('acousticRating') || roomPropString('stcRating')],
    ['Energy', roomPropString('energyZone') || roomPropString('heatingStatus')],
    ['Cost', roomPropString('costCode') || roomPropString('costGroup')],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <div className="space-y-2 text-[11px]">
      {fields.map(({ key, label, val }) => (
        <label key={key} className={LABEL_CLS}>
          {label}
          <input
            className={INPUT_CLS}
            defaultValue={val ?? ''}
            key={`rm-${key}-${el.id}-${val ?? ''}-${revision}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (key === 'name' && (!v || v === val)) return;
              onPersistProperty(key, v);
            }}
          />
        </label>
      ))}
      {architectureFields.map(({ key, label, val }) => (
        <label key={key} className={LABEL_CLS}>
          {label}
          <input
            className={INPUT_CLS}
            defaultValue={val}
            key={`rm-prop-${key}-${el.id}-${val}-${revision}`}
            data-testid={`inspector-room-${key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)}`}
            onBlur={(e) => onPersistProperty(key, e.target.value.trim())}
          />
        </label>
      ))}
      <label className={LABEL_CLS}>
        {r('targetArea')}
        <input
          className={INPUT_CLS}
          defaultValue={el.targetAreaM2 == null ? '' : String(el.targetAreaM2)}
          key={`rm-tgt-${el.id}-${el.targetAreaM2 ?? 'x'}-${revision}`}
          placeholder={r('optional')}
          inputMode="decimal"
          data-testid="inspector-room-target-area"
          onBlur={(e) => onPersistProperty('targetAreaM2', e.target.value.trim())}
        />
      </label>
      <label className={LABEL_CLS}>
        Room Number
        <input
          className={INPUT_CLS}
          defaultValue={el.numberLabel ?? ''}
          key={`rm-num-${el.id}-${el.numberLabel ?? ''}-${revision}`}
          data-testid="inspector-room-number"
          onBlur={(e) => onPersistProperty('numberLabel', e.target.value.trim())}
        />
      </label>
      <label className={LABEL_CLS}>
        Gross Area
        <input
          className={INPUT_CLS}
          value={el.outlineMm.length >= 3 ? `${roomAreaM2(el.outlineMm).toFixed(1)} m²` : '—'}
          readOnly
          data-testid="inspector-room-area-gross"
          onChange={() => undefined}
        />
      </label>
      <label className={LABEL_CLS}>
        Room fill override
        <input
          className={INPUT_CLS}
          defaultValue={el.roomFillOverrideHex ?? ''}
          key={`rm-fill-${el.id}-${el.roomFillOverrideHex ?? 'none'}-${revision}`}
          placeholder="#RRGGBB"
          pattern="^#[0-9a-fA-F]{6}$"
          data-testid="inspector-room-fill-override"
          onBlur={(e) => onPersistProperty('roomFillOverrideHex', e.target.value.trim())}
        />
      </label>
      <label className={LABEL_CLS}>
        Room fill pattern
        <select
          className={INPUT_CLS}
          value={el.roomFillPatternOverride ?? ''}
          key={`rm-fill-pattern-${el.id}-${el.roomFillPatternOverride ?? 'none'}-${revision}`}
          data-testid="inspector-room-fill-pattern-override"
          onChange={(e) => onPersistProperty('roomFillPatternOverride', e.target.value)}
        >
          <option value="">View default</option>
          <option value="solid">Solid</option>
          <option value="hatch_45">45 degree hatch</option>
          <option value="hatch_90">90 degree hatch</option>
          <option value="crosshatch">Crosshatch</option>
          <option value="dots">Dots</option>
        </select>
      </label>
      {consultantBadges.length ? (
        <div
          className="flex flex-wrap gap-1.5 border-b border-border py-1.5"
          data-testid="inspector-room-consultant-badges"
        >
          {consultantBadges.map(([label, value]) => (
            <span
              key={label}
              className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted"
              title={`${label}: ${value}`}
            >
              <span className="font-medium text-foreground">{label}</span> {value}
            </span>
          ))}
        </div>
      ) : null}
      {el.volumeM3 != null ? (
        <FieldRow label={f('volume')} value={`${el.volumeM3.toFixed(3)} m³`} />
      ) : null}
      {el.phaseCreated ? <FieldRow label={f('phaseCreated')} value={el.phaseCreated} /> : null}
      {el.phaseDemolished ? (
        <FieldRow label={f('phaseDemolished')} value={el.phaseDemolished} />
      ) : null}
      <FieldRow label={f('level')} value={el.levelId} mono />
      <FieldRow label={f('outlinePoints')} value={String(el.outlineMm.length)} />
    </div>
  );
}

/** Editable name field for viewpoint elements (Properties tab). */
export function InspectorViewpointEditor({
  el,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'viewpoint' }>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 text-[11px]">
      <p className="text-[10px] text-muted">{t('inspector.viewpoint.hint')}</p>
      <label className={LABEL_CLS}>
        {t('inspector.fields.name')}
        <input
          className={INPUT_CLS}
          defaultValue={el.name}
          key={`vp-name-${el.id}-${el.name}-${revision}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v || v === el.name) return;
            onPersistProperty('name', v);
          }}
        />
      </label>
    </div>
  );
}

type CustomFamilyTypeElem = Extract<Element, { kind: 'family_type' }>;

function CustomTypeForm({
  discipline,
  onSave,
  onCancel,
}: {
  discipline: 'door' | 'window';
  onSave: (baseFamilyId: string, name: string, params: Record<string, unknown>) => void;
  onCancel: () => void;
}): JSX.Element {
  const families = BUILT_IN_FAMILIES.filter((f) => f.discipline === discipline);
  const [baseFamilyId, setBaseFamilyId] = useState(families[0]?.id ?? '');
  const [name, setName] = useState('');
  const [paramDraft, setParamDraft] = useState<Record<string, string>>({});

  const baseFam = getFamilyById(baseFamilyId);
  const lengthParams = baseFam?.params.filter((p) => p.type === 'length_mm') ?? [];

  function handleSave(): void {
    const params: Record<string, unknown> = { name: name.trim(), baseFamilyId };
    for (const p of lengthParams) {
      const raw = paramDraft[p.key];
      const val = raw !== undefined ? Number(raw) : (p.default as number);
      if (Number.isFinite(val)) params[p.key] = val;
    }
    onSave(baseFamilyId, name.trim(), params);
  }

  return (
    <div className="mt-1 space-y-1.5 rounded border border-border bg-background p-2">
      <label className={LABEL_CLS}>
        Base family
        <select
          className={INPUT_CLS}
          value={baseFamilyId}
          onChange={(e) => {
            setBaseFamilyId(e.target.value);
            setParamDraft({});
          }}
        >
          {families.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label className={LABEL_CLS}>
        Type name
        <input
          className={INPUT_CLS}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Wide fire door"
          autoFocus
        />
      </label>
      {lengthParams.map((p) => (
        <label key={p.key} className={LABEL_CLS}>
          {p.label} (mm)
          <input
            className={INPUT_CLS}
            type="number"
            value={paramDraft[p.key] ?? String(p.default as number)}
            onChange={(e) => setParamDraft((d) => ({ ...d, [p.key]: e.target.value }))}
          />
        </label>
      ))}
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          disabled={!name.trim()}
          onClick={handleSave}
          className="flex-1 rounded border border-border bg-surface-strong px-2 py-0.5 text-[10px] hover:bg-accent-soft disabled:opacity-40"
        >
          Save type
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-surface-strong"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Editable family type picker for door elements (Properties tab). */
export function InspectorDoorEditor({
  el,
  revision,
  elementsById = {},
  onPersistProperty,
  onCreateType,
  onDuplicateType,
  onDisciplineChange,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
}: {
  el: Extract<Element, { kind: 'door' }>;
  revision: number;
  elementsById?: Record<string, Element>;
  onPersistProperty: (key: string, value: string) => void;
  onCreateType?: (baseFamilyId: string, name: string, params: Record<string, unknown>) => void;
  onDuplicateType?: (familyTypeId: string | null | undefined) => void;
  onDisciplineChange?: (discipline: DisciplineTag | null) => void;
  onOpenMaterialBrowser?: OpenMaterialBrowser;
  onOpenAppearanceAssetBrowser?: OpenMaterialBrowser;
}): JSX.Element {
  const { t } = useTranslation();
  const f = (key: string) => t(`inspector.fields.${key}`);
  const [showForm, setShowForm] = useState(false);
  const doorFamilies = BUILT_IN_FAMILIES.filter((fam) => fam.discipline === 'door');
  const customTypes = (Object.values(elementsById) as Element[]).filter(
    (e): e is CustomFamilyTypeElem => e.kind === 'family_type' && e.discipline === 'door',
  );

  // resolve display name: built-in types use catalog name; custom types use parameters.name
  function typeLabel(id: string): string {
    const builtin = getTypeById(id);
    if (builtin) return builtin.name;
    const custom = elementsById[id] as CustomFamilyTypeElem | undefined;
    return String(custom?.parameters.name ?? id);
  }
  void typeLabel; // used via select option text directly

  return (
    <div className="space-y-2 text-[11px]">
      <label className={LABEL_CLS}>
        {f('family')}
        <select
          className={INPUT_CLS}
          value={el.familyTypeId ?? ''}
          key={`door-ft-${el.id}-${el.familyTypeId ?? ''}-${revision}`}
          onChange={(e) => onPersistProperty('familyTypeId', e.target.value)}
        >
          <option value="">Generic</option>
          {doorFamilies.map((fam) => (
            <optgroup key={fam.id} label={fam.name}>
              {fam.defaultTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </optgroup>
          ))}
          {customTypes.length > 0 && (
            <optgroup label="Custom">
              {customTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {String(ct.parameters.name ?? ct.id)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {onCreateType && !showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-[10px] text-accent hover:underline"
          >
            + New custom type…
          </button>
        ) : null}
        {onDuplicateType && el.familyTypeId ? (
          <button
            type="button"
            data-testid="inspector-door-duplicate-type"
            onClick={() => onDuplicateType(el.familyTypeId)}
            className="text-[10px] text-accent hover:underline"
          >
            Duplicate type
          </button>
        ) : null}
      </div>
      {onCreateType && showForm && (
        <CustomTypeForm
          discipline="door"
          onSave={(baseFamilyId, name, params) => {
            onCreateType(baseFamilyId, name, params);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      <MaterialAssignmentRow
        label="Material"
        materialKey={el.materialKey ?? null}
        fallback="By family/category"
        elementsById={elementsById}
        onOpenMaterialBrowser={onOpenMaterialBrowser}
        onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
      />
      <MaterialSlotsSection
        elementId={el.id}
        slots={el.materialSlots}
        rows={[
          { slot: 'frame', label: 'Frame' },
          { slot: 'panel', label: 'Panel' },
          { slot: 'hardware', label: 'Hardware' },
          { slot: 'threshold', label: 'Threshold' },
        ]}
        elementsById={elementsById}
        onOpenMaterialBrowser={onOpenMaterialBrowser}
        onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
      />
      <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
      <FieldRow label={f('wall')} value={resolveElName(el.wallId, elementsById)} />
      <FieldRow label={f('alongT')} value={el.alongT.toFixed(3)} mono />
      {onDisciplineChange ? (
        <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
      ) : null}
    </div>
  );
}

/** Editable family type picker for window elements (Properties tab). */
export function InspectorWindowEditor({
  el,
  revision,
  elementsById = {},
  onPersistProperty,
  onCreateType,
  onDuplicateType,
  onDisciplineChange,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
}: {
  el: Extract<Element, { kind: 'window' }>;
  revision: number;
  elementsById?: Record<string, Element>;
  onPersistProperty: (key: string, value: string) => void;
  onCreateType?: (baseFamilyId: string, name: string, params: Record<string, unknown>) => void;
  onDuplicateType?: (familyTypeId: string | null | undefined) => void;
  onDisciplineChange?: (discipline: DisciplineTag | null) => void;
  onOpenMaterialBrowser?: OpenMaterialBrowser;
  onOpenAppearanceAssetBrowser?: OpenMaterialBrowser;
}): JSX.Element {
  const { t } = useTranslation();
  const f = (key: string) => t(`inspector.fields.${key}`);
  const [showForm, setShowForm] = useState(false);
  const windowFamilies = BUILT_IN_FAMILIES.filter((fam) => fam.discipline === 'window');
  const customTypes = (Object.values(elementsById) as Element[]).filter(
    (e): e is CustomFamilyTypeElem => e.kind === 'family_type' && e.discipline === 'window',
  );

  return (
    <div className="space-y-2 text-[11px]">
      <label className={LABEL_CLS}>
        {f('family')}
        <select
          className={INPUT_CLS}
          value={el.familyTypeId ?? ''}
          key={`win-ft-${el.id}-${el.familyTypeId ?? ''}-${revision}`}
          onChange={(e) => onPersistProperty('familyTypeId', e.target.value)}
        >
          <option value="">Generic</option>
          {windowFamilies.map((fam) => (
            <optgroup key={fam.id} label={fam.name}>
              {fam.defaultTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </optgroup>
          ))}
          {customTypes.length > 0 && (
            <optgroup label="Custom">
              {customTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {String(ct.parameters.name ?? ct.id)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {onCreateType && !showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-[10px] text-accent hover:underline"
          >
            + New custom type…
          </button>
        ) : null}
        {onDuplicateType && el.familyTypeId ? (
          <button
            type="button"
            data-testid="inspector-window-duplicate-type"
            onClick={() => onDuplicateType(el.familyTypeId)}
            className="text-[10px] text-accent hover:underline"
          >
            Duplicate type
          </button>
        ) : null}
      </div>
      {onCreateType && showForm && (
        <CustomTypeForm
          discipline="window"
          onSave={(baseFamilyId, name, params) => {
            onCreateType(baseFamilyId, name, params);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      <MaterialAssignmentRow
        label="Material"
        materialKey={el.materialKey ?? null}
        fallback="By family/category"
        elementsById={elementsById}
        onOpenMaterialBrowser={onOpenMaterialBrowser}
        onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
      />
      <MaterialSlotsSection
        elementId={el.id}
        slots={el.materialSlots}
        rows={[
          { slot: 'frame', label: 'Frame' },
          { slot: 'sash', label: 'Sash' },
          { slot: 'glass', label: 'Glass', fallback: 'Default clear glass' },
          { slot: 'spacer', label: 'Spacer' },
          { slot: 'hardware', label: 'Hardware' },
          { slot: 'shading', label: 'Shading' },
        ]}
        elementsById={elementsById}
        onOpenMaterialBrowser={onOpenMaterialBrowser}
        onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
      />
      <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
      <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
      <FieldRow label={f('sillHeight')} value={fmtMm(el.sillHeightMm)} />
      <FieldRow label={f('wall')} value={resolveElName(el.wallId, elementsById)} />
      {onDisciplineChange ? (
        <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
      ) : null}
    </div>
  );
}

/** Editable inspector for view_template elements (Properties tab).
 *
 * VIS-V3-09: replaces the standalone ViewTemplateEditPanel floating card.
 * name is persisted via updateElementProperty; scale/detailLevel/phase/phaseFilter
 * are persisted via the __updateViewTemplate__ sentinel key which WorkspaceRightRail
 * routes to the UpdateViewTemplate engine command (same propagation path).
 */
export function InspectorViewTemplateEditor({
  el,
  elementsById,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'view_template' }>;
  elementsById?: Record<string, Element>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const { t } = useTranslation();

  const phases = elementsById
    ? (Object.values(elementsById) as Element[]).filter(
        (e): e is Extract<Element, { kind: 'phase' }> => e.kind === 'phase',
      )
    : [];

  return (
    <div className="space-y-2 text-[11px]">
      <p className="text-[10px] font-semibold text-muted">{t('inspector.viewTemplate.heading')}</p>

      <div className="rounded border border-border">
        <div className="grid grid-cols-[1fr_54px_44px] gap-1 border-b border-border px-2 py-1 text-[9px] font-semibold uppercase text-muted">
          <span>Property</span>
          <span>Include</span>
          <span>Lock</span>
        </div>
        {VIEW_TEMPLATE_CONTROL_FIELDS.map(({ field, label }) => {
          const control = viewTemplateControlState(el, field);
          return (
            <div
              key={field}
              className="grid grid-cols-[1fr_54px_44px] items-center gap-1 px-2 py-1 text-[10px]"
            >
              <span className="truncate text-muted">{label}</span>
              <input
                type="checkbox"
                data-testid={`inspector-vt-control-${field}-include`}
                aria-label={`${label} include`}
                checked={control.included}
                onChange={(e) => {
                  const included = e.target.checked;
                  onPersistProperty(
                    '__updateViewTemplate__',
                    viewTemplateControlPatch(field, included, included ? control.locked : false),
                  );
                }}
              />
              <input
                type="checkbox"
                data-testid={`inspector-vt-control-${field}-lock`}
                aria-label={`${label} lock`}
                checked={control.locked}
                disabled={!control.included}
                onChange={(e) => {
                  onPersistProperty(
                    '__updateViewTemplate__',
                    viewTemplateControlPatch(field, control.included, e.target.checked),
                  );
                }}
              />
            </div>
          );
        })}
      </div>

      <label className={LABEL_CLS}>
        {t('inspector.fields.name')}
        <input
          className={INPUT_CLS}
          defaultValue={el.name}
          key={`vt-name-${el.id}-${el.name}-${revision}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v || v === el.name) return;
            onPersistProperty('name', v);
          }}
        />
      </label>

      <label className={LABEL_CLS}>
        {t('inspector.fields.scale')}
        <input
          type="number"
          className={INPUT_CLS}
          defaultValue={el.scale != null ? String(el.scale) : ''}
          key={`vt-scale-${el.id}-${el.scale ?? 'null'}-${revision}`}
          placeholder="inherit"
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const n = raw === '' ? null : Number(raw);
            if (n !== null && !Number.isFinite(n)) return;
            onPersistProperty('__updateViewTemplate__', JSON.stringify({ scale: n }));
          }}
        />
      </label>

      <label className={LABEL_CLS}>
        {t('inspector.fields.detailLevel', 'Detail level')}
        <select
          className={INPUT_CLS}
          value={el.detailLevel ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onPersistProperty('__updateViewTemplate__', JSON.stringify({ detailLevel: v || null }));
          }}
        >
          <option value="">— inherit —</option>
          <option value="coarse">Coarse</option>
          <option value="medium">Medium</option>
          <option value="fine">Fine</option>
        </select>
      </label>

      {phases.length > 0 ? (
        <label className={LABEL_CLS}>
          {t('inspector.fields.phase', 'Phase')}
          <select
            className={INPUT_CLS}
            value={el.phase ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onPersistProperty('__updateViewTemplate__', JSON.stringify({ phase: v || null }));
            }}
          >
            <option value="">— none —</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className={LABEL_CLS}>
        {t('inspector.fields.phaseFilter', 'Phase filter')}
        <select
          className={INPUT_CLS}
          value={el.phaseFilter ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onPersistProperty('__updateViewTemplate__', JSON.stringify({ phaseFilter: v || null }));
          }}
        >
          <option value="">— none —</option>
          <option value="all">All</option>
          <option value="existing">Existing</option>
          <option value="demolition">Demolition</option>
          <option value="new">New</option>
        </select>
      </label>
    </div>
  );
}

export {
  InspectorProjectSettingsEditor,
  InspectorPlanRegionEditor,
} from './projectSettingsInspectorSection';
