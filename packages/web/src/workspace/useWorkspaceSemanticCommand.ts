import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { Element, ModelDelta, Violation } from '@bim-ai/core';
import type {
  ApiHttpError as ApiHttpErrorClass,
  applyCommand as applyCommandApi,
} from '../lib/api';
import type {
  buildCollaborationConflictQueueV1 as buildCollaborationConflictQueueV1Fn,
  CollaborationConflictQueueV1,
} from '../lib/collaborationConflictQueue';
import type { autoDimensionWalls as autoDimensionWallsFn } from '../plan/autoDimensionWalls';
import type { createSimilarPayload as createSimilarPayloadFn } from '../plan/createSimilar';
import type { equalizeWitnessSpacing as equalizeWitnessSpacingFn } from '../plan/equalizeWitnessSpacing';
import type { applyFamilyParameters as applyFamilyParametersFn } from '../plan/familyParameterEval';
import type { computeShaftCutFloors as computeShaftCutFloorsFn } from '../plan/shaftCutFloors';
import type { shaftBoundaryFromStair as shaftBoundaryFromStairFn } from '../plan/stairShaft';
import type { stackDimensions as stackDimensionsFn } from '../plan/stackDimensions';
import { useBimStore } from '../state/store';
import type {
  generateCurtainWallsFromMass as generateCurtainWallsFromMassFn,
  generateFloorsFromMass as generateFloorsFromMassFn,
  generateRoofFromMass as generateRoofFromMassFn,
  generateWallsFromMass as generateWallsFromMassFn,
} from '../tools/massGenerateBim';
import type { MassNewElem } from '../tools/massToFloors';
import type { ToolId } from '../tools/toolRegistry';
import type {
  applyHideInView as applyHideInViewFn,
  applyIsolateInView as applyIsolateInViewFn,
  applyResetHiddenInView as applyResetHiddenInViewFn,
} from './hideInView';
import type { syncLastLevelElevationPropagationFromApplyResponse as syncLastLevelElevationPropagationFromApplyResponseFn } from './authoring/levelDatumPropagationSync';
import type { materializeOptimisticHostedOpening as materializeOptimisticHostedOpeningFn } from './semanticCommands/optimisticHostedOpening';
import type { rememberLocalClientOp as rememberLocalClientOpFn } from './useWorkspaceSnapshot';

type ElementWithLevel = Element & { levelId?: string | null };
type PaintableElement = Element & { faceOverrides?: Record<string, string> };
type WallJoinElement = Extract<Element, { kind: 'wall' }> & {
  joinOverrides?: Record<string, 'miter' | 'butt' | 'square'>;
};
type LinkPdfElement = Element & { hidden?: boolean };
type PointCloudElement = Element & { visible?: boolean };
type CuttableElement = Element & { cutBy?: string[] };
type JoinedPairsState = { joinedPairs?: [string, string][] };
type SplitViewState = { splitViewEnabled?: boolean };
type QuickAccessState = { quickAccessItems?: string[] };
type RecentProjectsState = { recentProjectIds?: string[] };
type ColumnStructuralElement = Extract<Element, { kind: 'column' }> & {
  isNonStructural?: boolean;
};
type WorkPlaneHostElement = Element & {
  angleDeg?: number;
  baseElevationMm?: number;
  levelId?: string;
};
type DxfLayerSettingsElement = Element & {
  dxfLayerMapping?: Record<string, string>;
};
type PlanViewCropRegion = NonNullable<Extract<Element, { kind: 'plan_view' }>['cropRegionMm']>;
type EditableStairRun = {
  runIndex: number;
  riserCount: number;
  runWidthMm: number;
};
type EditableStairElement = Extract<Element, { kind: 'stair' }> & {
  runs?: EditableStairRun[];
  editStairActive?: boolean;
  linkedShaftId?: string;
};
type Saved3dViewElement = Extract<Element, { kind: 'saved_3d_view' }> & {
  locked?: boolean;
  perspective?: boolean;
};
type WorkspaceSemanticCommandArgs = {
  [key: string]: unknown;
  activeLevelId?: string | null;
  activePlanViewId?: string | null;
  ApiHttpError: typeof ApiHttpErrorClass;
  applyCommand: typeof applyCommandApi;
  applyFamilyParameters: typeof applyFamilyParametersFn;
  applyHideInView: typeof applyHideInViewFn;
  applyIsolateInView: typeof applyIsolateInViewFn;
  applyResetHiddenInView: typeof applyResetHiddenInViewFn;
  autoDimensionWallsCmd: typeof autoDimensionWallsFn;
  buildCollaborationConflictQueueV1: typeof buildCollaborationConflictQueueV1Fn;
  computeShaftCutFloors: typeof computeShaftCutFloorsFn;
  createSimilarPayload: typeof createSimilarPayloadFn;
  equalizeWitnessSpacing: typeof equalizeWitnessSpacingFn;
  generateCurtainWallsFromMass: typeof generateCurtainWallsFromMassFn;
  generateFloorsFromMass: typeof generateFloorsFromMassFn;
  generateRoofFromMass: typeof generateRoofFromMassFn;
  generateWallsFromMass: typeof generateWallsFromMassFn;
  hydrateFromSnapshot: (snapshot: {
    modelId: string;
    revision: number;
    elements: Record<string, Element>;
    violations: Violation[];
  }) => void;
  log: { error: (label: string, message: string, ...args: unknown[]) => void };
  materializeOptimisticHostedOpening: typeof materializeOptimisticHostedOpeningFn;
  rememberLocalClientOp: typeof rememberLocalClientOpFn;
  setCollaborationConflictQueue: (queue: CollaborationConflictQueueV1 | null) => void;
  setPlanTool: (toolId: ToolId) => void;
  setRedoDepth: Dispatch<SetStateAction<number>>;
  setSeedError: (message: string | null) => void;
  setUndoDepth: Dispatch<SetStateAction<number>>;
  shaftBoundaryFromStair: typeof shaftBoundaryFromStairFn;
  stackDimensions: typeof stackDimensionsFn;
  syncLastLevelElevationPropagationFromApplyResponse: typeof syncLastLevelElevationPropagationFromApplyResponseFn;
};

