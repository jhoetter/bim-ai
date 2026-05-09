import type { JSX } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Element } from '@bim-ai/core';

import { AdvisorPanel } from '../advisor/AdvisorPanel';
import { buildPlanGridDatumInspectorLine } from './planViewDatumGridReadout';
import { useBimStore } from '../state/store';
import { SunInspectorPanel } from './SunInspectorPanel';
import { Inspector, type InspectorApplyScope, type InspectorSelection } from './Inspector';
import {
  InspectorConstraintsFor,
  InspectorDoorEditor,
  InspectorGraphicsFor,
  InspectorIdentityFor,
  InspectorPlanViewEditor,
  InspectorPropertiesFor,
  InspectorRoomEditor,
  InspectorViewpointEditor,
  InspectorViewTemplateEditor,
  InspectorWindowEditor,
} from './InspectorContent';
import type { DisciplineTag } from '@bim-ai/core';
import { AuthoringWorkbenchesPanel } from './AuthoringWorkbenchesPanel';
import { Viewport3DLayersPanel } from './Viewport3DLayersPanel';
import type { WorkspaceMode } from './TopBar';
import { humanKindLabel, InspectorEmptyTab } from './WorkspaceHelpers';

export function WorkspaceRightRail({
  mode,
  onSemanticCommand,
  onModeChange,
  codePresetIds,
}: {
  mode: WorkspaceMode;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  onModeChange: (mode: WorkspaceMode) => void;
  codePresetIds: string[];
}): JSX.Element {
  const { t } = useTranslation();
  const selectedId = useBimStore((s) => s.selectedId);
  const elementsById = useBimStore((s) => s.elementsById);
  const revision = useBimStore((s) => s.revision);
  const activeLevelId = useBimStore((s) => s.activeLevelId);
  const viewerCategoryHidden = useBimStore((s) => s.viewerCategoryHidden);
  const toggleViewerCategoryHidden = useBimStore((s) => s.toggleViewerCategoryHidden);
  const viewerClipElevMm = useBimStore((s) => s.viewerClipElevMm);
  const setViewerClipElevMm = useBimStore((s) => s.setViewerClipElevMm);
  const viewerClipFloorElevMm = useBimStore((s) => s.viewerClipFloorElevMm);
  const setViewerClipFloorElevMm = useBimStore((s) => s.setViewerClipFloorElevMm);
  const activeViewpointId = useBimStore((s) => s.activeViewpointId);
  const violations = useBimStore((s) => s.violations);
  const buildingPreset = useBimStore((s) => s.buildingPreset);
  const setBuildingPreset = useBimStore((s) => s.setBuildingPreset);
  const perspectiveId = useBimStore((s) => s.perspectiveId);
  const activityEvents = useBimStore((s) => s.activityEvents);
  const setPlanTool = useBimStore((s) => s.setPlanTool);
  const planProjectionPrimitives = useBimStore((s) => s.planProjectionPrimitives);

  const el = selectedId ? (elementsById[selectedId] as Element | undefined) : undefined;
  const show3dLayers = mode === '3d' || (mode as string) === 'plan-3d';

  // CHR-V3-06: sibling count for the applies-to radio.
  const siblingCount = useMemo(() => {
    if (!el) return 1;
    return Object.values(elementsById).filter((e) => (e as Element).kind === el.kind).length;
  }, [el, elementsById]);

  // CHR-V3-06: non-blocking toast when "all N" scope is selected.
  const [allScopeToast, setAllScopeToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleApplyScopeChange = useCallback(
    (scope: InspectorApplyScope) => {
      if (scope === 'all' && el) {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setAllScopeToast(`Edits will apply to all ${siblingCount} ${el.kind} elements.`);
        toastTimerRef.current = setTimeout(() => setAllScopeToast(null), 4000);
      } else {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setAllScopeToast(null);
      }
    },
    [el, siblingCount],
  );

  function handleDisciplineChange(discipline: DisciplineTag | null): void {
    if (!el) return;
    void onSemanticCommand({
      type: 'setElementDiscipline',
      elementIds: [el.id],
      discipline,
    });
  }

  const inspectorSelection = useMemo<InspectorSelection | null>(() => {
    if (!selectedId) return null;
    const found = elementsById[selectedId];
    if (!found) return null;
    return {
      label: `${humanKindLabel(found.kind)} · ${(found as { name?: string }).name ?? found.id}`,
      id: found.id,
    };
  }, [elementsById, selectedId]);

  const planGridDatumLine = useMemo(() => {
    if (!selectedId) return '';
    const found = elementsById[selectedId];
    if (!found || found.kind !== 'plan_view') return '';
    return buildPlanGridDatumInspectorLine(elementsById, planProjectionPrimitives, found.id);
  }, [selectedId, elementsById, planProjectionPrimitives]);

  return (
    <div className="h-full overflow-y-auto">
      {/* CHR-V3-06: non-blocking scope toast */}
      {allScopeToast ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '1rem',
            right: '1rem',
            zIndex: 50,
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: 'var(--text-sm)',
            backgroundColor: 'var(--color-surface-2)',
            boxShadow: 'var(--shadow-modal)',
            animation: 'slide-up 200ms var(--ease-paper) both',
          }}
        >
          {allScopeToast}
        </div>
      ) : null}
      {/* VIS-V3-04: Scene section — visible when no element is selected */}
      {!selectedId ? (
        <div className="border-b border-border p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Scene
          </div>
          <SunInspectorPanel />
        </div>
      ) : null}
      {/* CHR-V3-06: key={selectedId} remounts (and re-animates) Inspector on each selection */}
      <div style={{ position: 'relative' }}>
        <Inspector
          key={selectedId ?? 'none'}
          selection={inspectorSelection}
          siblingCount={siblingCount}
          onApplyScopeChange={handleApplyScopeChange}
          tabs={{
            properties: el ? (
              el.kind === 'plan_view' ? (
                <>
                  {planGridDatumLine ? (
                    <p className="mb-2 break-all font-mono text-[10px] leading-snug text-muted">
                      {planGridDatumLine}
                    </p>
                  ) : null}
                  <InspectorPlanViewEditor
                    el={el}
                    elementsById={elementsById}
                    revision={revision}
                    onPersistProperty={(key, value) => {
                      if (key === '__applyTemplate__') {
                        const p = JSON.parse(value) as {
                          planViewId: string;
                          templateId: string;
                        };
                        void onSemanticCommand({ type: 'applyPlanViewTemplate', ...p });
                      } else {
                        void onSemanticCommand({
                          type: 'updateElementProperty',
                          elementId: el.id,
                          key,
                          value,
                        });
                      }
                    }}
                  />
                </>
              ) : el.kind === 'room' ? (
                <InspectorRoomEditor
                  el={el}
                  revision={revision}
                  onPersistProperty={(key, value) =>
                    void onSemanticCommand({
                      type: 'updateElementProperty',
                      elementId: el.id,
                      key,
                      value,
                    })
                  }
                />
              ) : el.kind === 'viewpoint' ? (
                <InspectorViewpointEditor
                  el={el}
                  revision={revision}
                  onPersistProperty={(key, value) =>
                    void onSemanticCommand({
                      type: 'updateElementProperty',
                      elementId: el.id,
                      key,
                      value,
                    })
                  }
                />
              ) : el.kind === 'view_template' ? (
                <InspectorViewTemplateEditor
                  el={el}
                  elementsById={elementsById}
                  revision={revision}
                  onPersistProperty={(key, value) => {
                    if (key === '__updateViewTemplate__') {
                      const patch = JSON.parse(value) as {
                        scale?: number | null;
                        detailLevel?: string | null;
                        phase?: string | null;
                        phaseFilter?: string | null;
                      };
                      void onSemanticCommand({
                        type: 'UpdateViewTemplate',
                        templateId: el.id,
                        ...patch,
                      });
                    } else {
                      void onSemanticCommand({
                        type: 'updateElementProperty',
                        elementId: el.id,
                        key,
                        value,
                      });
                    }
                  }}
                />
              ) : el.kind === 'door' ? (
                <InspectorDoorEditor
                  el={el}
                  revision={revision}
                  elementsById={elementsById}
                  onPersistProperty={(key, value) =>
                    void onSemanticCommand({
                      type: 'updateElementProperty',
                      elementId: el.id,
                      key,
                      value,
                    })
                  }
                  onCreateType={(_baseFamilyId, _name, params) =>
                    void onSemanticCommand({
                      type: 'upsertFamilyType',
                      discipline: 'door',
                      parameters: params,
                    })
                  }
                  onDisciplineChange={handleDisciplineChange}
                />
              ) : el.kind === 'window' ? (
                <InspectorWindowEditor
                  el={el}
                  revision={revision}
                  elementsById={elementsById}
                  onPersistProperty={(key, value) =>
                    void onSemanticCommand({
                      type: 'updateElementProperty',
                      elementId: el.id,
                      key,
                      value,
                    })
                  }
                  onCreateType={(_baseFamilyId, _name, params) =>
                    void onSemanticCommand({
                      type: 'upsertFamilyType',
                      discipline: 'window',
                      parameters: params,
                    })
                  }
                  onDisciplineChange={handleDisciplineChange}
                />
              ) : (
                InspectorPropertiesFor(el, t, {
                  elementsById,
                  onPropertyChange: (property, value) =>
                    void onSemanticCommand({
                      type: 'updateElementProperty',
                      elementId: el.id,
                      key: property,
                      value,
                    }),
                  onDisciplineChange: handleDisciplineChange,
                })
              )
            ) : (
              <InspectorEmptyTab message="No element selected." />
            ),
            constraints: el ? (
              InspectorConstraintsFor(el, t)
            ) : (
              <InspectorEmptyTab message="No element selected." />
            ),
            identity: el ? (
              InspectorIdentityFor(el, t)
            ) : (
              <InspectorEmptyTab message="No element selected." />
            ),
            graphics:
              el && (el.kind === 'plan_view' || el.kind === 'view_template') ? (
                <InspectorGraphicsFor
                  el={el}
                  elementsById={elementsById}
                  revision={revision}
                  onPersistProperty={(key, value) =>
                    void onSemanticCommand({
                      type: 'updateElementProperty',
                      elementId: el.id,
                      key,
                      value,
                    })
                  }
                />
              ) : undefined,
          }}
          emptyStateActions={[
            {
              hotkey: 'W',
              label: 'Draw a wall',
              onTrigger: () => {
                if (mode !== 'plan' && (mode as string) !== 'plan-3d') onModeChange('plan');
                setPlanTool('wall');
              },
            },
            {
              hotkey: 'D',
              label: 'Insert a door',
              onTrigger: () => {
                if (mode !== 'plan' && (mode as string) !== 'plan-3d') onModeChange('plan');
                setPlanTool('door');
              },
            },
            {
              hotkey: 'M',
              label: 'Drop a room marker',
              onTrigger: () => {
                if (mode !== 'plan' && (mode as string) !== 'plan-3d') onModeChange('plan');
                setPlanTool('room');
              },
            },
          ]}
          onClearSelection={() => useBimStore.getState().select(undefined)}
        />
      </div>
      {show3dLayers ? (
        <div className="border-t border-border">
          <Viewport3DLayersPanel
            viewerCategoryHidden={viewerCategoryHidden}
            onToggleCategory={toggleViewerCategoryHidden}
            viewerClipElevMm={viewerClipElevMm}
            onSetClipElevMm={setViewerClipElevMm}
            viewerClipFloorElevMm={viewerClipFloorElevMm}
            onSetClipFloorElevMm={setViewerClipFloorElevMm}
            activeViewpointId={activeViewpointId ?? undefined}
          />
        </div>
      ) : null}
      <div className="border-t border-border">
        <AuthoringWorkbenchesPanel
          selected={el}
          elementsById={elementsById}
          activeLevelId={activeLevelId ?? ''}
          onUpsertSemantic={(cmd) => void onSemanticCommand(cmd)}
        />
      </div>
      <div className="border-t border-border p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
          {t('advisor.heading')}
        </div>
        <AdvisorPanel
          violations={violations}
          selectionId={selectedId ?? undefined}
          preset={buildingPreset}
          onPreset={setBuildingPreset}
          codePresets={codePresetIds}
          onApplyQuickFix={(cmd) => void onSemanticCommand(cmd)}
          perspective={perspectiveId}
        />
      </div>
      {activityEvents.length > 0 ? (
        <div className="border-t border-border p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {t('activity.heading')}
          </div>
          <ul className="space-y-1 text-[11px] text-muted">
            {activityEvents.map((a) => (
              <li key={a.id}>
                r{a.revisionAfter} · {a.commandTypes[0] ?? '?'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
