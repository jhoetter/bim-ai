import { Suspense, lazy } from 'react';
import type { Dispatch, JSX, RefObject, SetStateAction } from 'react';
import type { AssetLibraryEntry, Element, PerspectiveId, Violation } from '@bim-ai/core';

import { AdvisorPanel } from '../advisor/AdvisorPanel';
import { PasteToLevelsDialog } from '../clipboard/PasteToLevelsDialog';
import { ActivityDrawer } from '../collab/ActivityDrawer';
import { MilestoneDialog } from '../collab/MilestoneDialog';
import { SharePresentationModal } from '../collab/SharePresentationModal';
import { CheatsheetModal } from '../cmd/CheatsheetModal';
import { AppearanceAssetBrowserDialog } from '../familyEditor/AppearanceAssetBrowserDialog';
import { MaterialBrowserDialog } from '../familyEditor/MaterialBrowserDialog';
// PERF-J04: lazy-load heavy / open-on-demand panels so they don't ship
// in the eager workspace bundle. Each becomes its own chunk; the first
// time the user opens the surface, we pay one network round-trip;
// subsequent opens are instant from cache.
const FamilyLibraryPanel = lazy(() =>
  import('../families/FamilyLibraryPanel').then((m) => ({
    default: m.FamilyLibraryPanel,
  })),
);
import type {
  ExternalCatalogPlacement,
  FamilyLibraryArrayFormulaUpdate,
  FamilyLibraryPlaceKind,
} from '../families/FamilyLibraryPanel';
import type { FamilyReloadOverwriteOption } from '../families/catalogFamilyReload';
import { CreateGroupDialog } from '../groups/CreateGroupDialog';
import { GroupEditModeBar } from '../groups/GroupEditModeBar';
import { applyCreateGroup } from '../groups/groupCommands';
import type { GroupRegistry } from '../groups/groupTypes';
import { JobsPanel } from '../jobs/JobsPanel';
import type { ClearanceViolation } from '../plan/openingClearance';
import { SelectionFilterDialog } from '../plan/selectionFilter';
import { buildTerraceRailing } from '../plan/terraceFromFloor';
import { Save3dViewAsDialog } from '../Save3dViewAsDialog';
import { useBimStore, type UxComment } from '../state/store';
import { createToposolidFromDxf } from '../tools/dxfContourImport';
import type { MaterialBrowserTargetRequest } from './inspector';
import { OnboardingTour } from '../onboarding/OnboardingTour';
import { ClearanceViolationPanel } from './ClearanceViolationPanel';
import { CommentsPanel } from './comments';
import { LibraryOverlay } from './library';
import { ManageGlobalParamsDialog, type SimpleGlobalParam } from './ManageGlobalParamsDialog';
import { PerViewVGDialog } from './PerViewVGDialog';
import {
  ManageLinksDialog,
  ProjectInfoDialog,
  ProjectMenu,
  ProjectSetupDialog,
  ProjectUnitsDialog,
  VVDialog,
  type ProjectMenuItemRecent,
  type ProjectMenuSeedModel,
} from './project';
import { GlobalParamsDialog } from './project/GlobalParamsDialog';
import { uploadDxfFile } from '../lib/api';
import { ManagePhasesDialog } from './phases/ManagePhasesDialog';
import { PhaseManagerDialog } from '../phases/PhaseManagerDialog';
import { AppSettingsPanel } from './AppSettingsPanel';
import { DimensionStyleDialog } from './DimensionStyleDialog';
import { DxfImportDialog } from './DxfImportDialog';
import { ProjectTemplatesDialog } from './ProjectTemplatesDialog';
// PERF-J04: project version history is open-on-demand.
const ProjectVersionHistoryPanel = lazy(() =>
  import('./ProjectVersionHistoryPanel').then((m) => ({
    default: m.ProjectVersionHistoryPanel,
  })),
);
import { SetWorkPlaneDialog } from './SetWorkPlaneDialog';
import { TerracePresetDialog } from './TerracePresetDialog';
import { VisibilityGraphicsDialog } from './VisibilityGraphicsDialog';
import { PrintPlotDialog } from './sheets/PrintPlotDialog';

type BooleanSetter = Dispatch<SetStateAction<boolean>>;
type NullableStringSetter = Dispatch<SetStateAction<string | null>>;
type SemanticCommand = (cmd: Record<string, unknown>) => void | Promise<void>;
type DxfExportOptions = { levelId?: string; units: 'mm' | 'm' };
type AdvisorCounts = { error: number; warning: number; info: number };
type SheetPage = { id: string; name: string };
type LibraryDiscipline = 'arch' | 'struct' | 'mep' | 'all';

