/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
/**
 * EDT-03 — wall-face radial menu (closeout).
 *
 * Right-clicking a wall face in the 3D viewport pops a small radial
 * menu offering Insert Door / Insert Window / Insert Opening. The
 * Viewport hands us the world-space hit point (mm) and the wall's
 * start/end so we can resolve `alongT` for the hosted-element
 * commands. Selecting a button dispatches a single semantic command
 * and closes the menu.
 *
 * The component is self-contained — no Three.js — and renders into the
 * existing Viewport overlay layer.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { MaterialFaceKind, MaterialFaceOverride } from '@bim-ai/core';

export type WallFaceRadialMenuOpen = {
  /** Wall the right-click hit. */
  wallId: string;
  /** World-space click point in mm. */
  hitPoint: { xMm: number; yMm: number; zMm: number };
  /** Wall start in mm (xy). */
  wallStartMm: { xMm: number; yMm: number };
  /** Wall end in mm (xy). */
  wallEndMm: { xMm: number; yMm: number };
  /** Pixel position to anchor the menu. */
  screen: { x: number; y: number };
  /** Optional material element bound to the hit face for UV adjustments. */
  materialId?: string;
  currentUvRotationDeg?: number;
  /** Stable address of the wall face hit by the raycast. */
  faceKind?: Exclude<MaterialFaceKind, 'generated'>;
  /** Existing face overrides on the wall, used to replace/append the paint row. */
  faceMaterialOverrides?: MaterialFaceOverride[];
  /** Material selected for the Paint Face command. */
  paintMaterialKey?: string;
};

type Choice =
  | 'door'
  | 'window'
  | 'opening'
  | 'uv-rotate'
  | 'paint-face'
  | 'reset-face-material'
  | 'rotateMaterialOnFace'
  | 'moveMaterialOnFace'
  | 'scaleMaterialOnFace'
  | 'resetMaterialTransformOnFace';

type FaceMaterialPropertyCommand = {
  type: 'updateElementProperty';
  elementId: string;
  key: 'faceMaterialOverrides';
  value: MaterialFaceOverride[];
};

export type WallFaceRadialCommand =
  | {
      kind: 'door';
      cmd: {
        type: 'insertDoorOnWall';
        wallId: string;
        alongT: number;
        widthMm: number;
      };
    }
  | {
      kind: 'window';
      cmd: {
        type: 'insertWindowOnWall';
        wallId: string;
        alongT: number;
        widthMm: number;
        sillHeightMm: number;
        heightMm: number;
      };
    }
  | {
      kind: 'opening';
      cmd: {
        type: 'createWallOpening';
        hostWallId: string;
        alongTStart: number;
        alongTEnd: number;
        sillHeightMm: number;
        headHeightMm: number;
      };
    }
  | {
      kind: 'uv-rotate';
      cmd: {
        type: 'update_material_pbr';
        id: string;
        uvRotationDeg: number;
      };
    }
  | {
      kind: 'paint-face';
      cmd: FaceMaterialPropertyCommand;
    }
  | {
      kind: 'reset-face-material';
      cmd: FaceMaterialPropertyCommand;
    }
  | {
      kind:
        | 'rotateMaterialOnFace'
        | 'moveMaterialOnFace'
        | 'scaleMaterialOnFace'
        | 'resetMaterialTransformOnFace';
      cmd: FaceMaterialPropertyCommand;
    };

/**
 * Project the click point onto the wall's start→end segment, returning
 * the parametric t in [0, 1]. Pure so it can be unit-tested.
 */