export function useWorkspaceSemanticCommand(args: WorkspaceSemanticCommandArgs) {
  const {
    activeLevelId,
    activePlanViewId,
    ApiHttpError,
    applyCommand,
    applyFamilyParameters,
    applyHideInView,
    applyIsolateInView,
    applyResetHiddenInView,
    autoDimensionWallsCmd,
    buildCollaborationConflictQueueV1,
    computeShaftCutFloors,
    createSimilarPayload,
    equalizeWitnessSpacing,
    generateCurtainWallsFromMass,
    generateFloorsFromMass,
    generateRoofFromMass,
    generateWallsFromMass,
    hydrateFromSnapshot,
    log,
    materializeOptimisticHostedOpening,
    rememberLocalClientOp,
    setCollaborationConflictQueue,
    setPlanTool,
    setRedoDepth,
    setSeedError,
    setUndoDepth,
    shaftBoundaryFromStair,
    stackDimensions,
    syncLastLevelElevationPropagationFromApplyResponse,
  } = args;

  const onSemanticCommand = useCallback(
    async (cmd: Record<string, unknown>): Promise<void> => {
      // §2.1.4: client-only category visual override patch
      if (cmd.type === 'update_category_override') {
        const { elementsById: cur } = useBimStore.getState();
        const pv = cur[cmd.planViewId as string];
        if (pv && pv.kind === 'plan_view') {
          const prevOverrides = (pv.categoryOverrides ?? {}) as Record<string, unknown>;
          const next =
            cmd.patch === null
              ? Object.fromEntries(
                  Object.entries(prevOverrides).filter(([k]) => k !== (cmd.category as string)),
                )
              : { ...prevOverrides, [cmd.category as string]: cmd.patch };
          useBimStore.setState({
            elementsById: { ...cur, [pv.id]: { ...pv, categoryOverrides: next } },
          });
        }
        return;
      }
      // §3.3.5: client-only toggle Show Constraints mode on a plan view
      if (cmd.type === 'toggleShowConstraints') {
        const { elementsById: cur } = useBimStore.getState();
        const view = cur[cmd.viewId as string];
        if (!view || view.kind !== 'plan_view') return;
        useBimStore.setState({
          elementsById: {
            ...cur,
            [view.id]: { ...view, showConstraints: !(view.showConstraints ?? false) },
          },
        });
        return;
      }
      // §2.9.4: client-only plan underlay toggle + level selector
      if (cmd.type === 'setPlanUnderlay') {
        const { elementsById: cur } = useBimStore.getState();
        const view = cur[cmd.viewId as string];
        if (!view || view.kind !== 'plan_view') return;
        useBimStore.setState({
          elementsById: {
            ...cur,
            [view.id]: {
              ...view,
              underlayLevelId:
                (cmd.underlayLevelId as string | null | undefined) !== undefined
                  ? (cmd.underlayLevelId as string | null)
                  : view.underlayLevelId,
              showUnderlay:
                (cmd.showUnderlay as boolean | undefined) !== undefined
                  ? (cmd.showUnderlay as boolean)
                  : !(view.showUnderlay ?? false),
            },
          },
        });
        return;
      }
      // §1.6.10: client-only crop region resize (updateCropRegion)
      if (cmd.type === 'updateCropRegion') {
        const { elementsById: cur } = useBimStore.getState();
        const pv = cur[cmd.planViewId as string];
        if (pv?.kind === 'plan_view') {
          useBimStore.setState({
            elementsById: {
              ...cur,
              [pv.id]: { ...pv, cropRegionMm: cmd.cropRegionMm as PlanViewCropRegion },
            },
          });
        }
        return;
      }
      // §1.6.10: client-only hide/isolate/reset elements in plan view
      if (cmd.type === 'hide_in_view') {
        const { elementsById: cur } = useBimStore.getState();
        useBimStore.setState({
          elementsById: applyHideInView(cur, cmd.viewId as string, cmd.elementIds as string[]),
        });
        return;
      }
      if (cmd.type === 'isolate_in_view') {
        const { elementsById: cur } = useBimStore.getState();
        useBimStore.setState({
          elementsById: applyIsolateInView(cur, cmd.viewId as string, cmd.elementIds as string[]),
        });
        return;
      }
      if (cmd.type === 'reset_hidden_in_view') {
        const { elementsById: cur } = useBimStore.getState();
        useBimStore.setState({
          elementsById: applyResetHiddenInView(cur, cmd.viewId as string),
        });
        return;
      }
      // §8.9.3: client-only group edit mode — no server round-trip
      if (cmd.type === 'editGroup') {
        const defId = cmd.groupDefinitionId as string;
        useBimStore.getState().setGroupEditModeDefinitionId(defId);
        useBimStore.getState().setActiveGroupEditId(defId);
        return;
      }
      if (cmd.type === 'finishEditGroup') {
        useBimStore.getState().setGroupEditModeDefinitionId(null);
        useBimStore.getState().setActiveGroupEditId(null);
        return;
      }
      if (cmd.type === 'restoreMilestone') {
        // Restore is server-backed; the panel dispatches intent and closes.
        return;
      }
      // §5.1.4: create a terrain pad element client-side
      if (cmd.type === 'create_toposolid_pad') {
        const current = useBimStore.getState().elementsById;
        useBimStore.setState({
          elementsById: {
            ...current,
            [cmd.id as string]: {
              kind: 'toposolid_pad',
              id: cmd.id as string,
              toposolidId: cmd.toposolidId as string,
              boundaryMm: cmd.boundaryMm as { xMm: number; yMm: number }[],
              elevationMm: cmd.elevationMm as number,
            },
          },
        });
        return;
      }
      // §2.5.3: client-only shaft floor opening creation
      if (cmd.type === 'create_shaft') {
        const current = useBimStore.getState().elementsById;
        useBimStore.setState({
          elementsById: {
            ...current,
            [cmd.id as string]: {
              kind: 'shaft',
              id: cmd.id as string,
              boundaryMm: cmd.boundaryMm as { xMm: number; yMm: number }[],
              baseLevelId: cmd.baseLevelId as string,
              topLevelId: cmd.topLevelId as string,
            },
          },
        });
        return;
      }
      // §2.5.3: inspector manual shaft creation for a stair
      if (cmd.type === 'inspector_create_shaft_for_stair') {
        const stairId = cmd.stairId as string;
        const current = useBimStore.getState().elementsById;
        const stair = current[stairId];
        if (stair && stair.kind === 'stair') {
          const boundary = shaftBoundaryFromStair(stair);
          if (boundary) {
            const shaftId = crypto.randomUUID();
            useBimStore.setState({
              elementsById: {
                ...current,
                [shaftId]: {
                  kind: 'shaft',
                  id: shaftId,
                  boundaryMm: boundary,
                  baseLevelId: stair.baseLevelId,
                  topLevelId: stair.topLevelId,
                },
                [stairId]: { ...stair, linkedShaftId: shaftId },
              },
            });
          }
        }
        return;
      }
      // §8.6.4: stair edit mode — client-only flag toggling, no server round-trip
      if (cmd.type === 'enterStairEditMode') {
        const current = useBimStore.getState().elementsById;
        const stair = current[cmd.stairId as string];
        if (stair?.kind === 'stair') {
          useBimStore.setState({
            elementsById: { ...current, [stair.id]: { ...stair, editStairActive: true } },
          });
        }
        return;
      }
      if (cmd.type === 'exitStairEditMode') {
        const current = useBimStore.getState().elementsById;
        const stair = current[cmd.stairId as string];
        if (stair?.kind === 'stair') {
          useBimStore.setState({
            elementsById: { ...current, [stair.id]: { ...stair, editStairActive: false } },
          });
        }
        return;
      }
      if (cmd.type === 'updateStairRun') {
        const current = useBimStore.getState().elementsById;
        const stair = current[cmd.stairId as string];
        if (stair?.kind === 'stair') {
          const editableStair = stair as EditableStairElement;
          const existingRuns: EditableStairRun[] = editableStair.runs ?? [
            {
              runIndex: 0,
              riserCount: editableStair.riserCount ?? 10,
              runWidthMm: editableStair.runWidthMm ?? 1200,
            },
          ];
          const runIndex = cmd.runIndex as number;
          const existing = existingRuns.find((r) => r.runIndex === runIndex) ?? {
            runIndex,
            riserCount: 10,
            runWidthMm: 1200,
          };
          const updated = { ...existing };
          if (cmd.riserCount !== undefined) updated.riserCount = cmd.riserCount as number;
          if (cmd.runWidthMm !== undefined) updated.runWidthMm = cmd.runWidthMm as number;
          const idx = existingRuns.findIndex((r) => r.runIndex === runIndex);
          const nextRuns =
            idx >= 0
              ? existingRuns.map((r, i) => (i === idx ? updated : r))
              : [...existingRuns, updated];
          useBimStore.setState({
            elementsById: {
              ...current,
              [stair.id]: { ...stair, runs: nextRuns } as unknown as Element,
            },
          });
        }
        return;
      }
      // §2.5.1: recompute shaft floor cuts
      if (cmd.type === 'recomputeShaftCuts') {
        const current = useBimStore.getState().elementsById;
        const shaft = current[cmd.shaftId as string];
        if (!shaft || shaft.kind !== 'shaft') return;
        const cutFloorIds = computeShaftCutFloors(
          shaft,
          current as Record<string, Element | undefined>,
        );
        useBimStore.setState({
          elementsById: {
            ...current,
            [shaft.id]: { ...shaft, cutFloorIds },
          },
        });
        return;
      }
      // §2.5.1: update shaft base/top level and recompute cuts
      if (cmd.type === 'updateShaftLevels') {
        const current = useBimStore.getState().elementsById;
        const shaft = current[cmd.shaftId as string];
        if (!shaft || shaft.kind !== 'shaft') return;
        const updated = {
          ...shaft,
          baseLevelId: (cmd.baseLevelId as string | null) ?? shaft.baseLevelId,
          topLevelId: (cmd.topLevelId as string | null) ?? shaft.topLevelId,
        };
        const cutFloorIds = computeShaftCutFloors(
          updated,
          current as Record<string, Element | undefined>,
        );
        useBimStore.setState({
          elementsById: {
            ...current,
            [shaft.id]: { ...updated, cutFloorIds },
          },
        });
        return;
      }
      // §2.5.1: applyShaftCut — store the cut floor IDs on the shaft element
      if (cmd.type === 'applyShaftCut') {
        const current = useBimStore.getState().elementsById;
        const shaft = current[cmd.shaftId as string];
        if (!shaft || shaft.kind !== 'shaft') return;
        const cutFloorIds = computeShaftCutFloors(
          shaft,
          current as Record<string, Element | undefined>,
        );
        useBimStore.setState({
          elementsById: {
            ...current,
            [shaft.id]: { ...shaft, cutFloorIds },
          },
        });
        return;
      }
      // §4.2.1: client-only permanent dimension chain creation
      if (cmd.type === 'create_permanent_dimension') {
        const current = useBimStore.getState().elementsById;
        useBimStore.setState({
          elementsById: {
            ...current,
            [cmd.id as string]: {
              kind: 'permanent_dimension',
              id: cmd.id as string,
              levelId: cmd.levelId as string,
              witnessPointsMm: cmd.witnessPointsMm as { xMm: number; yMm: number }[],
              offsetMm: cmd.offsetMm as { xMm: number; yMm: number },
              eqEnabled: false,
            },
          },
        });
        return;
      }
      // §4.2.3: toggle EQ on a permanent_dimension — also equalizes witness point spacing.
      if (cmd.type === 'toggle_dim_eq') {
        const current = useBimStore.getState().elementsById;
        const dim = current[cmd.dimensionId as string];
        if (dim && dim.kind === 'permanent_dimension') {
          const nextEq = !dim.eqEnabled;
          const nextWitnessPoints = nextEq
            ? equalizeWitnessSpacing(dim.witnessPointsMm)
            : dim.witnessPointsMm;
          useBimStore.setState({
            elementsById: {
              ...current,
              [dim.id]: { ...dim, eqEnabled: nextEq, witnessPointsMm: nextWitnessPoints },
            },
          });
        }
        return;
      }
      // §4.1: createAngularDimension — places an angular_dimension annotation in the active plan view.
      if (cmd.type === 'createAngularDimension') {
        const { elementsById: cur } = useBimStore.getState();
        const newId = crypto.randomUUID();
        useBimStore.setState({
          elementsById: {
            ...cur,
            [newId]: {
              kind: 'angular_dimension',
              id: newId,
              hostViewId: cmd.hostViewId as string,
              vertexMm: cmd.vertexMm as { xMm: number; yMm: number },
              rayAMm: cmd.rayAMm as { xMm: number; yMm: number },
              rayBMm: cmd.rayBMm as { xMm: number; yMm: number },
              arcRadiusMm: (cmd.arcRadiusMm as number) ?? 400,
            } as unknown as Element,
          },
        });
        return;
      }
      // §4.1: createRadialDimension — places a radial_dimension annotation in the active plan view.
      if (cmd.type === 'createRadialDimension') {
        const { elementsById: cur } = useBimStore.getState();
        const newId = crypto.randomUUID();
        useBimStore.setState({
          elementsById: {
            ...cur,
            [newId]: {
              kind: 'radial_dimension',
              id: newId,
              hostViewId: cmd.hostViewId as string,
              centerMm: cmd.centerMm as { xMm: number; yMm: number },
              arcPointMm: cmd.arcPointMm as { xMm: number; yMm: number },
            } as unknown as Element,
          },
        });
        return;
      }
      // §4.1: createDiameterDimension — places a diameter_dimension annotation in the active plan view.
      if (cmd.type === 'createDiameterDimension') {
        const { elementsById: cur } = useBimStore.getState();
        const newId = crypto.randomUUID();
        useBimStore.setState({
          elementsById: {
            ...cur,
            [newId]: {
              kind: 'diameter_dimension',
              id: newId,
              hostViewId: cmd.hostViewId as string,
              centerMm: cmd.centerMm as { xMm: number; yMm: number },
              arcPointMm: cmd.arcPointMm as { xMm: number; yMm: number },
            } as unknown as Element,
          },
        });
        return;
      }
      // §4.1: autoDimensionWalls — generate permanent_dimension elements from wall set.
      if (cmd.type === 'autoDimensionWalls') {
        const { elementsById: cur } = useBimStore.getState();
        const walls = Object.values(cur).filter(
          (e): e is Extract<Element, { kind: 'wall' }> =>
            e?.kind === 'wall' &&
            (cmd.levelId === null || (e as ElementWithLevel).levelId === cmd.levelId),
        );
        const dims = autoDimensionWallsCmd(walls, (cmd.offsetMm as number | undefined) ?? 1000);
        const next = { ...cur };
        for (const dim of dims) {
          next[dim.id] = dim;
        }
        useBimStore.setState({ elementsById: next });
        return;
      }
      // §4.2.6: stackDimensions — redistribute parallel permanent_dimension offsetMm at even spacing.
      if (cmd.type === 'stackDimensions') {
        const { elementsById: cur } = useBimStore.getState();
        const allDims = Object.values(cur).filter(
          (el) => el.kind === 'permanent_dimension',
        ) as Extract<Element, { kind: 'permanent_dimension' }>[];
        const targetDims = (cmd.dimensionIds as string[] | undefined)?.length
          ? allDims.filter((d) => (cmd.dimensionIds as string[]).includes(d.id))
          : allDims;
        const offsets = stackDimensions(targetDims, (cmd.spacingMm as number | undefined) ?? 7);
        const updates: Record<string, Element> = { ...cur };
        for (const [id, offsetMm] of offsets) {
          const dim = cur[id];
          if (dim?.kind !== 'permanent_dimension') continue;
          const prev = dim.offsetMm;
          const vertical = Math.abs(prev.yMm) >= Math.abs(prev.xMm);
          updates[id] = {
            ...dim,
            offsetMm: vertical
              ? { xMm: 0, yMm: Math.sign(prev.yMm || 1) * offsetMm }
              : { xMm: Math.sign(prev.xMm || 1) * offsetMm, yMm: 0 },
          };
        }
        useBimStore.setState({ elementsById: updates });
        return;
      }
      // §15.1.3: addFamilyParameter — add a family_parameter element client-side.
      if (cmd.type === 'addFamilyParameter') {
        const param = cmd.parameter as Extract<Element, { kind: 'family_parameter' }>;
        const current = useBimStore.getState().elementsById;
        useBimStore.setState({
          elementsById: { ...current, [param.id]: param },
        });
        return;
      }
      // §15.1.3: deleteFamilyParameter — remove a family_parameter element client-side.
      if (cmd.type === 'deleteFamilyParameter') {
        const parameterId = cmd.parameterId as string;
        const current = { ...useBimStore.getState().elementsById };
        delete current[parameterId];
        useBimStore.setState({ elementsById: current });
        return;
      }
      // §15.1.3: setFamilyParameterValue — update defaultValue and propagate to linked element.
      if (cmd.type === 'setFamilyParameterValue') {
        const parameterId = cmd.parameterId as string;
        const value = cmd.value as number | boolean | string;
        const current = useBimStore.getState().elementsById;
        const p = current[parameterId];
        if (p?.kind === 'family_parameter') {
          const updatedParam = { ...p, defaultValue: value };
          const updates = applyFamilyParameters([updatedParam], current);
          const nextElements: Record<string, Element> = {
            ...current,
            [parameterId]: updatedParam,
          };
          for (const [elId, props] of Object.entries(updates)) {
            const target = nextElements[elId];
            if (target) {
              nextElements[elId] = { ...target, ...props } as Element;
            }
          }
          useBimStore.setState({ elementsById: nextElements });
        }
        return;
      }
      // §15.1.3: addFamilyConstraint — create a family_constraint element client-side.
      if (cmd.type === 'addFamilyConstraint') {
        const { elementsById: cur } = useBimStore.getState();
        const constraint = cmd.constraint as Element;
        useBimStore.setState({ elementsById: { ...cur, [constraint.id]: constraint } });
        return;
      }
      // §15.1.3: addFamilyReferencePlane — create a family_reference_plane element client-side.
      if (cmd.type === 'addFamilyReferencePlane') {
        const id = `frp-${Date.now()}`;
        useBimStore.setState((s) => ({
          elementsById: {
            ...s.elementsById,
            [id]: {
              kind: 'family_reference_plane' as const,
              id,
              familyId: cmd.familyId as string,
              name: (cmd.name as string) || 'Reference Plane',
              axis: (cmd.axis as 'x' | 'z') || 'x',
              offsetMm: (cmd.offsetMm as number) ?? 0,
              isReference: (cmd.isReference as boolean | undefined) ?? true,
            },
          },
        }));
        return;
      }
      // §15.1.3: removeFamilyConstraint — delete a family_constraint element client-side.
      if (cmd.type === 'removeFamilyConstraint') {
        const { elementsById: cur } = useBimStore.getState();
        const next = { ...cur };
        delete next[cmd.constraintId as string];
        useBimStore.setState({ elementsById: next });
        return;
      }
      // §15.1.2: setFamilyCategory — assign a Revit-style category key to a family_definition element.
      if (cmd.type === 'setFamilyCategory') {
        const { elementsById: cur } = useBimStore.getState();
        const el = cur[cmd.familyId as string];
        if (!el || el.kind !== 'family_definition') return;
        useBimStore.setState({
          elementsById: { ...cur, [el.id]: { ...el, categoryKey: cmd.categoryKey as string } },
        });
        return;
      }
      // §1.6.2: save a reusable element type into the DB-backed family library.
      if (cmd.type === 'saveFamilyToLibrary') {
        const { elementsById: cur } = useBimStore.getState();
        const el = cur[cmd.elementId as string];
        if (!el) return;
        const famId = `fam-lib-${Date.now()}`;
        const familyName =
          (cmd.familyName as string | undefined) ??
          ((el as { name?: string }).name || `${el.kind} family`);
        useBimStore.setState({
          elementsById: {
            ...cur,
            [famId]: {
              kind: 'family_definition',
              id: famId,
              name: familyName,
              categoryKey: (el as { categoryKey?: string }).categoryKey ?? el.kind,
              sourceElementId: el.id,
            } as unknown as Element,
          },
        });
        return;
      }
      // §15.1.3: setFamilyOpeningCut — add/update the parametric opening cut on a wall-hosted family.
      if (cmd.type === 'setFamilyOpeningCut') {
        const { elementsById: cur } = useBimStore.getState();
        // Remove any existing family_opening_cut for this family
        const without = Object.fromEntries(
          Object.entries(cur).filter(
            ([, el]) =>
              !(
                el.kind === 'family_opening_cut' &&
                (el as Extract<Element, { kind: 'family_opening_cut' }>).familyId === cmd.familyId
              ),
          ),
        );
        const newId = crypto.randomUUID();
        useBimStore.setState({
          elementsById: {
            ...without,
            [newId]: {
              kind: 'family_opening_cut',
              id: newId,
              familyId: cmd.familyId as string,
              widthMm: cmd.widthMm as number,
              heightMm: cmd.heightMm as number,
              sillOffsetMm: (cmd.sillOffsetMm as number | undefined) ?? 0,
            } as unknown as Element,
          },
        });
        return;
      }
      // §15.1.2: addFamilyComponent — place a nested sub-component instance inside a family definition.
      if (cmd.type === 'addFamilyComponent') {
        const { elementsById: cur } = useBimStore.getState();
        const newId = crypto.randomUUID();
        useBimStore.setState({
          elementsById: {
            ...cur,
            [newId]: {
              kind: 'family_component',
              id: newId,
              familyId: cmd.familyId as string,
              componentTypeId: cmd.componentTypeId as string,
              label: (cmd.label as string | undefined) ?? cmd.componentTypeId,
              originMm: cmd.originMm as { xMm: number; yMm: number; zMm: number },
              rotationDeg: (cmd.rotationDeg as number | undefined) ?? 0,
            } as unknown as Element,
          },
        });
        return;
      }
      // §1.8.1: selectSimilar — select all elements of the same kind (client-only).
      // Matches the `selection.select-all-instances` palette command behaviour.
      if (cmd.type === 'selectSimilar') {
        const kind = cmd.kind as string | undefined;
        if (kind) {
          const elems = useBimStore.getState().elementsById;
          const sameKind = Object.values(elems)
            .filter((e): e is NonNullable<typeof e> => e != null && e.kind === kind)
            .map((e) => e.id);
          if (sameKind.length > 0) {
            const [primary, ...rest] = sameKind;
            useBimStore.setState({ selectedId: primary, selectedIds: rest });
          }
        }
        return;
      }
      // §1.6.11: applyViewTemplate — set viewTemplateId on a plan_view (client-only).
      if (cmd.type === 'applyViewTemplate') {
        const { elementsById: cur } = useBimStore.getState();
        const pv = cur[cmd.planViewId as string];
        if (!pv || pv.kind !== 'plan_view') return;
        useBimStore.setState({
          elementsById: {
            ...cur,
            [pv.id]: { ...pv, viewTemplateId: (cmd.templateId as string | null) ?? undefined },
          },
        });
        return;
      }
      // §1.6.11: selectGroupElements — select all elements in a model group definition (client-only).
      if (cmd.type === 'selectGroupElements') {
        const defId = cmd.groupDefinitionId as string | undefined;
        if (defId) {
          const { groupRegistry } = useBimStore.getState();
          const def = groupRegistry.definitions[defId];
          if (def && def.elementIds.length > 0) {
            const [primary, ...rest] = def.elementIds;
            useBimStore.setState({ selectedId: primary, selectedIds: rest });
          }
        }
        return;
      }
      // §3.3.9: Create Similar — activate the placement tool for the element's kind.
      if (cmd.type === 'create_similar') {
        const elementId = cmd.elementId as string | undefined;
        if (elementId) {
          const el = useBimStore.getState().elementsById[elementId];
          if (el) {
            const payload = createSimilarPayload(el);
            if (payload) {
              setPlanTool(payload.toolId);
            }
          }
        }
        return;
      }
      // §5.1.1: patch heightSamples / thicknessMm / baseElevationMm on a toposolid
      if (cmd.type === 'update_toposolid') {
        const current = useBimStore.getState().elementsById;
        useBimStore.setState({
          elementsById: {
            ...current,
            [cmd.id as string]: { ...current[cmd.id as string], ...(cmd.patch as object) },
          },
        });
        return;
      }
      // §9.3: patch spacing / direction / count / typeId / justification on a beam_system
      if (cmd.type === 'update_beam_system') {
        const current = useBimStore.getState().elementsById;
        useBimStore.setState({
          elementsById: {
            ...current,
            [cmd.id as string]: { ...current[cmd.id as string], ...(cmd.patch as object) },
          },
        });
        return;
      }
      // §1.6.7: client-only wall/floor/roof type layer edit
      if (cmd.type === 'update_wall_type') {
        const current = useBimStore.getState().elementsById;
        useBimStore.setState({
          elementsById: {
            ...current,
            [cmd.id as string]: { ...current[cmd.id as string], ...(cmd.patch as object) },
          },
        });
        return;
      }
      // §3.3.4: paint tool — apply or remove a face material override
      if (cmd.type === 'paint_face') {
        const { elementId, faceId, materialId } = cmd as {
          elementId: string;
          faceId: string;
          materialId: string | null;
        };
        const current = useBimStore.getState().elementsById;
        const el = current[elementId];
        if (!el) return;
        const overrides: Record<string, string> = {
          ...((el as { faceMaterialOverrides?: Record<string, string> | null })
            .faceMaterialOverrides ?? {}),
        };
        if (materialId === null) {
          delete overrides[faceId];
        } else {
          overrides[faceId] = materialId;
        }
        useBimStore.setState({
          elementsById: {
            ...current,
            [elementId]: {
              ...el,
              faceMaterialOverrides: Object.keys(overrides).length > 0 ? overrides : null,
            } as Element,
          },
        });
        return;
      }
      // §3.3.7: linework override tool — apply per-element linework override to a plan view
      if (cmd.type === 'apply_linework_override') {
        const { elementId, colorHex, lineWeightPx, lineDash, viewId } = cmd as {
          elementId: string;
          colorHex: string;
          lineWeightPx: number;
          lineDash?: number[];
          viewId: string;
        };
        const st = useBimStore.getState();
        const view = st.elementsById[viewId ?? activePlanViewId ?? ''];
        if (!view || view.kind !== 'plan_view') return;
        const existing =
          (view as Extract<typeof view, { kind: 'plan_view' }>).lineworkOverrides ?? [];
        const filtered = existing.filter((o) => o.elementId !== elementId);
        const updated = [...filtered, { elementId, colorHex, lineWeightPx, lineDash }];
        useBimStore.setState({
          elementsById: {
            ...st.elementsById,
            [view.id]: {
              ...view,
              lineworkOverrides: updated,
            },
          },
        });
        return;
      }
      // §3.3.7 (Wave 26 WP-A): paint surface — assign a material to an individual element face
      if (cmd.type === 'paintFace') {
        const { elementsById: cur } = useBimStore.getState();
        const el = cur[cmd.elementId as string];
        if (!el) return;
        const overrides = {
          ...((el as PaintableElement).faceOverrides ?? {}),
          [cmd.faceKey as string]: cmd.materialKey as string,
        };
        useBimStore.setState({
          elementsById: { ...cur, [el.id]: { ...el, faceOverrides: overrides } as Element },
        });
        return;
      }
      if (cmd.type === 'unpaintFace') {
        const { elementsById: cur } = useBimStore.getState();
        const el = cur[cmd.elementId as string];
        if (!el) return;
        const overrides = { ...((el as PaintableElement).faceOverrides ?? {}) };
        delete overrides[cmd.faceKey as string];
        useBimStore.setState({
          elementsById: { ...cur, [el.id]: { ...el, faceOverrides: overrides } as Element },
        });
        return;
      }
      // §6.1.3: save/restore/delete named 3D views
      if (cmd.type === 'save_3d_view') {
        const st = useBimStore.getState();
        const pose = st.orbitCameraPoseMm;
        if (!pose) return;
        const id = `s3v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const sectionBox = st.viewerSectionBoxExtent ?? undefined;
        useBimStore.setState({
          elementsById: {
            ...st.elementsById,
            [id]: {
              kind: 'saved_3d_view',
              id,
              name: (cmd.name as string) || '3D View',
              cameraMm: { x: pose.position.xMm, y: pose.position.yMm, z: pose.position.zMm },
              targetMm: { x: pose.target.xMm, y: pose.target.yMm, z: pose.target.zMm },
              upVector: pose.up ? { x: pose.up.xMm, y: pose.up.yMm, z: pose.up.zMm } : null,
              locked: false,
              sectionBox: sectionBox ?? null,
            } as Saved3dViewElement,
          },
        });
        return;
      }
      // §14.5: save_camera_view — named perspective camera view
      if (cmd.type === 'save_camera_view') {
        const st = useBimStore.getState();
        const pose = st.orbitCameraPoseMm;
        if (!pose) return;
        const id = `scv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const isPerspective = st.viewerProjection === 'perspective';
        useBimStore.setState({
          elementsById: {
            ...st.elementsById,
            [id]: {
              kind: 'saved_3d_view',
              id,
              name: (cmd.name as string) || `Camera ${Date.now()}`,
              cameraMm: { x: pose.position.xMm, y: pose.position.yMm, z: pose.position.zMm },
              targetMm: { x: pose.target.xMm, y: pose.target.yMm, z: pose.target.zMm },
              upVector: pose.up ? { x: pose.up.xMm, y: pose.up.yMm, z: pose.up.zMm } : null,
              locked: false,
              sectionBox: null,
              perspective: isPerspective,
              fovDeg: 60,
            } as Saved3dViewElement,
          },
        });
        return;
      }
      if (cmd.type === 'orient_3d_view') {
        const orientation = cmd.orientation as string;
        const st = useBimStore.getState();
        // Standard orientation camera positions (5 m above origin looking down for top,
        // or at a distance for cardinal views).
        const D = 5000; // 5 m in mm
        if (orientation === 'top') {
          st.setOrbitCameraFromViewpointMm({
            position: { xMm: 0, yMm: 0, zMm: D },
            target: { xMm: 0, yMm: 0, zMm: 0 },
            up: { xMm: 0, yMm: 1, zMm: 0 },
          });
        } else if (orientation === 'front') {
          st.setOrbitCameraFromViewpointMm({
            position: { xMm: 0, yMm: -D, zMm: 0 },
            target: { xMm: 0, yMm: 0, zMm: 0 },
            up: { xMm: 0, yMm: 0, zMm: 1 },
          });
        } else if (orientation === 'back') {
          st.setOrbitCameraFromViewpointMm({
            position: { xMm: 0, yMm: D, zMm: 0 },
            target: { xMm: 0, yMm: 0, zMm: 0 },
            up: { xMm: 0, yMm: 0, zMm: 1 },
          });
        } else if (orientation === 'left') {
          st.setOrbitCameraFromViewpointMm({
            position: { xMm: -D, yMm: 0, zMm: 0 },
            target: { xMm: 0, yMm: 0, zMm: 0 },
            up: { xMm: 0, yMm: 0, zMm: 1 },
          });
        } else if (orientation === 'right') {
          st.setOrbitCameraFromViewpointMm({
            position: { xMm: D, yMm: 0, zMm: 0 },
            target: { xMm: 0, yMm: 0, zMm: 0 },
            up: { xMm: 0, yMm: 0, zMm: 1 },
          });
        }
        return;
      }
      if (cmd.type === 'restore_3d_view') {
        const st = useBimStore.getState();
        const el = st.elementsById[cmd.viewId as string];
        if (!el || el.kind !== 'saved_3d_view') return;
        const view = el as Saved3dViewElement;
        st.setOrbitCameraFromViewpointMm({
          position: { xMm: view.cameraMm.x, yMm: view.cameraMm.y, zMm: view.cameraMm.z },
          target: { xMm: view.targetMm.x, yMm: view.targetMm.y, zMm: view.targetMm.z },
          up: view.upVector
            ? { xMm: view.upVector.x, yMm: view.upVector.y, zMm: view.upVector.z }
            : { xMm: 0, yMm: 1, zMm: 0 },
        });
        // §14.5: restore perspective/orthographic projection mode for camera views
        if (view.perspective === true) {
          st.setViewerProjection('perspective');
        } else if (view.perspective === false) {
          st.setViewerProjection('orthographic');
        }
        if (view.sectionBox) {
          st.setViewerSectionBoxExtent(view.sectionBox);
          st.setViewerSectionBoxActive(true);
        }
        st.setViewLocked(view.locked === true);
        return;
      }
      if (cmd.type === 'delete_3d_view') {
        const st = useBimStore.getState();
        const { [cmd.viewId as string]: _removed, ...remaining } = st.elementsById;
        useBimStore.setState({ elementsById: remaining });
        return;
      }
      if (cmd.type === 'toggle_3d_view_lock') {
        const st = useBimStore.getState();
        const el = st.elementsById[cmd.viewId as string];
        if (!el || el.kind !== 'saved_3d_view') return;
        useBimStore.setState({
          elementsById: {
            ...st.elementsById,
            [el.id]: { ...el, locked: !(el as Saved3dViewElement).locked },
          },
        });
        return;
      }
      if (cmd.type === 'rename_3d_view') {
        const st = useBimStore.getState();
        const el = st.elementsById[cmd.viewId as string];
        if (!el || el.kind !== 'saved_3d_view') return;
        useBimStore.setState({
          elementsById: {
            ...st.elementsById,
            [el.id]: { ...el, name: cmd.name as string },
          },
        });
        return;
      }
      // §3.3.6: split a wall at a point on its centreline into two walls
      if (cmd.type === 'split_wall') {
        const wallId = cmd.wallId as string;
        const splitPt = cmd.splitPointMm as { xMm: number; yMm: number };
        const current = useBimStore.getState().elementsById;
        const wall = current[wallId];
        if (!wall || wall.kind !== 'wall') return;
        const ax = wall.start.xMm;
        const ay = wall.start.yMm;
        const bx = wall.end.xMm;
        const by = wall.end.yMm;
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy;
        const t =
          len2 < 1e-9
            ? 0
            : Math.max(
                0.001,
                Math.min(0.999, ((splitPt.xMm - ax) * dx + (splitPt.yMm - ay) * dy) / len2),
              );
        const px = ax + dx * t;
        const py = ay + dy * t;
        const splitPoint = { xMm: px, yMm: py };
        const { id: _id, start: _start, end: _end, ...sharedFields } = wall;
        const wallA = {
          ...sharedFields,
          id: crypto.randomUUID(),
          start: wall.start,
          end: splitPoint,
        };
        const wallB = {
          ...sharedFields,
          id: crypto.randomUUID(),
          start: splitPoint,
          end: wall.end,
        };
        const { [wallId]: _removed, ...rest } = current;
        useBimStore.setState({
          elementsById: { ...rest, [wallA.id]: wallA, [wallB.id]: wallB },
        });
        return;
      }

      // §11.5-A: generate walls from a selected mass element
      if (cmd.type === 'mass_generate_walls') {
        const massId = cmd.massId as string;
        if (!massId) return;
        const { elementsById: cur } = useBimStore.getState();
        const el = cur[massId];
        if (
          !el ||
          (el.kind !== 'mass_box' && el.kind !== 'mass_extrusion' && el.kind !== 'mass_revolution')
        )
          return;
        const mass = el as MassNewElem;
        const levels = (Object.values(cur) as Element[])
          .filter((e): e is Extract<Element, { kind: 'level' }> => e?.kind === 'level')
          .sort((a, b) => a.elevationMm - b.elevationMm);
        const lowestLevelId = levels[0]?.id ?? '';
        if (!lowestLevelId) return;
        const wallCmds = generateWallsFromMass(mass, lowestLevelId);
        for (const wallCmd of wallCmds) {
          void onSemanticCommand(wallCmd as unknown as Record<string, unknown>);
        }
        return;
      }

      // §11.5-B: generate floors from a selected mass element
      if (cmd.type === 'mass_generate_floors') {
        const massId = cmd.massId as string;
        if (!massId) return;
        const { elementsById: cur } = useBimStore.getState();
        const el = cur[massId];
        if (
          !el ||
          (el.kind !== 'mass_box' && el.kind !== 'mass_extrusion' && el.kind !== 'mass_revolution')
        )
          return;
        const mass = el as MassNewElem;
        const levels = (Object.values(cur) as Element[])
          .filter((e): e is Extract<Element, { kind: 'level' }> => e?.kind === 'level')
          .sort((a, b) => a.elevationMm - b.elevationMm);
        const floorCmds = generateFloorsFromMass(mass, levels);
        for (const floorCmd of floorCmds) {
          void onSemanticCommand(floorCmd as unknown as Record<string, unknown>);
        }
        return;
      }

      // §11.5-C: generate roof from a selected mass element
      if (cmd.type === 'mass_generate_roof') {
        const massId = cmd.massId as string;
        if (!massId) return;
        const { elementsById: cur } = useBimStore.getState();
        const el = cur[massId];
        if (
          !el ||
          (el.kind !== 'mass_box' && el.kind !== 'mass_extrusion' && el.kind !== 'mass_revolution')
        )
          return;
        const mass = el as MassNewElem;
        const levels = (Object.values(cur) as Element[])
          .filter((e): e is Extract<Element, { kind: 'level' }> => e?.kind === 'level')
          .sort((a, b) => a.elevationMm - b.elevationMm);
        const baseMm = mass.baseElevationMm;
        const topMm =
          mass.kind === 'mass_revolution'
            ? baseMm + Math.max(...mass.profilePoints.map((p: { yMm: number }) => p.yMm), 0)
            : baseMm + mass.heightMm;
        const intersecting = levels.filter(
          (l) => l.elevationMm >= baseMm - 1 && l.elevationMm <= topMm + 1,
        );
        const referenceLevelId =
          (intersecting.length > 0 ? intersecting[intersecting.length - 1] : levels[0])?.id ?? '';
        if (!referenceLevelId) return;
        const roofCmd = generateRoofFromMass(mass, referenceLevelId);
        void onSemanticCommand(roofCmd as unknown as Record<string, unknown>);
        return;
      }

      // §11.5 (WP-E): generate curtain walls from a selected mass element
      if (cmd.type === 'mass_generate_curtain_walls') {
        const massId = cmd.massId as string;
        if (!massId) return;
        const { elementsById: cur } = useBimStore.getState();
        const el = cur[massId];
        if (
          !el ||
          (el.kind !== 'mass_box' && el.kind !== 'mass_extrusion' && el.kind !== 'mass_revolution')
        )
          return;
        const mass = el as MassNewElem;
        const levels = (Object.values(cur) as Element[])
          .filter((e): e is Extract<Element, { kind: 'level' }> => e?.kind === 'level')
          .sort((a, b) => a.elevationMm - b.elevationMm);
        const lowestLevelId = levels[0]?.id ?? '';
        if (!lowestLevelId) return;
        const curtainCmds = generateCurtainWallsFromMass(mass, lowestLevelId);
        for (const curtainCmd of curtainCmds) {
          void onSemanticCommand(curtainCmd as unknown as Record<string, unknown>);
        }
        return;
      }

      // §3.3.6: scaleElements — uniform scale of selected elements about a base point
      if (cmd.type === 'scaleElements') {
        const { elementIds, basePtMm, scaleFactor } = cmd as {
          elementIds: string[];
          basePtMm: { xMm: number; yMm: number };
          scaleFactor: number;
        };
        const { elementsById: cur } = useBimStore.getState();
        for (const id of elementIds) {
          const el = cur[id];
          if (!el || !('positionMm' in el)) continue;
          const pos = (el as { positionMm: { xMm: number; yMm: number } }).positionMm;
          const dx = (pos.xMm - basePtMm.xMm) * scaleFactor;
          const dy = (pos.yMm - basePtMm.yMm) * scaleFactor;
          void onSemanticCommand({
            type: 'updateElementProperty',
            elementId: id,
            key: 'positionMm',
            value: { xMm: basePtMm.xMm + dx, yMm: basePtMm.yMm + dy },
          });
          for (const field of ['lengthMm', 'widthMm', 'radiusMm'] as const) {
            if (field in el) {
              void onSemanticCommand({
                type: 'updateElementProperty',
                elementId: id,
                key: field,
                value: ((el as Record<string, unknown>)[field] as number) * scaleFactor,
              });
            }
          }
        }
        return;
      }
      // §3.3.6: scaleElement (singular) — emitted by PlanCanvas buildScaleCommand
      if (cmd.type === 'scaleElement') {
        const elementId = cmd.elementId as string;
        const originXMm = cmd.originXMm as number;
        const originYMm = cmd.originYMm as number;
        const factor = cmd.factor as number;
        void onSemanticCommand({
          type: 'scaleElements',
          elementIds: [elementId],
          basePtMm: { xMm: originXMm, yMm: originYMm },
          scaleFactor: factor,
        });
        return;
      }

      // §6.4.2: client-only detail drafting element creation / removal
      if (cmd.type === 'addDetailLine') {
        const element = cmd.element as Element;
        const current = useBimStore.getState().elementsById;
        useBimStore.setState({ elementsById: { ...current, [element.id]: element } });
        return;
      }
      if (cmd.type === 'addDetailFilledRegion') {
        const element = cmd.element as Element;
        const current = useBimStore.getState().elementsById;
        useBimStore.setState({ elementsById: { ...current, [element.id]: element } });
        return;
      }
      if (cmd.type === 'removeDetailElement') {
        const elementId = cmd.elementId as string;
        const current = { ...useBimStore.getState().elementsById };
        delete current[elementId];
        useBimStore.setState({ elementsById: current });
        return;
      }
      // §6.4.2: create a drafting (detail) view — plan_view with planViewSubtype='drafting'
      if (cmd.type === 'createDraftingView') {
        const id = `pv-drafting-${Date.now()}`;
        useBimStore.setState((s) => ({
          elementsById: {
            ...s.elementsById,
            [id]: {
              kind: 'plan_view' as const,
              id,
              name: (cmd.name as string) || 'Drafting View',
              planViewSubtype: 'drafting' as const,
              levelId: typeof activeLevelId === 'string' ? activeLevelId : '',
              cropRegionEnabled: false,
            },
          },
        }));
        return;
      }

      // §8.6.2: client-only stair component creation / removal
      if (cmd.type === 'addStairRun') {
        const { elementsById: cur } = useBimStore.getState();
        const run = cmd.run as Element;
        useBimStore.setState({ elementsById: { ...cur, [run.id]: run } });
        return;
      }
      if (cmd.type === 'addStairLanding') {
        const { elementsById: cur } = useBimStore.getState();
        const landing = cmd.landing as Element;
        useBimStore.setState({ elementsById: { ...cur, [landing.id]: landing } });
        return;
      }
      if (cmd.type === 'removeStairComponent') {
        const { elementsById: cur } = useBimStore.getState();
        const { [cmd.componentId as string]: _removed, ...remaining } = cur;
        useBimStore.setState({ elementsById: remaining });
        return;
      }
      // §3.5.5: updateWallProfile — inspector profile editor (UpdateWallProfileCmd)
      if (cmd.type === 'updateWallProfile') {
        const { elementsById: cur } = useBimStore.getState();
        const wall = cur[cmd.wallId as string];
        if (!wall || wall.kind !== 'wall') return;
        const profilePoints = cmd.profilePoints as
          | Extract<Element, { kind: 'wall' }>['profilePoints']
          | null
          | undefined;
        useBimStore.setState({
          elementsById: {
            ...cur,
            [wall.id]: {
              ...wall,
              profilePoints:
                Array.isArray(profilePoints) && profilePoints.length >= 3
                  ? profilePoints
                  : undefined,
            },
          },
        });
        return;
      }
      // §3.5.5: commitWallProfile — store custom profile points on a wall element
      if (cmd.type === 'commitWallProfile') {
        const { elementsById: cur } = useBimStore.getState();
        const wall = cur[cmd.wallId as string];
        if (wall?.kind === 'wall') {
          useBimStore.setState({
            elementsById: {
              ...cur,
              [wall.id]: {
                ...wall,
                profilePoints: cmd.points as Extract<Element, { kind: 'wall' }>['profilePoints'],
                editProfileActive: false,
              } as typeof wall,
            },
          });
        }
        return;
      }

      // §3.5.5: setWallJoin — store join variant override on both wall endpoints (client-side)
      if (cmd.type === 'setWallJoin') {
        const [wallIdA, wallIdB] = cmd.wallIds as [string, string];
        const { elementsById: cur } = useBimStore.getState();
        const wallA = cur[wallIdA];
        const wallB = cur[wallIdB];
        const next = { ...cur };
        if (wallA && wallA.kind === 'wall') {
          next[wallIdA] = {
            ...wallA,
            joinOverrides: {
              ...((wallA as WallJoinElement).joinOverrides ?? {}),
              [wallIdB]: cmd.variant as 'miter' | 'butt' | 'square',
            },
          } as typeof wallA;
        }
        if (wallB && wallB.kind === 'wall') {
          next[wallIdB] = {
            ...wallB,
            joinOverrides: {
              ...((wallB as WallJoinElement).joinOverrides ?? {}),
              [wallIdA]: cmd.variant as 'miter' | 'butt' | 'square',
            },
          } as typeof wallB;
        }
        useBimStore.setState({ elementsById: next });
        return;
      }

      // §12.1.1: addIfcLink — store link_ifc element client-side (no server round-trip)
      if (cmd.type === 'addIfcLink') {
        const element = cmd.element as Extract<Element, { kind: 'link_ifc' }>;
        const current = useBimStore.getState().elementsById;
        useBimStore.setState({
          elementsById: { ...current, [element.id]: element },
        });
        return;
      }
      // §12.1.1: removeIfcLink — delete link_ifc element client-side
      if (cmd.type === 'removeIfcLink') {
        const current = { ...useBimStore.getState().elementsById };
        delete current[cmd.linkId as string];
        useBimStore.setState({ elementsById: current });
        return;
      }
      // §12.1.1: toggleIfcLinkVisibility — flip visible flag client-side
      if (cmd.type === 'toggleIfcLinkVisibility') {
        const current = useBimStore.getState().elementsById;
        const link = current[cmd.linkId as string];
        if (link?.kind === 'link_ifc') {
          useBimStore.setState({
            elementsById: {
              ...current,
              [link.id]: { ...link, visible: !link.visible },
            },
          });
        }
        return;
      }
      // §12.1.1: addPdfLink — store link_pdf element client-side (no server round-trip)
      if (cmd.type === 'addPdfLink') {
        const newId = crypto.randomUUID();
        const { elementsById: cur } = useBimStore.getState();
        useBimStore.setState({
          elementsById: {
            ...cur,
            [newId]: {
              kind: 'link_pdf',
              id: newId,
              url: cmd.url as string,
              pageIndex: (cmd.pageIndex as number | undefined) ?? 0,
              opacity: (cmd.opacity as number | undefined) ?? 0.5,
              positionMm: (cmd.positionMm as { xMm: number; yMm: number } | undefined) ?? {
                xMm: 0,
                yMm: 0,
              },
              scaleMm: (cmd.scaleMm as number | undefined) ?? 1,
              levelId: cmd.levelId as string,
              hidden: false,
            } as unknown as Element,
          },
        });
        return;
      }
      // §12.1.1: removePdfLink — delete link_pdf element client-side
      if (cmd.type === 'removePdfLink') {
        const { elementsById: cur } = useBimStore.getState();
        const { [cmd.linkId as string]: _, ...rest } = cur;
        useBimStore.setState({ elementsById: rest });
        return;
      }
      // §12.1.1: togglePdfLink — flip hidden flag of link_pdf element client-side
      if (cmd.type === 'togglePdfLink') {
        const { elementsById: cur } = useBimStore.getState();
        const link = cur[cmd.linkId as string];
        if (!link) return;
        useBimStore.setState({
          elementsById: {
            ...cur,
            [link.id]: { ...link, hidden: !(link as LinkPdfElement).hidden } as Element,
          },
        });
        return;
      }
      // §12.1.1: addPointCloud — store link_pointcloud element client-side
      if (cmd.type === 'addPointCloud') {
        const id = `pc-${Date.now()}`;
        const { elementsById: cur } = useBimStore.getState();
        useBimStore.setState({
          elementsById: {
            ...cur,
            [id]: {
              kind: 'link_pointcloud',
              id,
              name: cmd.name as string,
              color: (cmd.color as number | undefined) ?? 0xffa500,
              visible: true,
            },
          },
        });
        return;
      }
      // §12.1.1: removePointCloud — delete link_pointcloud element client-side
      if (cmd.type === 'removePointCloud') {
        const { elementsById: cur } = useBimStore.getState();
        const next = { ...cur };
        delete next[cmd.linkId as string];
        useBimStore.setState({ elementsById: next });
        return;
      }
      // §12.1.1: togglePointCloud — flip visible flag of link_pointcloud element client-side
      if (cmd.type === 'togglePointCloud') {
        const { elementsById: cur } = useBimStore.getState();
        const link = cur[cmd.linkId as string];
        if (!link || link.kind !== 'link_pointcloud') return;
        useBimStore.setState({
          elementsById: {
            ...cur,
            [link.id]: { ...link, visible: !(link as PointCloudElement).visible },
          },
        });
        return;
      }
      // §3.4.2: addFloorSlopePoint — add a drainage slope point to a floor client-side
      if (cmd.type === 'addFloorSlopePoint') {
        const { elementsById: cur } = useBimStore.getState();
        const floor = cur[cmd.floorId as string];
        if (floor?.kind === 'floor') {
          const point = cmd.point as NonNullable<
            Extract<Element, { kind: 'floor' }>['slopePoints']
          >[number];
          useBimStore.setState({
            elementsById: {
              ...cur,
              [floor.id]: { ...floor, slopePoints: [...(floor.slopePoints ?? []), point] },
            },
          });
        }
        return;
      }
      if (cmd.type === 'removeFloorSlopePoint') {
        const { elementsById: cur } = useBimStore.getState();
        const floor = cur[cmd.floorId as string];
        if (floor?.kind === 'floor') {
          const pointId = cmd.pointId as string;
          useBimStore.setState({
            elementsById: {
              ...cur,
              [floor.id]: {
                ...floor,
                slopePoints: (floor.slopePoints ?? []).filter((p) => p.id !== pointId),
              },
            },
          });
        }
        return;
      }
      if (cmd.type === 'updateFloorSlopePoint') {
        const { elementsById: cur } = useBimStore.getState();
        const floor = cur[cmd.floorId as string];
        if (floor?.kind === 'floor') {
          const pointId = cmd.pointId as string;
          useBimStore.setState({
            elementsById: {
              ...cur,
              [floor.id]: {
                ...floor,
                slopePoints: (floor.slopePoints ?? []).map((p) =>
                  p.id === pointId
                    ? { ...p, elevationOffsetMm: cmd.elevationOffsetMm as number }
                    : p,
                ),
              },
            },
          });
        }
        return;
      }
      // §3.4.2: setSubFloorThickness — set structural base pad thickness below floor slab
      if (cmd.type === 'setSubFloorThickness') {
        const { elementsById: cur } = useBimStore.getState();
        const floor = cur[cmd.floorId as string];
        if (floor?.kind === 'floor') {
          useBimStore.setState({
            elementsById: {
              ...cur,
              [floor.id]: {
                ...floor,
                subFloorThicknessMm: cmd.subFloorThicknessMm as number | null,
              },
            },
          });
        }
        return;
      }
      // §9.5.4: assign or reset a custom parametric beam section profile.
      if (cmd.type === 'setBeamSectionProfile') {
        const { elementsById: cur } = useBimStore.getState();
        const beam = cur[cmd.beamId as string];
        if (!beam || beam.kind !== 'beam') return;
        useBimStore.setState({
          elementsById: {
            ...cur,
            [beam.id]: {
              ...beam,
              sectionProfileId: (cmd.profileId as string | null) ?? undefined,
            },
          },
        });
        return;
      }
      // §3.3.4: applyCutGeometry — add cutterId to host element's cutBy list
      if (cmd.type === 'applyCutGeometry') {
        const { elementsById: cur } = useBimStore.getState();
        const host = cur[cmd.hostId as string] as CuttableElement | undefined;
        if (host) {
          useBimStore.setState({
            elementsById: {
              ...cur,
              [host.id]: {
                ...host,
                cutBy: [...new Set([...(host.cutBy ?? []), cmd.cutterId as string])],
              } as Element,
            },
          });
        }
        return;
      }
      // §3.3.4: removeCutGeometry — remove cutterId from host element's cutBy list
      if (cmd.type === 'removeCutGeometry') {
        const { elementsById: cur } = useBimStore.getState();
        const host = cur[cmd.hostId as string] as CuttableElement | undefined;
        if (host) {
          useBimStore.setState({
            elementsById: {
              ...cur,
              [host.id]: {
                ...host,
                cutBy: (host.cutBy ?? []).filter((id: string) => id !== (cmd.cutterId as string)),
              } as Element,
            },
          });
        }
        return;
      }
      if (cmd.type === 'joinGeometry') {
        const pair = [cmd.elementId1 as string, cmd.elementId2 as string].sort() as [
          string,
          string,
        ];
        useBimStore.setState((s: JoinedPairsState) => {
          const existing: [string, string][] = s.joinedPairs ?? [];
          const alreadyJoined = existing.some(([a, b]) => a === pair[0] && b === pair[1]);
          return alreadyJoined ? {} : { joinedPairs: [...existing, pair] };
        });
        return;
      }
      if (cmd.type === 'unjoinGeometry') {
        const pair = [cmd.elementId1 as string, cmd.elementId2 as string].sort();
        useBimStore.setState((s: JoinedPairsState) => ({
          joinedPairs: (s.joinedPairs ?? []).filter(
            ([a, b]: [string, string]) => !(a === pair[0] && b === pair[1]),
          ),
        }));
        return;
      }
      // §9.1.3: toggleColumnStructural — toggle isNonStructural on a column element
      if (cmd.type === 'toggleColumnStructural') {
        const { elementsById: cur } = useBimStore.getState();
        const col = cur[cmd.columnId as string];
        if (!col || col.kind !== 'column') return;
        useBimStore.setState({
          elementsById: {
            ...cur,
            [col.id]: {
              ...col,
              isNonStructural: !(col as ColumnStructuralElement).isNonStructural,
            },
          },
        });
        return;
      }
      // §7.3.2: setWorkPlaneFace — create a work_plane element from a host wall/floor face normal
      if (cmd.type === 'setWorkPlaneFace') {
        const { elementsById: cur } = useBimStore.getState();
        const host = cur[cmd.hostElementId as string];
        if (!host) return;
        const newId = crypto.randomUUID();
        const normalDeg =
          host.kind === 'wall' ? (((host as WorkPlaneHostElement).angleDeg ?? 0) + 90) % 360 : 0;
        const elevationMm =
          host.kind === 'floor' ? ((host as WorkPlaneHostElement).baseElevationMm ?? 0) : 0;
        const wp = {
          kind: 'work_plane' as const,
          id: newId,
          name: (cmd.name as string | undefined) ?? `Face of ${host.kind} ${host.id.slice(0, 6)}`,
          hostElementId: cmd.hostElementId as string,
          elevationMm,
          normalDeg,
          levelId: (host as WorkPlaneHostElement).levelId ?? '',
        };
        useBimStore.setState({
          elementsById: { ...cur, [newId]: wp as unknown as Element },
        });
        return;
      }

      // §12.4.2: setDxfLayerMapping — merge partial layer name overrides onto project_settings
      if (cmd.type === 'setDxfLayerMapping') {
        const { elementsById: cur } = useBimStore.getState();
        const settings = Object.values(cur).find((el) => el.kind === 'project_settings');
        if (!settings) return;
        useBimStore.setState({
          elementsById: {
            ...cur,
            [settings.id]: {
              ...settings,
              dxfLayerMapping: {
                ...((settings as DxfLayerSettingsElement).dxfLayerMapping ?? {}),
                ...(cmd.mapping as Record<string, string>),
              },
            },
          },
        });
        return;
      }

      // §1.6.12: toggleSplitView — flip splitViewEnabled in store
      if (cmd.type === 'toggleSplitView') {
        useBimStore.setState((s: SplitViewState) => ({ splitViewEnabled: !s.splitViewEnabled }));
        return;
      }

      // §1.6.3: addToQuickAccess — pin a command to the Quick Access Toolbar
      if (cmd.type === 'addToQuickAccess') {
        const commandId = cmd.commandId as string;
        useBimStore.setState((s: QuickAccessState) => {
          const existing = s.quickAccessItems ?? [];
          if (existing.includes(commandId)) return s;
          return { quickAccessItems: [...existing, commandId] };
        });
        return;
      }

      // §1.6.3: removeFromQuickAccess — unpin a command from the Quick Access Toolbar
      if (cmd.type === 'removeFromQuickAccess') {
        useBimStore.setState((s: QuickAccessState) => ({
          quickAccessItems: (s.quickAccessItems ?? []).filter((id: string) => id !== cmd.commandId),
        }));
        return;
      }

      // §1.5: openRecentProject — prepend to recentProjectIds in store (LRU, max 10)
      if (cmd.type === 'openRecentProject') {
        useBimStore.setState((s: RecentProjectsState) => ({
          recentProjectIds: [
            cmd.projectId as string,
            ...(s.recentProjectIds ?? []).filter((x: string) => x !== cmd.projectId),
          ].slice(0, 10),
        }));
        return;
      }

      // §1.10: resetWorkspace — restore viewport/UI fields to initial defaults
      if (cmd.type === 'resetWorkspace') {
        useBimStore.setState({
          splitViewEnabled: false,
          skyBackground: 'default' as const,
          skyBackgroundColor: '#87ceeb',
          thinLinesEnabled: false,
          quickAccessItems: [],
          renderQuality: {
            shadowsEnabled: false,
            toneMappingExposure: 1.0,
            pixelRatioScale: 'auto',
          },
        });
        return;
      }

      const mid = useBimStore.getState().modelId;
      const uid = useBimStore.getState().userId;
      if (!mid) return;

      // WP-A §8.1.1: translate attach/detach wall top → updateElementProperty on roofAttachmentId
      let effectiveCmd = cmd;
      if (cmd.type === 'attach_wall_top') {
        effectiveCmd = {
          type: 'updateElementProperty',
          elementId: cmd.wallId,
          key: 'roofAttachmentId',
          value: cmd.hostId,
        };
      } else if (cmd.type === 'detach_wall_top') {
        effectiveCmd = {
          type: 'updateElementProperty',
          elementId: cmd.wallId,
          key: 'roofAttachmentId',
          value: null,
        };
      } else if (cmd.type === 'update_curtain_grid') {
        const wallId = cmd.wallId as string;
        const wall = useBimStore.getState().elementsById[wallId];
        if (!wall || wall.kind !== 'wall') return;
        const cur = (wall.curtainWallData ?? {}) as NonNullable<typeof wall.curtainWallData>;
        const updated = {
          ...cur,
          gridH: {
            ...(cur.gridH ?? {}),
            ...(cmd.hGridCount !== undefined ? { count: cmd.hGridCount as number } : {}),
          },
          gridV: {
            ...(cur.gridV ?? {}),
            ...(cmd.vGridCount !== undefined ? { count: cmd.vGridCount as number } : {}),
          },
          ...(cmd.panelType !== undefined ? { panelType: cmd.panelType } : {}),
          ...(cmd.mullionType !== undefined ? { mullionType: cmd.mullionType } : {}),
        };
        effectiveCmd = {
          type: 'updateElementProperty',
          elementId: wallId,
          key: 'curtainWallData',
          value: updated,
        };
      } else if (cmd.type === 'create_floor_type') {
        effectiveCmd = {
          type: 'upsertFloorType',
          id: cmd.id,
          name: cmd.name,
          layers: cmd.layers,
        };
      }

      const optimistic = materializeOptimisticHostedOpening(
        effectiveCmd,
        useBimStore.getState().elementsById,
      );
      if (optimistic) {
        effectiveCmd = optimistic.command;
        useBimStore.setState((state) => {
          if (state.elementsById[optimistic.element.id]) return state;
          return {
            elementsById: {
              ...state.elementsById,
              [optimistic.element.id]: optimistic.element,
            },
          };
        });
      }

      const clientOpId = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      rememberLocalClientOp(clientOpId);
      try {
        const r = await applyCommand(mid, effectiveCmd, { userId: uid, clientOpId });
        if (r.revision !== undefined) {
          if (r.delta) {
            useBimStore.getState().applyDelta(r.delta as ModelDelta);
            // §2.5.3: auto-create shaft void when stair is placed (unless suppressed)
            if (cmd.type === 'createStair' && cmd.autoShaft) {
              const delta = r.delta as ModelDelta;
              const newStairId = Object.keys(delta.elements).find((id) => {
                const el = delta.elements[id];
                return (
                  typeof el === 'object' &&
                  el !== null &&
                  (el as Record<string, unknown>).kind === 'stair'
                );
              });
              if (newStairId) {
                const newStair = delta.elements[newStairId] as Extract<Element, { kind: 'stair' }>;
                const boundary = shaftBoundaryFromStair(newStair);
                if (boundary) {
                  const shaftId = crypto.randomUUID();
                  const curr = useBimStore.getState().elementsById;
                  useBimStore.setState({
                    elementsById: {
                      ...curr,
                      [shaftId]: {
                        kind: 'shaft',
                        id: shaftId,
                        boundaryMm: boundary,
                        baseLevelId: newStair.baseLevelId,
                        topLevelId: newStair.topLevelId,
                      },
                      [newStairId]: { ...curr[newStairId], linkedShaftId: shaftId } as Element,
                    },
                  });
                }
              }
            }
          } else {
            hydrateFromSnapshot({
              modelId: mid,
              revision: r.revision,
              elements: (r.elements ?? {}) as Record<string, Element>,
              violations: (r.violations ?? []) as Violation[],
            });
          }
          syncLastLevelElevationPropagationFromApplyResponse(
            r as Parameters<typeof syncLastLevelElevationPropagationFromApplyResponse>[0],
          );
          setUndoDepth((d) => d + 1);
          setRedoDepth(0);
        }
        setCollaborationConflictQueue(null);
      } catch (err) {
        if (optimistic) {
          useBimStore.setState((state) => {
            if (state.elementsById[optimistic.element.id] !== optimistic.element) return state;
            const elementsById = { ...state.elementsById };
            delete elementsById[optimistic.element.id];
            return { elementsById };
          });
        }
        if (err instanceof ApiHttpError && err.status === 409) {
          log.error('conflict', '409 conflict detail:', err.detail);
          setCollaborationConflictQueue(buildCollaborationConflictQueueV1(err.detail));
        } else {
          setCollaborationConflictQueue(null);
          setSeedError(err instanceof Error ? err.message : 'Apply failed');
        }
      }
    },
    [
      ApiHttpError,
      activeLevelId,
      activePlanViewId,
      applyCommand,
      applyFamilyParameters,
      applyHideInView,
      applyIsolateInView,
      applyResetHiddenInView,
      autoDimensionWallsCmd,
      buildCollaborationConflictQueueV1,
      computeShaftCutFloors,
      createSimilarPayload,
      equalizeWitnessSpacing,
      generateCurtainWallsFromMass,
      generateFloorsFromMass,
      generateRoofFromMass,
      generateWallsFromMass,
      hydrateFromSnapshot,
      log,
      materializeOptimisticHostedOpening,
      rememberLocalClientOp,
      setCollaborationConflictQueue,
      setPlanTool,
      setRedoDepth,
      setSeedError,
      setUndoDepth,
      shaftBoundaryFromStair,
      stackDimensions,
      syncLastLevelElevationPropagationFromApplyResponse,
    ],
  );

  return onSemanticCommand;
}
