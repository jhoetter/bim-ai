import { useEffect } from 'react';
import type * as THREE from 'three';
import {
  initialMeasureAngleState,
  initialMeasureArcState,
  type MeasureAngleState,
  type MeasureArcState,
} from '../tools/toolGrammar';
import type { PlanTool } from '../state/store';
import type { SegmentLine } from './snapEngine';
import type { PickedWallLine } from './wallPickLines';
import type { DxfPrimitiveQueryHit } from './dxfUnderlay';
import type {
  PlanCanvasDxfQueryDialogState,
  PlanCanvasUnhideContextMenuState,
  PlanCanvasWallJoinContextMenuState,
} from './PlanCanvasContextOverlays';

type MutableRef<T> = {
  current: T;
};

type Props = {
  planTool: PlanTool;
  snapLines: SegmentLine[];
  lastSnapLinesRef: MutableRef<SegmentLine[]>;
  measureAngleStateRef: MutableRef<MeasureAngleState>;
  measureArcStateRef: MutableRef<MeasureArcState>;
  setMeasureReadout: (value: { distMm: number } | null) => void;
  setMeasureAngleReadout: (value: { angleDeg: number } | null) => void;
  setMeasureArcReadout: (value: { arcLengthMm: number; radiusMm: number } | null) => void;
  setWallPickLineHint: (value: PickedWallLine | null) => void;
  setWallDraftNotice: (value: string | null) => void;
  setDxfQueryHover: (value: DxfPrimitiveQueryHit | null) => void;
  setDxfQueryDialog: (value: PlanCanvasDxfQueryDialogState | null) => void;
  onResetComponentRotation: () => void;
  rootRef: MutableRef<THREE.Group | null>;
  componentGhostRef: MutableRef<THREE.Group | null>;
  unhideContextMenu: PlanCanvasUnhideContextMenuState | null;
  closeUnhideContextMenu: () => void;
  wallJoinContextMenu: PlanCanvasWallJoinContextMenuState | null;
  closeWallJoinContextMenu: () => void;
};

export function usePlanCanvasToolCleanupEffects({
  planTool,
  snapLines,
  lastSnapLinesRef,
  measureAngleStateRef,
  measureArcStateRef,
  setMeasureReadout,
  setMeasureAngleReadout,
  setMeasureArcReadout,
  setWallPickLineHint,
  setWallDraftNotice,
  setDxfQueryHover,
  setDxfQueryDialog,
  onResetComponentRotation,
  rootRef,
  componentGhostRef,
  unhideContextMenu,
  closeUnhideContextMenu,
  wallJoinContextMenu,
  closeWallJoinContextMenu,
}: Props) {
  useEffect(() => {
    lastSnapLinesRef.current = snapLines;
  }, [lastSnapLinesRef, snapLines]);

  useEffect(() => {
    if (planTool !== 'measure') setMeasureReadout(null);
  }, [planTool, setMeasureReadout]);

  useEffect(() => {
    if (planTool !== 'measure-angle') {
      measureAngleStateRef.current = initialMeasureAngleState();
      setMeasureAngleReadout(null);
    }
  }, [measureAngleStateRef, planTool, setMeasureAngleReadout]);

  useEffect(() => {
    if (planTool !== 'measure-arc') {
      measureArcStateRef.current = initialMeasureArcState();
      setMeasureArcReadout(null);
    }
  }, [measureArcStateRef, planTool, setMeasureArcReadout]);

  useEffect(() => {
    if (planTool !== 'wall') setWallPickLineHint(null);
  }, [planTool, setWallPickLineHint]);

  useEffect(() => {
    if (planTool !== 'wall') setWallDraftNotice(null);
  }, [planTool, setWallDraftNotice]);

  useEffect(() => {
    if (planTool !== 'query') {
      setDxfQueryHover(null);
      setDxfQueryDialog(null);
    }
  }, [planTool, setDxfQueryDialog, setDxfQueryHover]);

  useEffect(() => {
    if (planTool !== 'component') {
      onResetComponentRotation();
      const grp = rootRef.current;
      if (grp && componentGhostRef.current) {
        grp.remove(componentGhostRef.current);
        componentGhostRef.current = null;
      }
    }
  }, [componentGhostRef, onResetComponentRotation, planTool, rootRef]);

  useEffect(() => {
    if (!unhideContextMenu) return;
    window.addEventListener('mousedown', closeUnhideContextMenu);
    return () => window.removeEventListener('mousedown', closeUnhideContextMenu);
  }, [closeUnhideContextMenu, unhideContextMenu]);

  useEffect(() => {
    if (!wallJoinContextMenu) return;
    window.addEventListener('mousedown', closeWallJoinContextMenu);
    return () => window.removeEventListener('mousedown', closeWallJoinContextMenu);
  }, [closeWallJoinContextMenu, wallJoinContextMenu]);
}