export interface WorkspaceOverlaysProps {
  elementsById: Record<string, Element>;
  modelId: string | null | undefined;
  revision: number | null | undefined;
  userId: string | null | undefined;
  userDisplayName: string | null | undefined;
  activeLevelId: string | null | undefined;
  activePlanViewId: string | null | undefined;
  activeWorkspaceId: string;
  selectedId: string | null | undefined;
  selectedIds: string[];
  projectNameRef: RefObject<HTMLElement | null>;
  recentProjects: ProjectMenuItemRecent[];
  seedModels: ProjectMenuSeedModel[];
  activeSeedLabel: string | null | undefined;
  saveAsMaximumBackups: number;
  sheetPages: SheetPage[];
  comments: UxComment[];
  commentOutsideScopeNote: string | null;
  advisorCounts: AdvisorCounts;
  unifiedAdvisorViolations: Violation[];
  buildingPreset: string;
  codePresetIds: string[];
  perspectiveId: PerspectiveId;
  activeMaterialKey: string | null;
  activeMaterialTargetLabel: string | null;
  groupRegistry: GroupRegistry;
  clearanceViolations: ClearanceViolation[];
  activityIsOpen: boolean;
  libraryDiscipline: LibraryDiscipline;
  vvDialogOpen: boolean;

  cheatsheetOpen: boolean;
  setCheatsheetOpen: BooleanSetter;
  printPlotOpen: boolean;
  setPrintPlotOpen: BooleanSetter;
  save3dViewAsOpen: boolean;
  setSave3dViewAsOpen: BooleanSetter;
  familyLibraryOpen: boolean;
  setFamilyLibraryOpen: BooleanSetter;
  materialBrowserOpen: boolean;
  setMaterialBrowserOpen: BooleanSetter;
  appearanceAssetBrowserOpen: boolean;
  setAppearanceAssetBrowserOpen: BooleanSetter;
  clearActiveMaterialBrowserTarget: () => void;
  tourOpen: boolean;
  setTourOpen: BooleanSetter;
  templatesOpen: boolean;
  setTemplatesOpen: BooleanSetter;
  versionHistoryOpen: boolean;
  setVersionHistoryOpen: BooleanSetter;
  appSettingsOpen: boolean;
  setAppSettingsOpen: BooleanSetter;
  advisorOpen: boolean;
  setAdvisorOpen: BooleanSetter;
  jobsOpen: boolean;
  setJobsOpen: BooleanSetter;
  commentsOpen: boolean;
  setCommentsOpen: BooleanSetter;
  projectMenuOpen: boolean;
  setProjectMenuOpen: BooleanSetter;
  projectSetupOpen: boolean;
  setProjectSetupOpen: BooleanSetter;
  manageLinksOpen: boolean;
  setManageLinksOpen: BooleanSetter;
  dxfImportOpen: boolean;
  setDxfImportOpen: BooleanSetter;
  projectUnitsOpen: boolean;
  setProjectUnitsOpen: BooleanSetter;
  phaseManagerOpen: boolean;
  setPhaseManagerOpen: BooleanSetter;
  managePhasesOpen: boolean;
  setManagePhasesOpen: BooleanSetter;
  globalParamsOpen: boolean;
  setGlobalParamsOpen: BooleanSetter;
  vgOpen: boolean;
  setVgOpen: BooleanSetter;
  perViewVGOpen: boolean;
  setPerViewVGOpen: BooleanSetter;
  setWorkPlaneOpen: boolean;
  setSetWorkPlaneOpen: BooleanSetter;
  manageGlobalParamsOpen: boolean;
  setManageGlobalParamsOpen: BooleanSetter;
  dimStyleOpen: boolean;
  setDimStyleOpen: BooleanSetter;
  projectInfoOpen: boolean;
  setProjectInfoOpen: BooleanSetter;
  milestoneDialogOpen: boolean;
  setMilestoneDialogOpen: BooleanSetter;
  pasteToLevelsOpen: boolean;
  setPasteToLevelsOpen: BooleanSetter;
  selectionFilterOpen: boolean;
  setSelectionFilterOpen: BooleanSetter;
  createGroupOpen: boolean;
  setCreateGroupOpen: BooleanSetter;
  sharePresentationOpen: boolean;
  setSharePresentationOpen: BooleanSetter;
  libraryOpen: boolean;
  setLibraryOpen: BooleanSetter;
  terraceFloorId: string | null;
  setTerraceFloorId: NullableStringSetter;
  setClearanceViolations: Dispatch<SetStateAction<ClearanceViolation[]>>;

