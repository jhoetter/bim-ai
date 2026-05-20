import { parseDimensionInput } from '@bim-ai/core';
import type * as THREE from 'three';

import type { DraftMutation, GripDescriptor } from './gripProtocol';
import { rayToPlanMm } from './interaction/planCameraMath';

type MutableRef<T> = {
  current: T;
};

type GripDragState = {
  grip: GripDescriptor;
  startWorldMm: { xMm: number; yMm: number };
  lastDeltaMm: { xMm: number; yMm: number };
};

type NumericInputState = {
  value: string;
  pxX: number;
  pxY: number;
};

export function handleGripPointerUp({
  renderer,
  camera,
  event,
  gripDragRef,
  numericInputRef,
  setActiveGripId,
  setDraftMutation,
  setNumericInput,
  skipClickRef,
  onSemanticCommand,
}: {
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  event: { clientX: number; clientY: number };
  gripDragRef: MutableRef<GripDragState | null>;
  numericInputRef: MutableRef<NumericInputState | null>;
  setActiveGripId: (value: string | null) => void;
  setDraftMutation: (value: DraftMutation | null) => void;
  setNumericInput: (value: NumericInputState | null) => void;
  skipClickRef: MutableRef<boolean>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
}): boolean {
  if (!gripDragRef.current) return false;

  const grip = gripDragRef.current.grip;
  const numeric = numericInputRef.current?.value;
  if (numeric != null && numeric !== '') {
    const parsed = parseDimensionInput(numeric);
    if (parsed.ok) {
      void onSemanticCommand(grip.onNumericOverride(parsed.mm));
    }
  } else {
    const rwUp = rayToPlanMm(renderer, camera, event.clientX, event.clientY);
    if (rwUp) {
      const start = gripDragRef.current.startWorldMm;
      const delta = { xMm: rwUp.xMm - start.xMm, yMm: rwUp.yMm - start.yMm };
      if (Math.hypot(delta.xMm, delta.yMm) > 1) {
        void onSemanticCommand(grip.onCommit(delta));
      }
    }
  }

  gripDragRef.current = null;
  setActiveGripId(null);
  setDraftMutation(null);
  setNumericInput(null);
  skipClickRef.current = true;
  return true;
}
