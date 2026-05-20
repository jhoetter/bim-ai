/* eslint-disable bim-ai/no-hex-in-chrome -- migrated PlanCanvas render pass literals */
import type { Element } from '@bim-ai/core';
import * as THREE from 'three';

import type { CategoryOverride } from '../state/storeTypes';
import { extractAreaPrimitives } from './areaRender';
import {
  dxfViewOverrideKey,
  isDxfLayerHidden,
  isDxfLinkVisibleInView,
  makeDxfLinkTransform,
  resolveDxfPrimitiveColor,
  resolveDxfUnderlayStyle,
  selectDxfUnderlaysForLevel,
} from './dxfUnderlay';
import { extractMaskingRegionPrimitives } from './maskingRegionRender';
import { extractNeighborhoodMassPrimitives } from './neighborhoodMassRender';
import { SLICE_Y, orthoExtents } from './interaction/planCameraMath';
import { readPlanToken } from './planCanvasHelpers';
import { createPlanTextSprite } from './planTextSprites';
import { extractPlanRegionOverlays } from './planProjection';

export function renderNeighborhoodMasses(
  grp: THREE.Group,
  elementsById: Record<string, Element>,
  activePlanViewId: string | undefined,
  showNeighborhoodMasses: boolean,
): void {
  for (let i = grp.children.length - 1; i >= 0; i--) {
    const ch = grp.children[i]!;
    if ((ch.userData as { neighborhoodMass?: unknown }).neighborhoodMass) grp.remove(ch);
  }

  const activePv = activePlanViewId ? elementsById[activePlanViewId] : null;
  const rawViewKind =
    activePv && 'subKind' in activePv ? (activePv.subKind as string | undefined) : undefined;
  const viewKind = rawViewKind ?? 'site_plan';

  const massPrims = extractNeighborhoodMassPrimitives(elementsById, {
    viewKind,
    showNeighborhoodMasses,
  });
  const massColor = readPlanToken('--neighborhood-mass-color', '#a8a39c');

  for (const m of massPrims) {
    if (m.footprintMm.length < 3) continue;
    const shape = new THREE.Shape();
    shape.moveTo(m.footprintMm[0]!.xMm / 1000, m.footprintMm[0]!.yMm / 1000);
    for (let i = 1; i < m.footprintMm.length; i++) {
      shape.lineTo(m.footprintMm[i]!.xMm / 1000, m.footprintMm[i]!.yMm / 1000);
    }
    shape.closePath();
    const geom = new THREE.ShapeGeometry(shape);
    geom.rotateX(-Math.PI / 2);
    geom.translate(0, SLICE_Y - 0.002, 0);
    const fill = new THREE.Mesh(
      geom,
      new THREE.MeshBasicMaterial({
        color: massColor,
        transparent: true,
        opacity: m.fillAlpha,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    fill.userData.neighborhoodMass = true;
    fill.userData.bimPickId = m.id;
    fill.renderOrder = -1;
    grp.add(fill);
  }
}

export function renderDraftGrid(
  grp: THREE.Group,
  half: number,
  draftGridVisible: boolean,
  lineWeights: { gridMajor: number | null; gridMinor: number | null },
): void {
  for (let i = grp.children.length - 1; i >= 0; i--) {
    const ch = grp.children[i]!;
    if ((ch.userData as { draftingGrid?: unknown }).draftingGrid) grp.remove(ch);
  }

  const { gridMajor, gridMinor } = lineWeights;
  const span = half * 3.8;
  const minorStep = orthoExtents(half).stepMm / 1000;
  const majorStep = minorStep * 5;
  const addDraftGrid = (step: number, color: string, opacity: number) => {
    const gv: THREE.Vector3[] = [];
    for (let x = -span; x <= span; x += step) {
      gv.push(new THREE.Vector3(x, SLICE_Y, -span), new THREE.Vector3(x, SLICE_Y, span));
    }
    for (let z = -span; z <= span; z += step) {
      gv.push(new THREE.Vector3(-span, SLICE_Y, z), new THREE.Vector3(span, SLICE_Y, z));
    }
    if (!gv.length) return;
    const g = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(gv),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
    g.userData.draftingGrid = true;
    grp.add(g);
  };

  if (draftGridVisible && gridMajor !== null)
    addDraftGrid(majorStep, readPlanToken('--draft-grid-major', '#223042'), 0.45);
  if (draftGridVisible && gridMinor !== null)
    addDraftGrid(minorStep, readPlanToken('--draft-grid-minor', '#1a2738'), 0.25);
}

export function renderDxfUnderlays(
  grp: THREE.Group,
  elementsById: Record<string, Element>,
  dxfLevelId: string | undefined,
  activePlanViewId: string | undefined,
): void {
  for (let i = grp.children.length - 1; i >= 0; i--) {
    const ch = grp.children[i]!;
    if ((ch.userData as { dxfUnderlay?: unknown }).dxfUnderlay) grp.remove(ch);
  }

  const dxfUnderlays = selectDxfUnderlaysForLevel(elementsById, dxfLevelId);
  const activePlanView = activePlanViewId ? elementsById[activePlanViewId] : undefined;
  const dxfViewOverrides =
    activePlanView?.kind === 'plan_view'
      ? ((activePlanView.categoryOverrides ?? {}) as Record<string, CategoryOverride>)
      : {};

  for (const link of dxfUnderlays) {
    if (!link.linework || link.linework.length === 0) continue;
    const dxfOverride = dxfViewOverrides[dxfViewOverrideKey(link.id)];
    if (!isDxfLinkVisibleInView(link, dxfOverride)) continue;
    const transform = makeDxfLinkTransform(link, elementsById);
    const project = (xMm: number, yMm: number): THREE.Vector3 => {
      const p = transform({ xMm, yMm });
      return new THREE.Vector3(p.xMm / 1000, SLICE_Y - 0.001, p.yMm / 1000);
    };
    const style = resolveDxfUnderlayStyle(link, dxfOverride);
    const makeMat = (color: string) =>
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: style.opacity,
        linewidth: 1,
      });
    const segmentGroups = new Map<string, THREE.Vector3[]>();
    const pushSegment = (color: string, a: THREE.Vector3, b: THREE.Vector3): void => {
      const group = segmentGroups.get(color) ?? [];
      group.push(a, b);
      segmentGroups.set(color, group);
    };
    const pushPrimSegment = (
      prim: (typeof link.linework)[number],
      a: THREE.Vector3,
      b: THREE.Vector3,
    ): void => {
      pushSegment(resolveDxfPrimitiveColor(link, prim, style), a, b);
    };
    const mat = new THREE.LineBasicMaterial({
      color: style.color,
      transparent: true,
      opacity: style.opacity,
      linewidth: 1,
    });
    const segments: THREE.Vector3[] = [];
    for (const prim of link.linework) {
      if (isDxfLayerHidden(link, prim, dxfOverride)) continue;
      if (prim.kind === 'line') {
        const a = project(prim.start.xMm, prim.start.yMm);
        const b = project(prim.end.xMm, prim.end.yMm);
        segments.push(a, b);
        pushPrimSegment(prim, a, b);
      } else if (prim.kind === 'polyline') {
        if (prim.points.length < 2) continue;
        for (let i = 0; i < prim.points.length - 1; i++) {
          const a = project(prim.points[i]!.xMm, prim.points[i]!.yMm);
          const b = project(prim.points[i + 1]!.xMm, prim.points[i + 1]!.yMm);
          segments.push(a, b);
          pushPrimSegment(prim, a, b);
        }
        if (prim.closed) {
          const lastIdx = prim.points.length - 1;
          const a = project(prim.points[lastIdx]!.xMm, prim.points[lastIdx]!.yMm);
          const b = project(prim.points[0]!.xMm, prim.points[0]!.yMm);
          segments.push(a, b);
          pushPrimSegment(prim, a, b);
        }
      } else if (prim.kind === 'arc') {
        const start = prim.startDeg;
        let end = prim.endDeg;
        if (end < start) end += 360;
        const sweep = Math.max(0.0001, end - start);
        const steps = Math.max(2, Math.ceil(sweep / 3));
        for (let i = 0; i < steps; i++) {
          const t0 = ((start + (sweep * i) / steps) * Math.PI) / 180;
          const t1 = ((start + (sweep * (i + 1)) / steps) * Math.PI) / 180;
          const a = project(
            prim.center.xMm + prim.radiusMm * Math.cos(t0),
            prim.center.yMm + prim.radiusMm * Math.sin(t0),
          );
          const b = project(
            prim.center.xMm + prim.radiusMm * Math.cos(t1),
            prim.center.yMm + prim.radiusMm * Math.sin(t1),
          );
          segments.push(a, b);
          pushPrimSegment(prim, a, b);
        }
      }
    }
    if (segments.length === 0) continue;
    if (style.colorMode === 'native') {
      for (const [color, colorSegments] of segmentGroups) {
        if (colorSegments.length === 0) continue;
        const geom = new THREE.BufferGeometry().setFromPoints(colorSegments);
        const lineSeg = new THREE.LineSegments(geom, makeMat(color));
        lineSeg.userData.dxfUnderlay = true;
        lineSeg.userData.bimPickId = link.id;
        grp.add(lineSeg);
      }
    } else {
      const geom = new THREE.BufferGeometry().setFromPoints(segments);
      const lineSeg = new THREE.LineSegments(geom, mat);
      lineSeg.userData.dxfUnderlay = true;
      lineSeg.userData.bimPickId = link.id;
      grp.add(lineSeg);
    }
  }
}

export function renderMaskingRegions(
  grp: THREE.Group,
  elementsById: Record<string, Element>,
  activePlanViewId: string | undefined,
): void {
  for (let i = grp.children.length - 1; i >= 0; i--) {
    const ch = grp.children[i]!;
    if ((ch.userData as { maskingRegion?: unknown }).maskingRegion) grp.remove(ch);
  }
  if (!activePlanViewId) return;

  const maskingPrims = extractMaskingRegionPrimitives(elementsById, activePlanViewId);
  for (const m of maskingPrims) {
    if (m.boundaryMm.length < 3) continue;
    const shape = new THREE.Shape();
    shape.moveTo(m.boundaryMm[0]!.xMm / 1000, m.boundaryMm[0]!.yMm / 1000);
    for (let i = 1; i < m.boundaryMm.length; i++) {
      shape.lineTo(m.boundaryMm[i]!.xMm / 1000, m.boundaryMm[i]!.yMm / 1000);
    }
    shape.closePath();
    for (const voidLoop of m.voidBoundariesMm) {
      if (voidLoop.length < 3) continue;
      const hole = new THREE.Path();
      hole.moveTo(voidLoop[0]!.xMm / 1000, voidLoop[0]!.yMm / 1000);
      for (let i = 1; i < voidLoop.length; i++) {
        hole.lineTo(voidLoop[i]!.xMm / 1000, voidLoop[i]!.yMm / 1000);
      }
      hole.closePath();
      shape.holes.push(hole);
    }
    const geom = new THREE.ShapeGeometry(shape);
    geom.rotateX(-Math.PI / 2);
    geom.translate(0, SLICE_Y + 0.0015, 0);
    const fill = new THREE.Mesh(
      geom,
      new THREE.MeshBasicMaterial({
        color: m.fillColor,
        transparent: false,
        opacity: 1.0,
        side: THREE.DoubleSide,
      }),
    );
    fill.userData.maskingRegion = true;
    fill.userData.bimPickId = m.id;
    grp.add(fill);
  }
}

export function renderPlanRegionOverlays(
  grp: THREE.Group,
  elementsById: Record<string, Element>,
  planRegionLevelId: string | undefined,
): void {
  for (let i = grp.children.length - 1; i >= 0; i--) {
    const ch = grp.children[i]!;
    if ((ch.userData as { planRegion?: unknown }).planRegion) grp.remove(ch);
  }
  if (!planRegionLevelId) return;

  const witnessColor = readPlanToken('--draft-witness', '#64748b');
  const regionOverlays = extractPlanRegionOverlays(elementsById, planRegionLevelId);
  for (const r of regionOverlays) {
    if (r.outlineMm.length < 3) continue;
    const rPts = r.outlineMm.map(
      (pt) => new THREE.Vector3(pt.xMm / 1000, SLICE_Y + 0.003, pt.yMm / 1000),
    );
    rPts.push(rPts[0]!.clone());
    const rGeom = new THREE.BufferGeometry().setFromPoints(rPts);
    const rLine = new THREE.Line(
      rGeom,
      new THREE.LineDashedMaterial({
        color: witnessColor,
        dashSize: 0.12,
        gapSize: 0.06,
        linewidth: 1,
      }),
    );
    rLine.computeLineDistances();
    rLine.userData.planRegion = true;
    rLine.userData.bimPickId = r.id;
    grp.add(rLine);
  }
}

export function renderAreaPlanOverlays(
  grp: THREE.Group,
  elementsById: Record<string, Element>,
  activePlanViewId: string | undefined,
  hiddenSemanticKinds: ReadonlySet<string>,
  hiddenElementIds: ReadonlySet<string>,
  revealHiddenMode: boolean,
): void {
  for (let i = grp.children.length - 1; i >= 0; i--) {
    const ch = grp.children[i]!;
    if ((ch.userData as { areaElement?: unknown }).areaElement) grp.remove(ch);
  }

  const activeAreaPlan = activePlanViewId ? elementsById[activePlanViewId] : null;
  const areaPlanScheme =
    activeAreaPlan?.kind === 'plan_view' && activeAreaPlan.planViewSubtype === 'area_plan'
      ? (activeAreaPlan.areaScheme ?? 'gross_building')
      : undefined;
  const areaLevelId =
    activeAreaPlan?.kind === 'plan_view' && activeAreaPlan.planViewSubtype === 'area_plan'
      ? activeAreaPlan.levelId
      : undefined;
  if (
    !areaLevelId ||
    !areaPlanScheme ||
    (hiddenSemanticKinds.has('area_boundary') && !revealHiddenMode)
  ) {
    return;
  }

  const areaPrims = extractAreaPrimitives(elementsById, areaLevelId, areaPlanScheme);
  const areaCategoryReveal = revealHiddenMode && hiddenSemanticKinds.has('area_boundary');
  for (const a of areaPrims) {
    if (hiddenElementIds.has(a.id) && !revealHiddenMode) continue;
    const areaBoundaryReveal =
      areaCategoryReveal || (revealHiddenMode && hiddenElementIds.has(a.id));
    if (a.boundaryMm.length >= 3) {
      const strokePts = a.boundaryMm.map(
        (pt) => new THREE.Vector3(pt.xMm / 1000, SLICE_Y + 0.0028, pt.yMm / 1000),
      );
      strokePts.push(strokePts[0]!.clone());
      const sgeom = new THREE.BufferGeometry().setFromPoints(strokePts);
      const sline = new THREE.Line(
        sgeom,
        new THREE.LineDashedMaterial({
          color: areaBoundaryReveal ? '#ff00ff' : '#d2363b',
          dashSize: 0.18,
          gapSize: 0.08,
          linewidth: 2,
        }),
      );
      sline.computeLineDistances();
      sline.userData.areaElement = true;
      sline.userData.bimPickId = a.id;
      grp.add(sline);
    }
    grp.add(
      createPlanTextSprite({
        text: a.tagLabel,
        color: areaBoundaryReveal ? '#ff00ff' : '#d2363b',
        textX: 128,
        textAlign: 'center',
        scaleX: 2.4,
        scaleY: 0.6,
        xMm: a.centroidMm.xMm,
        yMm: a.centroidMm.yMm,
        sliceY: SLICE_Y + 0.012,
        pickId: a.id,
        userData: { areaElement: true },
      }),
    );
  }
}
