import { useEffect } from 'react';

import { useBimStore, type PlanTool } from '../state/store';
import {
  initialAlignState,
  initialBeamState,
  initialBeamSystemState,
  initialCeilingState,
  initialColumnState,
  initialRampState,
  initialScaleState,
  initialShaftState,
  initialSplitState,
  initialSplitWallState,
  initialStairLandingState,
  initialStairRunState,
  initialTrimState,
  initialWallJoinState,
  initialWallOpeningState,
  initialExcavationState,
  reduceAlign,
  reduceArray,
  reduceColumnAtGrids,
  reduceConicalRoof,
  reduceDetailFilledRegion,
  reduceDetailLine,
  reduceDomeRoof,
  reduceLinework,
  reducePlaceGroup,
  reduceRoofByExtrusion,
  reduceScale,
  reduceSpireRoof,
  reduceSplit,
  reduceSplitWall,
  reduceSteelConnection,
  reduceTrim,
  reduceWallJoin,
  type AlignState,
  type ArrayState,
  type BeamState,
  type BeamSystemState,
  type CeilingState,
  type ColumnAtGridsState,
  type ColumnState,
  type ConicalRoofState,
  type DetailFilledRegionState,
  type DetailLineState,
  type DomeRoofState,
  type ExcavationState,
  type LineworkState,
  type PlaceGroupState,
  type RampState,
  type RoofByExtrusionState,
  type ScaleState,
  type ShaftState,
  type SpireRoofState,
  type SplitState,
  type SplitWallState,
  type StairLandingState,
  type StairRunState,
  type SteelConnectionState,
  type TrimState,
  type WallJoinState,
  type WallOpeningState,
} from '../tools/toolGrammar';
import { setDispatchColumnAtGridsSelectAll } from '../workspace/authoring';
import type { Draft } from './planCanvasHelpers';

type MutableRef<T> = {
  current: T;
};

type Props = {
  planTool: PlanTool;
  draftRef: MutableRef<Draft | undefined>;
  wallFlipRef: MutableRef<boolean>;
  alignStateRef: MutableRef<AlignState>;
  setAlignReferenceMm: (value: { xMm: number; yMm: number } | null) => void;
  mirrorAxisStartRef: MutableRef<{ xMm: number; yMm: number } | null>;
  setMirrorAxisSet: (value: boolean) => void;
  copyAnchorRef: MutableRef<{ xMm: number; yMm: number } | null>;
  setCopyAnchorSet: (value: boolean) => void;
  moveAnchorRef: MutableRef<{ xMm: number; yMm: number } | null>;
  setMoveAnchorSet: (value: boolean) => void;
  rotateAnchorRef: MutableRef<{ xMm: number; yMm: number } | null>;
  setRotateAnchorSet: (value: boolean) => void;
  rotateReferenceRef: MutableRef<{ xMm: number; yMm: number } | null>;
  setRotateReferenceSet: (value: boolean) => void;
  scaleStateRef: MutableRef<ScaleState>;
  setScalePhase: (value: ScaleState['phase']) => void;
  setNumericInput: (value: { value: string; pxX: number; pxY: number } | null) => void;
  splitStateRef: MutableRef<SplitState>;
  splitWallStateRef: MutableRef<SplitWallState>;
  trimStateRef: MutableRef<TrimState>;
  trimExtendFirstWallRef: MutableRef<string | null>;
  setTrimExtendFirstWallSet: (value: boolean) => void;
  wallJoinStateRef: MutableRef<WallJoinState>;
  wallOpeningStateRef: MutableRef<WallOpeningState>;
  shaftStateRef: MutableRef<ShaftState>;
  columnStateRef: MutableRef<ColumnState>;
  beamStateRef: MutableRef<BeamState>;
  stairStateRef: MutableRef<BeamState>;
  rampStateRef: MutableRef<RampState>;
  ceilingStateRef: MutableRef<CeilingState>;
  excavationStateRef: MutableRef<ExcavationState>;
  beamSystemStateRef: MutableRef<BeamSystemState>;
  steelConnectionStateRef: MutableRef<SteelConnectionState>;
  columnAtGridsStateRef: MutableRef<ColumnAtGridsState>;
  bumpGeom: (updater: (value: number) => number) => void;
  arrayStateRef: MutableRef<ArrayState>;
  setArrayPhase: (value: ArrayState['phase']) => void;
  placeGroupStateRef: MutableRef<PlaceGroupState>;
  roofByExtrusionStateRef: MutableRef<RoofByExtrusionState>;
  setRoofByExtrusionPhase: (value: RoofByExtrusionState['phase']) => void;
  lineworkStateRef: MutableRef<LineworkState>;
  conicalRoofStateRef: MutableRef<ConicalRoofState>;
  domeRoofStateRef: MutableRef<DomeRoofState>;
  spireRoofStateRef: MutableRef<SpireRoofState>;
  stairRunStateRef: MutableRef<StairRunState>;
  stairLandingStateRef: MutableRef<StairLandingState>;
  detailLineStateRef: MutableRef<DetailLineState>;
  detailFilledRegionStateRef: MutableRef<DetailFilledRegionState>;
};

