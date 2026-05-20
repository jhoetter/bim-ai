import { useCallback } from 'react';
import type * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import type { DraftMutation, GripDescriptor } from './gripProtocol';
import { dimensionTextOffsetResetCommand } from './grip-providers/dimensionGripProvider';
import { rayToPlanMm } from './interaction/planCameraMath';
import { findLockedConstraintFor } from './tempDimensionLockState';
import type { TempDimTarget } from './tempDimensions';

type MutableRef<T> = {
  current: T;
};

type Props = {
  rendererRef: MutableRef<THREE.WebGLRenderer | null>;
  cameraRef: MutableRef<THREE.OrthographicCamera | null>;
  gripDragRef: MutableRef<{
    grip: GripDescriptor;
    startWorldMm: { xMm: number; yMm: number };
    lastDeltaMm: { xMm: number; yMm: number };
  } | null>;
  setActiveGripId: (value: string | null) => void;
  setDraftMutation: (value: DraftMutation | null) => void;
  elementsById: Record<string, Element>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
};

export function usePlanCanvasGripHandlers({
  rendererRef,
  cameraRef,
  gripDragRef,
  setActiveGripId,
  setDraftMutation,
  elementsById,
  onSemanticCommand,
}: Props) {
  const handleGripPointerDown = useCallback(
    (grip: GripDescriptor, ev: { clientX: number; clientY: number }) => {
      const renderer = rendererRef.current;
      const cam = cameraRef.current;
      if (!renderer || !cam) return;
      const rw = rayToPlanMm(renderer, cam, ev.clientX, ev.clientY);
      if (!rw) return;
      gripDragRef.current = {
        grip,
        startWorldMm: rw,
        lastDeltaMm: { xMm: 0, yMm: 0 },
      };
      setActiveGripId(grip.id);
      setDraftMutation(grip.onDrag({ xMm: 0, yMm: 0 }));
    },
    [cameraRef, gripDragRef, rendererRef, setActiveGripId, setDraftMutation],
  );

  const handleGripDoubleClick = useCallback(
    (grip: GripDescriptor) => {
      const cmd = dimensionTextOffsetResetCommand(grip.id, elementsById);
      if (!cmd) return;
      void onSemanticCommand(cmd);
    },
    [elementsById, onSemanticCommand],
  );

  const handleTempDimClick = useCallback(
    (target: TempDimTarget) => {
      void onSemanticCommand(target.onClick());
    },
    [onSemanticCommand],
  );

  const handleTempDimLockClick = useCallback(
    (target: TempDimTarget) => {
      const elementsList = Object.values(elementsById);
      const existing = findLockedConstraintFor(target.aId, target.bId, elementsList);
      if (existing) return;
      const cid = `cstr-${crypto.randomUUID().slice(0, 10)}`;
      void onSemanticCommand({
        type: 'createConstraint',
        id: cid,
        rule: 'equal_distance',
        refsA: [{ elementId: target.aId, anchor: 'center' }],
        refsB: [{ elementId: target.bId, anchor: 'center' }],
        lockedValueMm: target.distanceMm,
        severity: 'error',
      });
    },
    [elementsById, onSemanticCommand],
  );

  return {
    handleGripDoubleClick,
    handleGripPointerDown,
    handleTempDimClick,
    handleTempDimLockClick,
  };
}