  onSemanticCommand: SemanticCommand;
  commitSave3dViewWithName: (name: string) => void;
  handlePlaceFamilyType: (kind: FamilyLibraryPlaceKind, typeId: string) => void;
  handlePlaceCatalogFamily: (
    placement: ExternalCatalogPlacement,
    overwriteOption?: FamilyReloadOverwriteOption,
  ) => void | Promise<void>;
  handleLoadCatalogFamily: (
    placement: ExternalCatalogPlacement,
    overwriteOption?: FamilyReloadOverwriteOption,
  ) => void | Promise<void>;
  handleUpdateArrayFormula: (update: FamilyLibraryArrayFormulaUpdate) => void | Promise<void>;
  assignMaterialToTarget: (materialKey: string) => void;
  setBuildingPreset: (preset: string) => void;
  openElementById: (elementId: string) => void;
  handleCommentPost: (body: string) => Promise<void>;
  handleCommentResolve: (commentId: string, resolved: boolean) => Promise<void>;
  handlePickRecent: (id: string) => void;
  loadSeedModel: (id: string) => void | Promise<void>;
  insertSeedHouse: () => void | Promise<void>;
  handleSaveSnapshot: () => void;
  handleSaveAsMaximumBackupsChange: (maximumBackups: number) => void;
  handleRestoreSnapshot: (file: File) => void | Promise<void>;
  openMilestoneDialog: () => void;
  openMaterialBrowser: (target?: MaterialBrowserTargetRequest) => void;
  openAppearanceAssetBrowser: (target?: MaterialBrowserTargetRequest) => void;
  handleNewClear: () => void;
  replayOnboardingTour: () => void;
  handleExportIfc: () => void;
  handleExportDxf: (options: DxfExportOptions) => void;
  handleExportDwg: () => void;
  handleExportDgn: () => void;
  handleDuplicateProject: (newName: string) => void;
  handleRevertProject: () => void;
  closeVVDialog: () => void;
  setGroupRegistry: (registry: GroupRegistry) => void;
  closeActivityDrawer: () => void;
  handleLibraryPlace: (
    entry: AssetLibraryEntry,
    paramValues: Record<string, unknown>,
  ) => void | Promise<void>;
}

