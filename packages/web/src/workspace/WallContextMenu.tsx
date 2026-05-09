import type { JSX } from 'react';
import { useEffect, useRef } from 'react';

import type { Element } from '@bim-ai/core';

import { elevationFromWall, sectionCutFromWall } from '../lib/sectionElevationFromWall';

export type WallContextMenuPosition = { x: number; y: number };

export type WallContextMenuCommand =
  | { kind: 'section_cut'; cmd: Record<string, unknown>; sectionCutId: string }
  | { kind: 'elevation_view'; cmd: Record<string, unknown>; elevationViewId: string };

/**
 * ANN-02 — context menu shown when the user right-clicks a wall in plan or 3D.
 * Two actions: "Generate Section Cut" and "Generate Elevation". The menu only
 * computes commands and emits them via `onCommand`; the caller is responsible
 * for dispatching them through the engine pipeline + activating the new view.
 */
export function WallContextMenu({
  wall,
  position,
  onCommand,
  onClose,
}: {
  wall: Extract<Element, { kind: 'wall' }>;
  position: WallContextMenuPosition;
  onCommand: (next: WallContextMenuCommand) => void;
  onClose: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onAway = (ev: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(ev.target as Node)) return;
      onClose();
    };
    const onEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onAway);
    window.addEventListener('keydown', onEsc);
    // Focus first menu item on open
    const first = ref.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
    return () => {
      window.removeEventListener('mousedown', onAway);
      window.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  const handleSection = () => {
    const params = sectionCutFromWall(wall);
    const id = `sc-${crypto.randomUUID().slice(0, 10)}`;
    onCommand({
      kind: 'section_cut',
      sectionCutId: id,
      cmd: {
        type: 'createSectionCut',
        id,
        name: params.name,
        lineStartMm: params.lineStartMm,
        lineEndMm: params.lineEndMm,
        cropDepthMm: params.cropDepthMm,
      },
    });
    onClose();
  };

  const handleElevation = () => {
    const params = elevationFromWall(wall);
    const id = `ev-${crypto.randomUUID().slice(0, 10)}`;
    const cmd: Record<string, unknown> = {
      type: 'createElevationView',
      id,
      name: params.name,
      direction: params.direction,
      cropMinMm: params.cropMinMm,
      cropMaxMm: params.cropMaxMm,
    };
    if (params.direction === 'custom' && params.customAngleDeg !== null) {
      cmd.customAngleDeg = params.customAngleDeg;
    }
    onCommand({ kind: 'elevation_view', elevationViewId: id, cmd });
    onClose();
  };

  return (
    <div
      ref={ref}
      data-testid="wall-context-menu"
      role="menu"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1000,
      }}
      className="min-w-[220px] overflow-hidden rounded border border-border bg-surface text-foreground shadow-lg"
      onKeyDown={(e) => {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
        );
        const idx = items.indexOf(document.activeElement as HTMLElement);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          items[(idx + 1) % items.length]?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          items[(idx - 1 + items.length) % items.length]?.focus();
        }
      }}
    >
      <button
        type="button"
        role="menuitem"
        data-testid="wall-context-menu-section"
        onClick={handleSection}
        className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-accent/20"
      >
        Generate Section Cut
      </button>
      <button
        type="button"
        role="menuitem"
        data-testid="wall-context-menu-elevation"
        onClick={handleElevation}
        className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-accent/20"
      >
        Generate Elevation
      </button>
    </div>
  );
}