export function projectAlongT(
  hitPoint: { xMm: number; yMm: number },
  wallStartMm: { xMm: number; yMm: number },
  wallEndMm: { xMm: number; yMm: number },
): number {
  const ax = wallStartMm.xMm;
  const ay = wallStartMm.yMm;
  const bx = wallEndMm.xMm;
  const by = wallEndMm.yMm;
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = Math.max(abx * abx + aby * aby, 1e-9);
  const t = ((hitPoint.xMm - ax) * abx + (hitPoint.yMm - ay) * aby) / len2;
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

function matchingFaceOverride(
  overrides: readonly MaterialFaceOverride[] | null | undefined,
  faceKind: Exclude<MaterialFaceKind, 'generated'> | undefined,
): MaterialFaceOverride | null {
  if (!faceKind) return null;
  for (let i = (overrides?.length ?? 0) - 1; i >= 0; i -= 1) {
    const override = overrides![i];
    if (override.faceKind === faceKind && (override.generatedFaceId ?? null) === null) {
      return override;
    }
  }
  return null;
}

function replaceFaceOverride(
  open: WallFaceRadialMenuOpen,
  nextOverride: MaterialFaceOverride | null,
): FaceMaterialPropertyCommand {
  const faceKind = open.faceKind!;
  const existing = open.faceMaterialOverrides ?? [];
  const value = existing.filter(
    (override) => override.faceKind !== faceKind || (override.generatedFaceId ?? null) !== null,
  );
  if (nextOverride) value.push(nextOverride);
  return {
    type: 'updateElementProperty',
    elementId: open.wallId,
    key: 'faceMaterialOverrides',
    value,
  };
}

function buildFaceOverride(
  open: WallFaceRadialMenuOpen,
  patch: Partial<Pick<MaterialFaceOverride, 'uvOffsetMm' | 'uvRotationDeg' | 'uvScaleMm'>>,
): MaterialFaceOverride {
  const current = matchingFaceOverride(open.faceMaterialOverrides, open.faceKind);
  return {
    ...current,
    faceKind: open.faceKind!,
    materialKey: current?.materialKey ?? open.paintMaterialKey!,
    source: current?.source ?? 'paint',
    ...patch,
  };
}

function buildCommand(choice: Choice, open: WallFaceRadialMenuOpen): WallFaceRadialCommand {
  const t = projectAlongT(
    { xMm: open.hitPoint.xMm, yMm: open.hitPoint.yMm },
    open.wallStartMm,
    open.wallEndMm,
  );
  if (choice === 'door') {
    return {
      kind: 'door',
      cmd: {
        type: 'insertDoorOnWall',
        wallId: open.wallId,
        alongT: t,
        widthMm: 900,
      },
    };
  }
  if (choice === 'window') {
    return {
      kind: 'window',
      cmd: {
        type: 'insertWindowOnWall',
        wallId: open.wallId,
        alongT: t,
        widthMm: 1200,
        sillHeightMm: 900,
        heightMm: 1500,
      },
    };
  }
  if (choice === 'uv-rotate' && open.materialId) {
    return {
      kind: 'uv-rotate',
      cmd: {
        type: 'update_material_pbr',
        id: open.materialId,
        uvRotationDeg: ((open.currentUvRotationDeg ?? 0) + 15) % 360,
      },
    };
  }
  if (choice === 'paint-face' && open.faceKind && open.paintMaterialKey) {
    return {
      kind: 'paint-face',
      cmd: replaceFaceOverride(open, {
        faceKind: open.faceKind,
        materialKey: open.paintMaterialKey,
        source: 'paint' as const,
      }),
    };
  }
  if (choice === 'rotateMaterialOnFace' && open.faceKind && open.paintMaterialKey) {
    const current = matchingFaceOverride(open.faceMaterialOverrides, open.faceKind);
    return {
      kind: 'rotateMaterialOnFace',
      cmd: replaceFaceOverride(
        open,
        buildFaceOverride(open, { uvRotationDeg: ((current?.uvRotationDeg ?? 0) + 90) % 360 }),
      ),
    };
  }
  if (choice === 'moveMaterialOnFace' && open.faceKind && open.paintMaterialKey) {
    const current = matchingFaceOverride(open.faceMaterialOverrides, open.faceKind);
    return {
      kind: 'moveMaterialOnFace',
      cmd: replaceFaceOverride(
        open,
        buildFaceOverride(open, {
          uvOffsetMm: {
            uMm: (current?.uvOffsetMm?.uMm ?? 0) + 50,
            vMm: current?.uvOffsetMm?.vMm ?? 0,
          },
        }),
      ),
    };
  }
  if (choice === 'scaleMaterialOnFace' && open.faceKind && open.paintMaterialKey) {
    const current = matchingFaceOverride(open.faceMaterialOverrides, open.faceKind);
    return {
      kind: 'scaleMaterialOnFace',
      cmd: replaceFaceOverride(
        open,
        buildFaceOverride(open, {
          uvScaleMm: {
            uMm: Math.max(10, (current?.uvScaleMm?.uMm ?? 1000) * 0.5),
            vMm: Math.max(10, (current?.uvScaleMm?.vMm ?? 1000) * 0.5),
          },
        }),
      ),
    };
  }
  if (choice === 'resetMaterialTransformOnFace' && open.faceKind) {
    const current = matchingFaceOverride(open.faceMaterialOverrides, open.faceKind);
    if (current) {
      const {
        uvOffsetMm: _uvOffsetMm,
        uvRotationDeg: _uvRotationDeg,
        uvScaleMm: _uvScaleMm,
        ...rest
      } = current;
      return {
        kind: 'resetMaterialTransformOnFace',
        cmd: replaceFaceOverride(open, rest),
      };
    }
    return {
      kind: 'resetMaterialTransformOnFace',
      cmd: replaceFaceOverride(open, null),
    };
  }
  if (choice === 'reset-face-material' && open.faceKind) {
    return {
      kind: 'reset-face-material',
      cmd: replaceFaceOverride(open, null),
    };
  }
  // Opening — wrap a small range around the click point so the result
  // is visible without further drag.
  const half = 0.05;
  return {
    kind: 'opening',
    cmd: {
      type: 'createWallOpening',
      hostWallId: open.wallId,
      alongTStart: Math.max(0, t - half),
      alongTEnd: Math.min(1, t + half),
      sillHeightMm: 200,
      headHeightMm: 2400,
    },
  };
}

type Props = {
  open: WallFaceRadialMenuOpen | null;
  onSelect: (cmd: WallFaceRadialCommand) => void;
  onDismiss: () => void;
};

export function WallFaceRadialMenu({ open, onSelect, onDismiss }: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handler);
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => window.removeEventListener('keydown', handler);
  }, [open, onDismiss]);

  const materialId = open?.materialId;
  const canPaintFace = !!open?.faceKind && !!open?.paintMaterialKey;
  const currentFaceOverride = matchingFaceOverride(open?.faceMaterialOverrides, open?.faceKind);
  const hasFaceTransform =
    typeof currentFaceOverride?.uvRotationDeg === 'number' ||
    !!currentFaceOverride?.uvOffsetMm ||
    !!currentFaceOverride?.uvScaleMm;
  const canResetFaceMaterial =
    !!open?.faceKind &&
    !!open?.faceMaterialOverrides?.some(
      (override) =>
        override.faceKind === open.faceKind && (override.generatedFaceId ?? null) === null,
    );
  const items: { choice: Choice; label: string }[] = useMemo(
    () => [
      { choice: 'door', label: 'Insert Door' },
      { choice: 'window', label: 'Insert Window' },
      { choice: 'opening', label: 'Insert Opening' },
      ...(materialId ? ([{ choice: 'uv-rotate', label: 'Rotate UV +15°' }] as const) : []),
      ...(canPaintFace ? ([{ choice: 'paint-face', label: 'Paint Face...' }] as const) : []),
      ...(canPaintFace
        ? ([
            { choice: 'rotateMaterialOnFace', label: 'Rotate Texture 90°' },
            { choice: 'moveMaterialOnFace', label: 'Nudge Texture U' },
            { choice: 'scaleMaterialOnFace', label: 'Scale Texture 2x' },
          ] as const)
        : []),
      ...(hasFaceTransform
        ? ([{ choice: 'resetMaterialTransformOnFace', label: 'Reset Texture Align' }] as const)
        : []),
      ...(canResetFaceMaterial
        ? ([{ choice: 'reset-face-material', label: 'Reset Face Material' }] as const)
        : []),
    ],
    [canPaintFace, canResetFaceMaterial, hasFaceTransform, materialId],
  );

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      data-testid="wall-face-radial-menu"
      role="menu"
      style={{
        position: 'fixed',
        left: open.screen.x,
        top: open.screen.y,
        zIndex: 10_000,
        background: 'rgba(15, 23, 36, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderRadius: 6,
        padding: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 160,
        boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
      }}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
      onKeyDown={(e) => {
        const menuItems = Array.from(
          menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
        );
        const idx = menuItems.indexOf(document.activeElement as HTMLElement);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          menuItems[(idx + 1) % menuItems.length]?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          menuItems[(idx - 1 + menuItems.length) % menuItems.length]?.focus();
        }
      }}
    >
      {items.map(({ choice, label }) => (
        <button
          key={choice}
          role="menuitem"
          data-testid={`wall-face-radial-menu-${choice}`}
          type="button"
          onClick={() => {
            onSelect(buildCommand(choice, open));
            onDismiss();
          }}
          style={{
            background: 'transparent',
            color: '#fff',
            border: 'none',
            textAlign: 'left',
            padding: '6px 10px',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
