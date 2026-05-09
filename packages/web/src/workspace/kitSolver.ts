/**
 * AST-V3-04 — TypeScript mirror of app/bim_ai/kits/kitchen.py::solve_chain
 *
 * Must remain behaviourally identical to the Python implementation so the
 * live drag-rebalance in KitChainEditor matches the server-side solver.
 */

import type { FamilyKitInstanceElem, KitComponent } from '@bim-ai/core';

export const BASE_HEIGHT_MM = 870;
export const BASE_DEPTH_MM = 600;
export const UPPER_HEIGHT_MM = 720;
export const UPPER_DEPTH_MM = 330;
export const PANTRY_HEIGHT_MM = 2200;

export type ResolvedComponent = {
  componentKind: KitComponent['componentKind'];
  xStartMm: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  doorStyle: string | null | undefined;
  materialId: string | null | undefined;
};

function defaultHeight(kind: KitComponent['componentKind']): number {
  const map: Partial<Record<KitComponent['componentKind'], number>> = {
    base: BASE_HEIGHT_MM,
    upper: UPPER_HEIGHT_MM,
    oven_housing: BASE_HEIGHT_MM,
    sink: BASE_HEIGHT_MM,
    pantry: PANTRY_HEIGHT_MM,
    dishwasher: BASE_HEIGHT_MM,
    fridge: 2000,
    end_panel: BASE_HEIGHT_MM,
  };
  return map[kind] ?? BASE_HEIGHT_MM;
}

function defaultDepth(kind: KitComponent['componentKind']): number {
  const map: Partial<Record<KitComponent['componentKind'], number>> = {
    upper: UPPER_DEPTH_MM,
    pantry: BASE_DEPTH_MM,
  };
  return map[kind] ?? BASE_DEPTH_MM;
}

/**
 * Resolve component widths and positions along the wall.
 *
 * Mirror of Python solve_chain: components with widthMm=null/undefined share
 * the remaining run equally. Returns an empty array if the run is zero or negative.
 */
export function solveChain(kit: FamilyKitInstanceElem): ResolvedComponent[] {
  const totalRun = kit.endMm - kit.startMm;
  if (totalRun <= 0) return [];

  const components = kit.components;

  let explicitRun = 0;
  for (const c of components) {
    if (c.widthMm != null && c.componentKind !== 'countertop') {
      explicitRun += c.widthMm;
    }
  }

  const autoFill = components.filter(
    (c) => c.widthMm == null && c.componentKind !== 'countertop' && c.componentKind !== 'end_panel',
  );
  const autoWidth = autoFill.length > 0 ? (totalRun - explicitRun) / autoFill.length : 0;

  const resolved: ResolvedComponent[] = [];
  let x = kit.startMm;

  for (const comp of components) {
    if (comp.componentKind === 'countertop') continue;
    const w = comp.widthMm ?? autoWidth;
    const h = comp.heightMm ?? defaultHeight(comp.componentKind);
    const d = comp.depthMm ?? defaultDepth(comp.componentKind);
    resolved.push({
      componentKind: comp.componentKind,
      xStartMm: x,
      widthMm: w,
      heightMm: h,
      depthMm: d,
      doorStyle: comp.doorStyle,
      materialId: comp.materialId,
    });
    x += w;
  }

  return resolved;
}
