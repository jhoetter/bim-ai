import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import type { DisciplineTag, Element } from '@bim-ai/core';

import { FieldRow } from './inspectorRows';
import { MaterialSlotsSection, type OpenMaterialBrowser } from './materialInspectorSections';
import { StairAssemblySection } from './stairAssemblyInspector';
import { InspectorDisciplineDropdown } from './InspectorContent';
import { stairBoundaryMm } from '../../plan/stairBoundingBox';

type StairEditRunDraft = {
  runIndex: number;
  riserCount?: number;
  runWidthMm?: number;
};
type StairEditInspectorElement = Extract<Element, { kind: 'stair' }> & {
  editStairActive?: boolean;
  runs?: StairEditRunDraft[];
  riserCount?: number;
  runWidthMm?: number;
};

interface StairInspectorSectionProps {
  el: Extract<Element, { kind: 'stair' }>;
  t: TFunction;
  options?: {
    onPropertyChange?: (property: string, value: unknown) => void;
  };
  elementsById: Record<string, Element>;
  onOpenMaterialBrowser?: OpenMaterialBrowser;
  onOpenAppearanceAssetBrowser?: OpenMaterialBrowser;
  onDispatchCommand?: (cmd: Record<string, unknown>) => void;
  onSemanticCommand?: (cmd: Record<string, unknown>) => void;
  onDisciplineChange?: (discipline: DisciplineTag | null) => void;
}

export function StairInspectorSection({
  el,
  t,
  options,
  elementsById,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
  onDispatchCommand,
  onSemanticCommand,
  onDisciplineChange,
}: StairInspectorSectionProps): JSX.Element {
  const f = (key: string) => t(`inspector.fields.${key}`);
  const resolveElName = (id: string | null | undefined, eb: Record<string, Element>): string => {
    if (!id) return '—';
    const target = eb[id];
    return target ? ((target as { name?: string }).name ?? id) : id;
  };
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
            <span className="font-mono text-[10px] text-muted">{el.linkedShaftId.slice(0, 8)}</span>
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
      <div style={{ marginTop: 8, borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
        {(el as StairEditInspectorElement).editStairActive ? (
          <>
            <strong data-testid="inspector-stair-edit-mode-active">Edit Mode</strong>
            {(
              (el as StairEditInspectorElement).runs ?? [
                {
                  runIndex: 0,
                  riserCount: (el as StairEditInspectorElement).riserCount ?? 10,
                  runWidthMm: (el as StairEditInspectorElement).runWidthMm ?? 1200,
                },
              ]
            ).map((run: StairEditRunDraft) => (
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
            onClick={() => void onDispatchCommand?.({ type: 'enterStairEditMode', stairId: el.id })}
          >
            Edit Stair
          </button>
        )}
      </div>
      {/* §8.6.2: Stair Assembly — list linked run/landing components */}
      <StairAssemblySection
        stairId={el.id}
        elementsById={elementsById}
        onSemanticCommand={onDispatchCommand}
      />
    </div>
  );
}
