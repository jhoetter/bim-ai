import type { JSX } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Element } from '@bim-ai/core';

import { AdvisorPanel } from '../advisor/AdvisorPanel';
import { buildPlanGridDatumInspectorLine } from './planViewDatumGridReadout';
import { useBimStore } from '../state/store';
import { Inspector, type InspectorSelection } from './Inspector';
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
  const show3dLayers = mode === '3d' || mode === 'plan-3d';

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
      <div>
        <Inspector
          selection={inspectorSelection}
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
                if (mode !== 'plan' && mode !== 'plan-3d') onModeChange('plan');
                setPlanTool('wall');
              },
            },
            {
              hotkey: 'D',
              label: 'Insert a door',
              onTrigger: () => {
                if (mode !== 'plan' && mode !== 'plan-3d') onModeChange('plan');
                setPlanTool('door');
              },
            },
            {
              hotkey: 'M',
              label: 'Drop a room marker',
              onTrigger: () => {
                if (mode !== 'plan' && mode !== 'plan-3d') onModeChange('plan');
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
