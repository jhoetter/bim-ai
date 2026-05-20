import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { HALF_MAX, HALF_MIN } from './interaction/planCameraMath';
import type {
  PlanCanvasDxfQueryDialogState,
  PlanCanvasElementContextMenuState,
  PlanCanvasUnhideContextMenuState,
  PlanCanvasWallContextMenuState,
  PlanCanvasWallJoinContextMenuState,
} from './PlanCanvasContextOverlays';
import type { WallContextMenuCommand } from '../workspace/viewport/WallContextMenu';

type MutableRef<T> = {
  current: T;
};

type PlanCanvasCameraState = {
  half: number;
};

type CanvasContextMenuState = {
  x: number;
  y: number;
};

type NullableSetter<T> = Dispatch<SetStateAction<T | null>>;

type UsePlanCanvasContextActionsArgs = {
  activateElevationView: (id: string) => void;
  camRef: MutableRef<PlanCanvasCameraState>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  resizeCam: () => void;
  selectEl: (id?: string) => void;
  setCanvasCtxMenu: NullableSetter<CanvasContextMenuState>;
  setDxfQueryDialog: NullableSetter<PlanCanvasDxfQueryDialogState>;
  setElementCtxMenu: NullableSetter<PlanCanvasElementContextMenuState>;
  setUnhideContextMenu: NullableSetter<PlanCanvasUnhideContextMenuState>;
  setWallContextMenu: NullableSetter<PlanCanvasWallContextMenuState>;
  setWallJoinCtxMenu: NullableSetter<PlanCanvasWallJoinContextMenuState>;
};

export function usePlanCanvasContextActions({
  activateElevationView,
  camRef,
  onSemanticCommand,
  resizeCam,
  selectEl,
  setCanvasCtxMenu,
  setDxfQueryDialog,
  setElementCtxMenu,
  setUnhideContextMenu,
  setWallContextMenu,
  setWallJoinCtxMenu,
}: UsePlanCanvasContextActionsArgs) {
  const closeWallContextMenu = useCallback(() => setWallContextMenu(null), [setWallContextMenu]);
  const closeCanvasContextMenu = useCallback(() => setCanvasCtxMenu(null), [setCanvasCtxMenu]);
  const closeElementContextMenu = useCallback(() => setElementCtxMenu(null), [setElementCtxMenu]);
  const closeUnhideContextMenu = useCallback(
    () => setUnhideContextMenu(null),
    [setUnhideContextMenu],
  );
  const closeDxfQueryDialog = useCallback(() => setDxfQueryDialog(null), [setDxfQueryDialog]);
  const closeWallJoinContextMenu = useCallback(
    () => setWallJoinCtxMenu(null),
    [setWallJoinCtxMenu],
  );

  const handleCanvasZoomIn = useCallback(() => {
    camRef.current.half = Math.max(HALF_MIN, camRef.current.half * Math.exp(-0.5));
    resizeCam();
  }, [camRef, resizeCam]);

  const handleCanvasZoomOut = useCallback(() => {
    camRef.current.half = Math.min(HALF_MAX, camRef.current.half * Math.exp(0.5));
    resizeCam();
  }, [camRef, resizeCam]);

  const handleWallContextMenuCommand = useCallback(
    (next: WallContextMenuCommand) => {
      void onSemanticCommand(next.cmd);
      if (next.kind === 'elevation_view') {
        activateElevationView(next.elevationViewId);
      } else {
        selectEl(next.sectionCutId);
      }
    },
    [activateElevationView, onSemanticCommand, selectEl],
  );

  return {
    closeCanvasContextMenu,
    closeDxfQueryDialog,
    closeElementContextMenu,
    closeUnhideContextMenu,
    closeWallContextMenu,
    closeWallJoinContextMenu,
    handleCanvasZoomIn,
    handleCanvasZoomOut,
    handleWallContextMenuCommand,
  };
}