export function usePlanCanvasToolActivation({
  planTool,
  draftRef,
  wallFlipRef,
  alignStateRef,
  setAlignReferenceMm,
  mirrorAxisStartRef,
  setMirrorAxisSet,
  copyAnchorRef,
  setCopyAnchorSet,
  moveAnchorRef,
  setMoveAnchorSet,
  rotateAnchorRef,
  setRotateAnchorSet,
  rotateReferenceRef,
  setRotateReferenceSet,
  scaleStateRef,
  setScalePhase,
  setNumericInput,
  splitStateRef,
  splitWallStateRef,
  trimStateRef,
  trimExtendFirstWallRef,
  setTrimExtendFirstWallSet,
  wallJoinStateRef,
  wallOpeningStateRef,
  shaftStateRef,
  columnStateRef,
  beamStateRef,
  stairStateRef,
  rampStateRef,
  ceilingStateRef,
  excavationStateRef,
  beamSystemStateRef,
  steelConnectionStateRef,
  columnAtGridsStateRef,
  bumpGeom,
  arrayStateRef,
  setArrayPhase,
  placeGroupStateRef,
  roofByExtrusionStateRef,
  setRoofByExtrusionPhase,
  lineworkStateRef,
  conicalRoofStateRef,
  domeRoofStateRef,
  spireRoofStateRef,
  stairRunStateRef,
  stairLandingStateRef,
  detailLineStateRef,
  detailFilledRegionStateRef,
}: Props) {
  useEffect(() => {
    draftRef.current = undefined;
    wallFlipRef.current = false;
    alignStateRef.current = initialAlignState();
    setAlignReferenceMm(null);
    mirrorAxisStartRef.current = null;
    setMirrorAxisSet(false);
    copyAnchorRef.current = null;
    setCopyAnchorSet(false);
    moveAnchorRef.current = null;
    setMoveAnchorSet(false);
    rotateAnchorRef.current = null;
    setRotateAnchorSet(false);
    rotateReferenceRef.current = null;
    setRotateReferenceSet(false);
    scaleStateRef.current = initialScaleState();
    setScalePhase('idle');
    setNumericInput(null);
    splitStateRef.current = initialSplitState();
    splitWallStateRef.current = initialSplitWallState();
    trimStateRef.current = initialTrimState();
    trimExtendFirstWallRef.current = null;
    setTrimExtendFirstWallSet(false);
    wallJoinStateRef.current = initialWallJoinState();
    if (planTool === 'align') {
      const { state } = reduceAlign(alignStateRef.current, { kind: 'activate' });
      alignStateRef.current = state;
    } else if (planTool === 'split') {
      const { state } = reduceSplit(splitStateRef.current, { kind: 'activate' });
      splitStateRef.current = state;
    } else if (planTool === 'split-wall') {
      const { state } = reduceSplitWall(splitWallStateRef.current, { kind: 'activate' });
      splitWallStateRef.current = state;
    } else if (planTool === 'trim') {
      const { state } = reduceTrim(trimStateRef.current, { kind: 'activate' });
      trimStateRef.current = state;
    } else if (planTool === 'wall-join') {
      const { state } = reduceWallJoin(wallJoinStateRef.current, { kind: 'activate' });
      wallJoinStateRef.current = state;
    } else if (planTool === 'wall-opening') {
      wallOpeningStateRef.current = initialWallOpeningState();
    } else if (planTool === 'shaft') {
      shaftStateRef.current = initialShaftState();
    } else if (planTool === 'column') {
      columnStateRef.current = initialColumnState();
    } else if (planTool === 'beam') {
      beamStateRef.current = initialBeamState();
    } else if (planTool === 'stair') {
      stairStateRef.current = initialBeamState();
    } else if (planTool === 'ramp') {
      rampStateRef.current = initialRampState();
    } else if (planTool === 'ceiling') {
      ceilingStateRef.current = initialCeilingState();
    } else if (planTool === 'excavation') {
      excavationStateRef.current = initialExcavationState();
    } else if (planTool === 'beam-system') {
      beamSystemStateRef.current = initialBeamSystemState();
    } else if (planTool === 'steel-connection') {
      const { state: scState } = reduceSteelConnection(steelConnectionStateRef.current, {
        kind: 'activate',
      });
      steelConnectionStateRef.current = scState;
    } else if (planTool === 'column-at-grids') {
      const { state } = reduceColumnAtGrids(columnAtGridsStateRef.current, { kind: 'activate' });
      columnAtGridsStateRef.current = state;
      useBimStore.getState().setColumnAtGridsSelectedIds([]);
      setDispatchColumnAtGridsSelectAll((gridIds) => {
        const { state: s } = reduceColumnAtGrids(columnAtGridsStateRef.current, {
          kind: 'selectAllGrids',
          gridIds,
        });
        columnAtGridsStateRef.current = s;
        useBimStore
          .getState()
          .setColumnAtGridsSelectedIds(s.phase === 'selecting' ? s.selectedGridIds : []);
        bumpGeom((x) => x + 1);
      });
    } else if (planTool === 'scale') {
      const { state } = reduceScale(scaleStateRef.current, { kind: 'activate' });
      scaleStateRef.current = state;
      setScalePhase(state.phase);
    } else if (planTool === 'array') {
      const { state } = reduceArray(arrayStateRef.current, { kind: 'activate' });
      arrayStateRef.current = state;
      setArrayPhase(state.phase);
    } else if (planTool === 'place-group') {
      const { state } = reducePlaceGroup(placeGroupStateRef.current, { kind: 'activate' });
      placeGroupStateRef.current = state;
    } else if (planTool === 'roof-by-extrusion') {
      const { state } = reduceRoofByExtrusion(
        roofByExtrusionStateRef.current,
        { kind: 'activate' },
        '',
      );
      roofByExtrusionStateRef.current = state;
      setRoofByExtrusionPhase(state.phase);
    } else if (planTool === 'linework') {
      const { state } = reduceLinework(lineworkStateRef.current, { kind: 'activate' });
      lineworkStateRef.current = state;
    } else if (planTool === 'conical-roof') {
      const { state } = reduceConicalRoof(conicalRoofStateRef.current, { kind: 'activate' });
      conicalRoofStateRef.current = state;
    } else if (planTool === 'dome-roof') {
      const { state } = reduceDomeRoof(domeRoofStateRef.current, { kind: 'activate' });
      domeRoofStateRef.current = state;
    } else if (planTool === 'spire-roof') {
      const { state } = reduceSpireRoof(spireRoofStateRef.current, { kind: 'activate' });
      spireRoofStateRef.current = state;
    } else if (planTool === 'stair-run') {
      stairRunStateRef.current = initialStairRunState();
    } else if (planTool === 'stair-landing') {
      stairLandingStateRef.current = initialStairLandingState();
    } else if (planTool === 'detail-line') {
      const { state } = reduceDetailLine(detailLineStateRef.current, { kind: 'activate' });
      detailLineStateRef.current = state;
    } else if (planTool === 'detail-filled-region') {
      const { state } = reduceDetailFilledRegion(detailFilledRegionStateRef.current, {
        kind: 'activate',
      });
      detailFilledRegionStateRef.current = state;
    }
  }, [
    alignStateRef,
    arrayStateRef,
    beamStateRef,
    beamSystemStateRef,
    bumpGeom,
    ceilingStateRef,
    columnAtGridsStateRef,
    columnStateRef,
    conicalRoofStateRef,
    copyAnchorRef,
    detailFilledRegionStateRef,
    detailLineStateRef,
    domeRoofStateRef,
    draftRef,
    excavationStateRef,
    lineworkStateRef,
    mirrorAxisStartRef,
    moveAnchorRef,
    placeGroupStateRef,
    planTool,
    rampStateRef,
    roofByExtrusionStateRef,
    rotateAnchorRef,
    rotateReferenceRef,
    scaleStateRef,
    setAlignReferenceMm,
    setArrayPhase,
    setCopyAnchorSet,
    setMirrorAxisSet,
    setMoveAnchorSet,
    setNumericInput,
    setRoofByExtrusionPhase,
    setRotateAnchorSet,
    setRotateReferenceSet,
    setScalePhase,
    setTrimExtendFirstWallSet,
    shaftStateRef,
    spireRoofStateRef,
    splitStateRef,
    splitWallStateRef,
    stairLandingStateRef,
    stairRunStateRef,
    stairStateRef,
    steelConnectionStateRef,
    trimExtendFirstWallRef,
    trimStateRef,
    wallFlipRef,
    wallJoinStateRef,
    wallOpeningStateRef,
  ]);
}