export function WorkspaceOverlays({
  elementsById,
  modelId,
  revision,
  userId,
  userDisplayName,
  activeLevelId,
  activePlanViewId,
  activeWorkspaceId: _activeWorkspaceId,
  selectedId,
  selectedIds,
  projectNameRef,
  recentProjects,
  seedModels,
  activeSeedLabel,
  saveAsMaximumBackups,
  sheetPages,
  comments,
  commentOutsideScopeNote,
  advisorCounts,
  unifiedAdvisorViolations,
  buildingPreset,
  codePresetIds,
  perspectiveId,
  activeMaterialKey,
  activeMaterialTargetLabel,
  groupRegistry,
  clearanceViolations,
  activityIsOpen,
  libraryDiscipline,
  vvDialogOpen,
  cheatsheetOpen,
  setCheatsheetOpen,
  printPlotOpen,
  setPrintPlotOpen,
  save3dViewAsOpen,
  setSave3dViewAsOpen,
  familyLibraryOpen,
  setFamilyLibraryOpen,
  materialBrowserOpen,
  setMaterialBrowserOpen,
  appearanceAssetBrowserOpen,
  setAppearanceAssetBrowserOpen,
  clearActiveMaterialBrowserTarget,
  tourOpen,
  setTourOpen,
  templatesOpen,
  setTemplatesOpen,
  versionHistoryOpen,
  setVersionHistoryOpen,
  appSettingsOpen,
  setAppSettingsOpen,
  advisorOpen,
  setAdvisorOpen,
  jobsOpen,
  setJobsOpen,
  commentsOpen,
  setCommentsOpen,
  projectMenuOpen,
  setProjectMenuOpen,
  projectSetupOpen,
  setProjectSetupOpen,
  manageLinksOpen,
  setManageLinksOpen,
  dxfImportOpen,
  setDxfImportOpen,
  projectUnitsOpen,
  setProjectUnitsOpen,
  phaseManagerOpen,
  setPhaseManagerOpen,
  managePhasesOpen,
  setManagePhasesOpen,
  globalParamsOpen,
  setGlobalParamsOpen,
  vgOpen,
  setVgOpen,
  perViewVGOpen,
  setPerViewVGOpen,
  setWorkPlaneOpen,
  setSetWorkPlaneOpen,
  manageGlobalParamsOpen,
  setManageGlobalParamsOpen,
  dimStyleOpen,
  setDimStyleOpen,
  projectInfoOpen,
  setProjectInfoOpen,
  milestoneDialogOpen,
  setMilestoneDialogOpen,
  pasteToLevelsOpen,
  setPasteToLevelsOpen,
  selectionFilterOpen,
  setSelectionFilterOpen,
  createGroupOpen,
  setCreateGroupOpen,
  sharePresentationOpen,
  setSharePresentationOpen,
  libraryOpen,
  setLibraryOpen,
  terraceFloorId,
  setTerraceFloorId,
  setClearanceViolations,
  onSemanticCommand,
  commitSave3dViewWithName,
  handlePlaceFamilyType,
  handlePlaceCatalogFamily,
  handleLoadCatalogFamily,
  handleUpdateArrayFormula,
  assignMaterialToTarget,
  setBuildingPreset,
  openElementById,
  handleCommentPost,
  handleCommentResolve,
  handlePickRecent,
  loadSeedModel,
  insertSeedHouse,
  handleSaveSnapshot,
  handleSaveAsMaximumBackupsChange,
  handleRestoreSnapshot,
  openMilestoneDialog,
  openMaterialBrowser,
  openAppearanceAssetBrowser,
  handleNewClear,
  replayOnboardingTour,
  handleExportIfc,
  handleExportDxf,
  handleExportDwg,
  handleExportDgn,
  handleDuplicateProject,
  handleRevertProject,
  closeVVDialog,
  setGroupRegistry,
  closeActivityDrawer,
  handleLibraryPlace,
}: WorkspaceOverlaysProps): JSX.Element {
  const projectSettings = Object.values(elementsById).find((e) => e.kind === 'project_settings') as
    | (Extract<Element, { kind: 'project_settings' }> & {
        checkpointRetentionLimit?: unknown;
        dimensionStyle?: Record<string, unknown>;
        dxfLayerMapping?: Record<string, string>;
        globalParams?: unknown[];
      })
    | undefined;
  const referencePlanes = Object.values(elementsById)
    .filter(
      (e): e is Extract<(typeof elementsById)[string] & object, { kind: 'reference_plane' }> =>
        e != null && e.kind === 'reference_plane' && 'levelId' in e,
    )
    .map((rp) => ({ id: rp.id, name: (rp as { name?: string }).name ?? '' }));
  const phases = Object.values(elementsById).filter(
    (e): e is Extract<(typeof elementsById)[string], { kind: 'phase' }> => e.kind === 'phase',
  );
  const activePlanView =
    activePlanViewId && elementsById[activePlanViewId]?.kind === 'plan_view'
      ? (elementsById[activePlanViewId] as Extract<Element, { kind: 'plan_view' }>)
      : null;
  const assetEntries = Object.values(elementsById)
    .filter((e) => (e as { kind: string }).kind === 'asset_library_entry')
    .map((e) => {
      const a = e as unknown as Record<string, unknown>;
      return {
        id: String(a['id']),
        assetKind: (a['assetKind'] ?? 'block_2d') as import('@bim-ai/core').AssetKind,
        name: String(a['name']),
        tags: (a['tags'] as string[]) ?? [],
        category: a['category'] as import('@bim-ai/core').AssetCategory,
        disciplineTags: a['disciplineTags'] as
          | import('@bim-ai/core').AssetDisciplineTag[]
          | undefined,
        thumbnailKind: ((a['thumbnailKind'] as string) ?? 'schematic_plan') as
          | 'schematic_plan'
          | 'rendered_3d',
        thumbnailMm:
          a['thumbnailWidthMm'] != null
            ? {
                widthMm: a['thumbnailWidthMm'] as number,
                heightMm: (a['thumbnailHeightMm'] as number) ?? 60,
              }
            : undefined,
        planSymbolKind: a['planSymbolKind'] as import('@bim-ai/core').AssetSymbolKind | undefined,
        renderProxyKind: a['renderProxyKind'] as import('@bim-ai/core').AssetSymbolKind | undefined,
        paramSchema: a['paramSchema'] as import('@bim-ai/core').ParamSchemaEntry[] | undefined,
        description: a['description'] as string | undefined,
      };
    });

  return (
    <>
      <GroupEditModeBar />
      <CheatsheetModal open={cheatsheetOpen} onClose={() => setCheatsheetOpen(false)} />
      <PrintPlotDialog open={printPlotOpen} onClose={() => setPrintPlotOpen(false)} sheets={[]} />
      <Save3dViewAsDialog
        isOpen={save3dViewAsOpen}
        suggestedName={`Saved 3D View ${Object.values(elementsById).filter((e) => e.kind === 'saved_view').length + 1}`}
        onSave={commitSave3dViewWithName}
        onCancel={() => setSave3dViewAsOpen(false)}
      />
      {/* PERF-J04: keep the always-mounted contract that downstream
          tests rely on, but the chunk itself is lazy so the JS is
          deferred until the FamilyLibraryPanel surface is needed
          (the panel internally renders null while closed). */}
      <Suspense fallback={null}>
        <FamilyLibraryPanel
          open={familyLibraryOpen}
          onClose={() => setFamilyLibraryOpen(false)}
          elementsById={elementsById}
          onPlaceType={handlePlaceFamilyType}
          onPlaceCatalogFamily={handlePlaceCatalogFamily}
          onLoadCatalogFamily={handleLoadCatalogFamily}
          onUpdateArrayFormula={handleUpdateArrayFormula}
          onImportLibraryFamilies={(families) => {
            const { elementsById: cur } = useBimStore.getState();
            useBimStore.setState({
              elementsById: {
                ...cur,
                ...Object.fromEntries(
                  families.map((family) => {
                    const id = cur[family.id] ? `fam-import-${Date.now()}-${family.id}` : family.id;
                    return [id, { ...family, id }];
                  }),
                ),
              },
            });
          }}
        />
      </Suspense>
      {materialBrowserOpen ? (
        <MaterialBrowserDialog
          currentKey={activeMaterialKey}
          targetLabel={activeMaterialTargetLabel}
          elementsById={elementsById}
          onAssign={(materialKey) => {
            assignMaterialToTarget(materialKey);
            setMaterialBrowserOpen(false);
            clearActiveMaterialBrowserTarget();
          }}
          onClose={() => {
            setMaterialBrowserOpen(false);
            clearActiveMaterialBrowserTarget();
          }}
        />
      ) : null}
      {appearanceAssetBrowserOpen ? (
        <AppearanceAssetBrowserDialog
          currentKey={activeMaterialKey}
          targetLabel={activeMaterialTargetLabel}
          elementsById={elementsById}
          onReplace={(materialKey) => {
            assignMaterialToTarget(materialKey);
            setAppearanceAssetBrowserOpen(false);
            clearActiveMaterialBrowserTarget();
          }}
          onClose={() => {
            setAppearanceAssetBrowserOpen(false);
            clearActiveMaterialBrowserTarget();
          }}
        />
      ) : null}
      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
      {templatesOpen && <ProjectTemplatesDialog onClose={() => setTemplatesOpen(false)} />}
      {versionHistoryOpen ? (
        <Suspense fallback={null}>
          <ProjectVersionHistoryPanel
            modelId={modelId ?? 'empty'}
            onClose={() => setVersionHistoryOpen(false)}
            onRestore={(milestoneId) => {
              void onSemanticCommand({ type: 'restoreMilestone', milestoneId });
              setVersionHistoryOpen(false);
            }}
          />
        </Suspense>
      ) : null}
      {appSettingsOpen ? <AppSettingsPanel onClose={() => setAppSettingsOpen(false)} /> : null}
      {vvDialogOpen ? <VVDialog open={vvDialogOpen} onClose={closeVVDialog} /> : null}
      {advisorOpen ? (
        <div
          data-testid="advisor-dialog-backdrop"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 p-4 sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAdvisorOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="advisor-dialog-title"
            data-testid="advisor-dialog"
            className="flex max-h-[min(760px,calc(100vh-32px))] w-full max-w-3xl flex-col rounded border border-border bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 id="advisor-dialog-title" className="text-sm font-semibold text-foreground">
                  Advisor
                </h2>
                <p className="text-[11px] text-muted">
                  {advisorCounts.error} errors · {advisorCounts.warning} warnings ·{' '}
                  {advisorCounts.info} info
                </p>
              </div>
              <button
                type="button"
                data-testid="advisor-dialog-close"
                onClick={() => setAdvisorOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-muted hover:bg-surface-2 hover:text-foreground"
                aria-label="Close advisor"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 overflow-auto p-4">
              <AdvisorPanel
                violations={unifiedAdvisorViolations}
                preset={buildingPreset}
                onPreset={setBuildingPreset}
                codePresets={codePresetIds}
                onApplyQuickFix={(cmd) => void onSemanticCommand(cmd)}
                perspective={perspectiveId}
                showAllPerspectives
                onNavigateToElement={(elementId) => {
                  openElementById(elementId);
                  setAdvisorOpen(false);
                }}
                onIsolateElements={(elementIds) => {
                  useBimStore.getState().setTemporaryVisibility({
                    viewId: activePlanViewId ?? 'advisor',
                    mode: 'isolate',
                    categories: [],
                    elementIds,
                  });
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
      {jobsOpen ? (
        <div
          data-testid="jobs-dialog-backdrop"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 p-4 sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setJobsOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="jobs-dialog-title"
            data-testid="jobs-dialog"
            className="relative flex h-[min(760px,calc(100vh-32px))] w-full max-w-sm flex-col overflow-hidden rounded border border-border bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <h2 id="jobs-dialog-title" className="text-sm font-semibold text-foreground">
                Jobs
              </h2>
              <button
                type="button"
                data-testid="jobs-dialog-close"
                onClick={() => setJobsOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-border text-muted hover:bg-surface-2 hover:text-foreground"
                aria-label="Close jobs"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <JobsPanel />
            </div>
          </div>
        </div>
      ) : null}
      {commentsOpen ? (
        <div
          data-testid="comments-overlay"
          style={{ position: 'fixed', top: 56, right: 12, zIndex: 50 }}
        >
          <CommentsPanel
            comments={comments}
            userDisplay={userDisplayName || 'Guest'}
            outsideScopeNote={commentOutsideScopeNote}
            onPost={handleCommentPost}
            onResolve={handleCommentResolve}
            onClose={() => setCommentsOpen(false)}
          />
        </div>
      ) : null}
      <ProjectMenu
        open={projectMenuOpen}
        onOpenChange={setProjectMenuOpen}
        anchorRef={projectNameRef}
        recent={recentProjects}
        onPickRecent={handlePickRecent}
        seedModels={seedModels}
        activeSeedModelId={modelId ?? null}
        onPickSeedModel={(id) => void loadSeedModel(id)}
        onInsertSeed={() => void insertSeedHouse()}
        onSaveSnapshot={handleSaveSnapshot}
        modelId={modelId}
        saveAsMaximumBackups={saveAsMaximumBackups}
        onSaveAsMaximumBackupsChange={handleSaveAsMaximumBackupsChange}
        onRestoreSnapshot={(f) => void handleRestoreSnapshot(f)}
        onOpenMilestone={openMilestoneDialog}
        onOpenVersionHistory={() => setVersionHistoryOpen(true)}
        onOpenMaterialBrowser={() => openMaterialBrowser()}
        onOpenAppearanceAssetBrowser={() => openAppearanceAssetBrowser()}
        onOpenProjectSetup={() => setProjectSetupOpen(true)}
        onOpenProjectUnits={() => setProjectUnitsOpen(true)}
        onManagePhases={() => setPhaseManagerOpen(true)}
        onOpenGlobalParams={() => setGlobalParamsOpen(true)}
        onOpenProjectInfo={() => setProjectInfoOpen(true)}
        onOpenSettings={() => setAppSettingsOpen(true)}
        onOpenProjectTemplates={() => setTemplatesOpen(true)}
        onNewClear={handleNewClear}
        onReplayTour={replayOnboardingTour}
        onManageLinks={() => setManageLinksOpen(true)}
        onLinkIfc={(file) => {
          console.warn('link-ifc selected', { name: file.name, size: file.size });
          setManageLinksOpen(true);
        }}
        onLinkDxf={(file, options) => {
          if (!modelId || !activeLevelId) {
            setManageLinksOpen(true);
            return;
          }
          void (async () => {
            try {
              await uploadDxfFile(modelId, file, activeLevelId, options);
              setManageLinksOpen(true);
            } catch (err) {
              console.error('DXF upload failed:', err);
              setManageLinksOpen(true);
            }
          })();
        }}
        onExportIfc={handleExportIfc}
        onExportDxf={handleExportDxf}
        onExportDwg={handleExportDwg}
        onExportDgn={handleExportDgn}
        exportLevels={Object.values(elementsById)
          .filter((e) => e.kind === 'level')
          .map((e) => ({ id: e.id, name: (e as { name?: string }).name ?? e.id }))}
        projectName={activeSeedLabel ?? 'project'}
        onDuplicateProject={handleDuplicateProject}
        onRevertProject={handleRevertProject}
        onResetWorkspace={() => void onSemanticCommand({ type: 'resetWorkspace' })}
        dxfLayerMapping={projectSettings?.dxfLayerMapping}
        onSetDxfLayerMapping={(mapping) =>
          void onSemanticCommand({ type: 'setDxfLayerMapping', mapping })
        }
      />
      <ProjectSetupDialog
        open={projectSetupOpen}
        onClose={() => setProjectSetupOpen(false)}
        elementsById={elementsById}
        modelId={modelId}
        revision={revision}
        onSemanticCommand={onSemanticCommand}
        onOpenManageLinks={() => {
          setProjectSetupOpen(false);
          setManageLinksOpen(true);
        }}
      />
      <ManageLinksDialog
        open={manageLinksOpen}
        onClose={() => setManageLinksOpen(false)}
        onSemanticCommand={onSemanticCommand}
        activeLevelId={activeLevelId ?? undefined}
      />
      {dxfImportOpen && (
        <DxfImportDialog
          onImport={(text) => {
            const topo = createToposolidFromDxf(text, activeLevelId ?? null);
            void onSemanticCommand({ type: 'create_toposolid', element: topo });
            setDxfImportOpen(false);
          }}
          onClose={() => setDxfImportOpen(false)}
        />
      )}
      <ProjectUnitsDialog open={projectUnitsOpen} onClose={() => setProjectUnitsOpen(false)} />
      <PhaseManagerDialog
        open={phaseManagerOpen}
        onClose={() => setPhaseManagerOpen(false)}
        elementsById={elementsById}
        onSemanticCommand={onSemanticCommand}
      />
      <ManagePhasesDialog
        isOpen={managePhasesOpen}
        phases={phases}
        onCreatePhase={(cmd) => void onSemanticCommand({ type: 'create_phase', ...cmd })}
        onUpdatePhase={(cmd) => void onSemanticCommand({ type: 'update_phase', ...cmd })}
        onDeletePhase={(id) => void onSemanticCommand({ type: 'delete_phase', id })}
        onClose={() => setManagePhasesOpen(false)}
      />
      <GlobalParamsDialog
        open={globalParamsOpen}
        onClose={() => setGlobalParamsOpen(false)}
        elementsById={elementsById}
        onSemanticCommand={onSemanticCommand}
      />
      {vgOpen && activePlanView ? (
        <VisibilityGraphicsDialog
          open={vgOpen}
          onClose={() => setVgOpen(false)}
          planView={activePlanView}
          onOverrideChange={(category, patch) =>
            void onSemanticCommand({
              type: 'update_category_override',
              planViewId: activePlanViewId,
              category,
              patch,
            })
          }
        />
      ) : null}
      <PerViewVGDialog
        open={perViewVGOpen}
        onClose={() => setPerViewVGOpen(false)}
        activePlanViewId={activePlanViewId ?? null}
        elementsById={elementsById}
        onApply={(viewId, overrides) =>
          void onSemanticCommand({
            type: 'updateElementProperty',
            elementId: viewId,
            key: 'viewCategoryOverrides',
            value: overrides,
          })
        }
      />
      <SetWorkPlaneDialog
        open={setWorkPlaneOpen}
        onClose={() => setSetWorkPlaneOpen(false)}
        referencePlanes={referencePlanes}
        currentWorkPlaneId={
          activePlanView
            ? ((activePlanView as { activeWorkPlaneId?: string | null }).activeWorkPlaneId ?? null)
            : null
        }
        onApply={(refPlaneId) => {
          if (!activePlanViewId) return;
          void onSemanticCommand({
            type: 'updateElementProperty',
            elementId: activePlanViewId,
            key: 'activeWorkPlaneId',
            value: refPlaneId,
          });
        }}
      />
      <ManageGlobalParamsDialog
        isOpen={manageGlobalParamsOpen}
        params={(projectSettings?.globalParams ?? []) as unknown as SimpleGlobalParam[]}
        onUpsertParam={(param) => void onSemanticCommand({ type: 'upsert_global_param', param })}
        onDeleteParam={(paramId) =>
          void onSemanticCommand({ type: 'delete_global_param', paramId })
        }
        onClose={() => setManageGlobalParamsOpen(false)}
      />
      <DimensionStyleDialog
        open={dimStyleOpen}
        onClose={() => setDimStyleOpen(false)}
        currentStyle={projectSettings?.dimensionStyle ?? {}}
        onSave={(style) => {
          if (!projectSettings) return;
          void onSemanticCommand({
            type: 'updateElementProperty',
            elementId: projectSettings.id,
            key: 'dimensionStyle',
            value: style,
          });
        }}
      />
      <ProjectInfoDialog
        open={projectInfoOpen}
        onClose={() => setProjectInfoOpen(false)}
        elementsById={elementsById}
        onSemanticCommand={onSemanticCommand}
      />
      {modelId && (
        <MilestoneDialog
          open={milestoneDialogOpen}
          modelId={modelId}
          snapshotId={String(revision)}
          authorId={userDisplayName || 'local-dev'}
          onClose={() => setMilestoneDialogOpen(false)}
        />
      )}
      <PasteToLevelsDialog
        open={pasteToLevelsOpen}
        onClose={() => setPasteToLevelsOpen(false)}
        elementsById={elementsById}
        activeLevelId={activeLevelId}
        selectedElementIds={selectedId ? [selectedId, ...selectedIds] : [...selectedIds]}
        onSemanticCommand={(cmd) => void onSemanticCommand(cmd)}
      />
      <SelectionFilterDialog
        open={selectionFilterOpen}
        onClose={() => setSelectionFilterOpen(false)}
        selectedId={selectedId ?? undefined}
        selectedIds={selectedIds}
        elementsById={elementsById}
        onApply={(newPrimary, newRest) => {
          useBimStore.setState({ selectedId: newPrimary, selectedIds: newRest });
        }}
      />
      <CreateGroupDialog
        open={createGroupOpen}
        elementCount={selectedIds.length + (selectedId ? 1 : 0)}
        onClose={() => setCreateGroupOpen(false)}
        onConfirm={(name) => {
          const allIds = [...(selectedId ? [selectedId] : []), ...selectedIds];
          const centroidX =
            allIds.reduce((sum, id) => {
              const el = elementsById[id];
              const x =
                (el as { insertionPoint?: { xMm: number } } | undefined)?.insertionPoint?.xMm ??
                (el as { xMm?: number } | undefined)?.xMm ??
                0;
              return sum + x;
            }, 0) / Math.max(allIds.length, 1);
          const centroidY =
            allIds.reduce((sum, id) => {
              const el = elementsById[id];
              const y =
                (el as { insertionPoint?: { yMm: number } } | undefined)?.insertionPoint?.yMm ??
                (el as { yMm?: number } | undefined)?.yMm ??
                0;
              return sum + y;
            }, 0) / Math.max(allIds.length, 1);
          const { registry } = applyCreateGroup(
            groupRegistry,
            {
              type: 'createGroup',
              name,
              elementIds: allIds,
              originXMm: centroidX,
              originYMm: centroidY,
            },
            () => crypto.randomUUID(),
          );
          setGroupRegistry(registry);
        }}
      />
      {modelId ? (
        <SharePresentationModal
          modelId={modelId}
          open={sharePresentationOpen}
          onClose={() => setSharePresentationOpen(false)}
          pages={sheetPages}
        />
      ) : null}
      <ActivityDrawer
        isOpen={activityIsOpen}
        onClose={closeActivityDrawer}
        modelId={modelId ?? null}
        selfId={userId ?? null}
      />
      <LibraryOverlay
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        activeDiscipline={libraryDiscipline}
        entries={assetEntries}
        onPlace={(entry, paramValues) => void handleLibraryPlace(entry, paramValues)}
      />
      <ClearanceViolationPanel
        violations={clearanceViolations}
        onClose={() => setClearanceViolations([])}
      />
      {terraceFloorId && (
        <TerracePresetDialog
          floorId={terraceFloorId}
          onApply={(railingHeightMm) => {
            const floor = elementsById[terraceFloorId];
            if (floor?.kind === 'floor') {
              const railing = buildTerraceRailing(floor, railingHeightMm);
              if (railing) {
                useBimStore.setState({
                  elementsById: { ...elementsById, [railing.id]: railing },
                });
              }
            }
            setTerraceFloorId(null);
          }}
          onClose={() => setTerraceFloorId(null)}
        />
      )}
    </>
  );
}
