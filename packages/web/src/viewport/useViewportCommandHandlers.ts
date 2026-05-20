import { useCallback, type MutableRefObject } from 'react';

import type { WallContextMenuCommand } from './WallContextMenu';
import type { WallFaceRadialCommand } from './wallFaceRadialMenu';

type SemanticCommandDispatcher = (cmd: Record<string, unknown>) => void;

type UseViewportCommandHandlersArgs = {
  activateElevationView: (id: string) => void;
  onSemanticCommand?: SemanticCommandDispatcher;
  onSemanticCommandRef: MutableRefObject<SemanticCommandDispatcher | undefined>;
  selectStoreEl: (id: string) => void;
};

type GripCommand = {
  type: string;
  payload: Record<string, unknown>;
};

export function useViewportCommandHandlers({
  activateElevationView,
  onSemanticCommand,
  onSemanticCommandRef,
  selectStoreEl,
}: UseViewportCommandHandlersArgs) {
  const handleWallContextMenuCommand = useCallback(
    (next: WallContextMenuCommand) => {
      onSemanticCommandRef.current?.(next.cmd);
      if (next.kind === 'elevation_view') {
        activateElevationView(next.elevationViewId);
      } else {
        selectStoreEl(next.sectionCutId);
      }
    },
    [activateElevationView, onSemanticCommandRef, selectStoreEl],
  );

  // EDT-03: dispatch slice grip commands as engine commands. Slice payloads
  // use `{ elementId, property, valueMm | value, ... }`; the engine's
  // UpdateElementPropertyCmd uses `{ elementId, key, value }`.
  const handleGripCommand = useCallback(
    (cmd: GripCommand) => {
      if (!onSemanticCommand) return;
      if (cmd.type === 'updateElementProperty') {
        const p = cmd.payload;
        const key = String(p.property ?? '');
        const value = p.value !== undefined ? p.value : p.valueMm;
        onSemanticCommand({
          type: 'updateElementProperty',
          elementId: p.elementId,
          key,
          value,
        });
        return;
      }
      if (cmd.type === 'moveBeamEndpoints') {
        const p = cmd.payload;
        onSemanticCommand({
          type: 'moveBeamEndpoints',
          beamId: p.beamId,
          startMm: p.startMm,
          endMm: p.endMm,
        });
        return;
      }
      // Forward unknown slice types verbatim; the engine will reject with a
      // clear error rather than silently dropping.
      onSemanticCommand({ type: cmd.type, ...cmd.payload });
    },
    [onSemanticCommand],
  );

  const handleWallFaceRadialCommand = useCallback(
    (next: WallFaceRadialCommand) => {
      onSemanticCommandRef.current?.(next.cmd as unknown as Record<string, unknown>);
    },
    [onSemanticCommandRef],
  );

  return {
    handleGripCommand,
    handleWallContextMenuCommand,
    handleWallFaceRadialCommand,
  };
}
