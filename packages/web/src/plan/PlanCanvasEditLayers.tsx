import type { ComponentProps } from 'react';
import type { Element } from '@bim-ai/core';

import { GripLayer, TempDimLayer } from './GripLayer';
import { HelperDimsLayer } from './HelperDimsLayer';
import { SnapGlyphLayer } from './SnapGlyphLayer';
import { findLockedConstraintFor } from './tempDimensionLockState';

type TempDimTargets = ComponentProps<typeof TempDimLayer>['targets'];
type GripDescriptors = ComponentProps<typeof GripLayer>['grips'];
type WorldToScreen = ComponentProps<typeof GripLayer>['worldToScreen'];
type GripPointerDown = ComponentProps<typeof GripLayer>['onGripPointerDown'];
type GripDoubleClick = ComponentProps<typeof GripLayer>['onGripDoubleClick'];
type SnapGlyphState = ComponentProps<typeof SnapGlyphLayer>;

export function PlanCanvasEditLayers({
  showTempDimensions,
  tempDimTargets,
  worldToScreen,
  onTempDimClick,
  onTempDimLockClick,
  gripDescriptors,
  onGripPointerDown,
  onGripDoubleClick,
  activeGripId,
  draftWall,
  selectedId,
  elementsById,
  onDispatch,
  snapGlyphState,
}: {
  showTempDimensions: boolean;
  tempDimTargets: TempDimTargets;
  worldToScreen: WorldToScreen;
  onTempDimClick: (target: TempDimTargets[number]) => void;
  onTempDimLockClick: (target: TempDimTargets[number]) => void;
  gripDescriptors: GripDescriptors;
  onGripPointerDown: GripPointerDown;
  onGripDoubleClick: GripDoubleClick;
  activeGripId: string | null;
  draftWall: ComponentProps<typeof GripLayer>['draftWall'];
  selectedId: string | null;
  elementsById: Record<string, Element>;
  onDispatch: (cmd: Record<string, unknown>) => void | Promise<void>;
  snapGlyphState: SnapGlyphState;
}) {
  return (
    <>
      {showTempDimensions && tempDimTargets.length > 0 && (
        <TempDimLayer
          targets={tempDimTargets}
          worldToScreen={worldToScreen}
          onTargetClick={onTempDimClick}
          onLockClick={onTempDimLockClick}
          isLocked={(t) => !!findLockedConstraintFor(t.aId, t.bId, Object.values(elementsById))}
        />
      )}
      {gripDescriptors.length > 0 && (
        <GripLayer
          grips={gripDescriptors}
          worldToScreen={worldToScreen}
          onGripPointerDown={onGripPointerDown}
          onGripDoubleClick={onGripDoubleClick}
          activeGripId={activeGripId}
          draftWall={draftWall}
        />
      )}
      <HelperDimsLayer
        selectedElemId={selectedId}
        elementsById={elementsById}
        planToScreen={worldToScreen}
        onDispatch={(cmd) => void onDispatch(cmd)}
      />
      <SnapGlyphLayer
        candidates={snapGlyphState.candidates}
        activeIndex={snapGlyphState.activeIndex}
      />
    </>
  );
}
