/* eslint-disable bim-ai/no-hex-in-chrome -- migrated PlanCanvas render pass literals */
import type { Element } from '@bim-ai/core';
import * as THREE from 'three';

import type { CategoryOverride } from '../state/storeTypes';
import { extractAreaPrimitives } from './areaRender';
import { extractDetailComponentPrimitives } from './detailComponentsRender';
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
import { manualPlacedTagLabel } from './manualTags';
import { planAnnotationLabelSprite, tagLeaderLineThree } from './planElementMeshBuilders';
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

export function renderDetailComponents(
  grp: THREE.Group,
  elementsById: Record<string, Element>,
  activePlanViewId: string | undefined,
  hiddenSemanticKinds: ReadonlySet<string>,
  hiddenElementIds: ReadonlySet<string>,
  revealHiddenMode: boolean,
): void {
  for (let i = grp.children.length - 1; i >= 0; i--) {
    const ch = grp.children[i]!;
    if ((ch.userData as { detailComponent?: unknown }).detailComponent) grp.remove(ch);
  }
  if (!activePlanViewId) return;

  const detailPrims = extractDetailComponentPrimitives(elementsById, activePlanViewId);
  for (const p of detailPrims) {
    if (hiddenElementIds.has(p.id) && !revealHiddenMode) continue;
    if (p.kind === 'detail_line') {
      if (hiddenSemanticKinds.has('detail_line') && !revealHiddenMode) continue;
      const detailLineReveal =
        (revealHiddenMode && hiddenSemanticKinds.has('detail_line')) ||
        (revealHiddenMode && hiddenElementIds.has(p.id));
      const detailLineColor = detailLineReveal ? '#ff00ff' : p.colour;
      const pts = p.pointsMm.map(
        (pt) => new THREE.Vector3(pt.xMm / 1000, SLICE_Y + 0.004, pt.yMm / 1000),
      );
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat =
        p.style === 'dashed' || p.style === 'dotted'
          ? new THREE.LineDashedMaterial({
              color: detailLineColor,
              dashSize: p.style === 'dotted' ? 0.05 : 0.2,
              gapSize: p.style === 'dotted' ? 0.05 : 0.1,
              linewidth: p.strokeMm,
            })
          : new THREE.LineBasicMaterial({ color: detailLineColor, linewidth: p.strokeMm });
      const line = new THREE.Line(geom, mat);
      if (p.style !== 'solid') line.computeLineDistances();
      line.userData.detailComponent = true;
      line.userData.bimPickId = p.id;
      grp.add(line);
    } else if (p.kind === 'detail_region') {
      const shape = new THREE.Shape();
      if (p.boundaryMm.length >= 3) {
        shape.moveTo(p.boundaryMm[0]!.xMm / 1000, p.boundaryMm[0]!.yMm / 1000);
        for (let i = 1; i < p.boundaryMm.length; i++) {
          shape.lineTo(p.boundaryMm[i]!.xMm / 1000, p.boundaryMm[i]!.yMm / 1000);
        }
        shape.closePath();
      }
      const geom = new THREE.ShapeGeometry(shape);
      geom.rotateX(-Math.PI / 2);
      geom.translate(0, SLICE_Y + 0.003, 0);
      const fill = new THREE.Mesh(
        geom,
        new THREE.MeshBasicMaterial({
          color: p.fillColour,
          transparent: true,
          opacity: p.fillPattern === 'solid' ? 1.0 : 0.55,
          side: THREE.DoubleSide,
        }),
      );
      fill.userData.detailComponent = true;
      fill.userData.bimPickId = p.id;
      grp.add(fill);
      if (p.strokeMm > 0) {
        const strokePts = p.boundaryMm.map(
          (pt) => new THREE.Vector3(pt.xMm / 1000, SLICE_Y + 0.0035, pt.yMm / 1000),
        );
        if (strokePts.length > 0) strokePts.push(strokePts[0]!.clone());
        const sgeom = new THREE.BufferGeometry().setFromPoints(strokePts);
        const sline = new THREE.Line(
          sgeom,
          new THREE.LineBasicMaterial({ color: p.strokeColour, linewidth: p.strokeMm }),
        );
        sline.userData.detailComponent = true;
        grp.add(sline);
      }
    } else if (p.kind === 'text_note') {
      if (hiddenSemanticKinds.has('text_note') && !revealHiddenMode) continue;
      const textNoteReveal =
        (revealHiddenMode && hiddenSemanticKinds.has('text_note')) ||
        (revealHiddenMode && hiddenElementIds.has(p.id));
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx2 = canvas.getContext('2d');
      if (ctx2) {
        const fillColor = textNoteReveal ? '#ff00ff' : (p.colorHex ?? p.colour);
        const fontStyle = p.italic ? 'italic ' : '';
        const fontWeight = p.bold ? 'bold ' : '';
        const fontFace = p.fontFamily ?? 'sans-serif';
        const fontPx = Math.max(12, Math.round(48));
        ctx2.font = `${fontStyle}${fontWeight}${fontPx}px ${fontFace}`;
        ctx2.fillStyle = fillColor;
        ctx2.textAlign = p.horizontalAlign ?? 'left';
        ctx2.textBaseline = 'top';
        const textX =
          p.horizontalAlign === 'center' ? 128 : p.horizontalAlign === 'right' ? 252 : 4;
        ctx2.fillText(p.text, textX, 4);
        if (p.underline) {
          const metrics = ctx2.measureText(p.text);
          const lineY = 4 + fontPx + 2;
          ctx2.strokeStyle = fillColor;
          ctx2.lineWidth = Math.max(1, fontPx / 24);
          ctx2.beginPath();
          ctx2.moveTo(textX, lineY);
          ctx2.lineTo(textX + metrics.width, lineY);
          ctx2.stroke();
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      const heightM = (p.fontSizeMm / 1000) * 1.4;
      sprite.scale.set(heightM * (canvas.width / canvas.height), heightM, 1);
      sprite.position.set(p.positionMm.xMm / 1000, SLICE_Y + 0.01, p.positionMm.yMm / 1000);
      sprite.userData.detailComponent = true;
      sprite.userData.bimPickId = p.id;
      grp.add(sprite);
    } else if (p.kind === 'material_tag') {
      const labelText = p.textOverride ?? 'Material';
      grp.add(
        createPlanTextSprite({
          text: labelText,
          color: p.colour,
          font: '26px sans-serif',
          textX: 8,
          scaleX: 0.3 * (256 / 64),
          scaleY: 0.3,
          xMm: p.positionMm.xMm,
          yMm: p.positionMm.yMm,
          sliceY: SLICE_Y + 0.01,
          pickId: p.id,
          userData: { detailComponent: true },
          drawBeforeText: (ctx) => {
            ctx.strokeStyle = p.colour;
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, 254, 62);
          },
        }),
      );
      if (p.leaderEndMm) {
        const leader = tagLeaderLineThree(p.leaderEndMm, p.positionMm, SLICE_Y + 0.002);
        leader.userData.detailComponent = true;
        grp.add(leader);
      }
    } else if (
      p.kind === 'annotation_symbol' ||
      p.kind === 'spot_elevation' ||
      p.kind === 'spot_coordinate' ||
      p.kind === 'spot_slope'
    ) {
      const lt =
        p.kind === 'spot_elevation'
          ? `${p.prefix}${(p.elevationMm / 1000).toFixed(3)}${p.suffix}`
          : p.kind === 'spot_coordinate'
            ? `N${(p.northMm / 1000).toFixed(2)} E${(p.eastMm / 1000).toFixed(2)}`
            : p.kind === 'spot_slope'
              ? `${p.slopePct.toFixed(1)}%`
              : p.symbolType;
      const aPos = 'positionMm' in p ? p.positionMm : { xMm: 0, yMm: 0 };
      grp.add(
        createPlanTextSprite({
          text: lt,
          color: p.colour,
          scaleX: 0.3 * (256 / 64),
          scaleY: 0.3,
          xMm: aPos.xMm,
          yMm: aPos.yMm,
          sliceY: SLICE_Y + 0.01,
          pickId: p.id,
          userData: { detailComponent: true },
        }),
      );
    } else if (p.kind === 'radial_dimension' || p.kind === 'diameter_dimension') {
      const rMat = new THREE.LineBasicMaterial({ color: p.colour });
      const rLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(p.arcPointMm.xMm / 1000, SLICE_Y + 0.01, p.arcPointMm.yMm / 1000),
          new THREE.Vector3(p.centerMm.xMm / 1000, SLICE_Y + 0.01, p.centerMm.yMm / 1000),
        ]),
        rMat,
      );
      rLine.userData.detailComponent = true;
      rLine.userData.bimPickId = p.id;
      grp.add(rLine);
      const dx = p.arcPointMm.xMm - p.centerMm.xMm;
      const dy = p.arcPointMm.yMm - p.centerMm.yMm;
      const rMm = Math.sqrt(dx * dx + dy * dy);
      const rLbl =
        p.kind === 'diameter_dimension' ? `ø${(rMm * 2).toFixed(0)}` : `R${rMm.toFixed(0)}`;
      grp.add(
        createPlanTextSprite({
          text: rLbl,
          color: p.colour,
          width: 192,
          scaleX: 0.25 * (192 / 64),
          scaleY: 0.25,
          xMm: (p.arcPointMm.xMm + p.centerMm.xMm) / 2,
          yMm: (p.arcPointMm.yMm + p.centerMm.yMm) / 2,
          sliceY: SLICE_Y + 0.01,
          pickId: p.id,
          userData: { detailComponent: true },
        }),
      );
    } else if (p.kind === 'arc_length_dimension') {
      const aldOffsetMm = p.offsetMm ?? 200;
      const aldInnerRadM = p.radiusMm / 1000;
      const aldDimRadM = (p.radiusMm + aldOffsetMm) / 1000;
      const aldOuterRadM = aldDimRadM + 50 / 1000;
      const aldCx = p.centerMm.xMm / 1000;
      const aldCz = p.centerMm.yMm / 1000;
      const aldColour = p.colour;
      const aldLineMat = new THREE.LineBasicMaterial({ color: aldColour });

      const aldArcPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 32; i++) {
        const angRad = THREE.MathUtils.degToRad(
          p.startAngleDeg + ((p.endAngleDeg - p.startAngleDeg) * i) / 32,
        );
        aldArcPts.push(
          new THREE.Vector3(
            aldCx + Math.cos(angRad) * aldDimRadM,
            SLICE_Y + 0.01,
            aldCz + Math.sin(angRad) * aldDimRadM,
          ),
        );
      }
      const aldArcLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(aldArcPts),
        aldLineMat,
      );
      aldArcLine.userData.detailComponent = true;
      aldArcLine.userData.bimPickId = p.id;
      grp.add(aldArcLine);

      [p.startAngleDeg, p.endAngleDeg].forEach((deg) => {
        const angRad = THREE.MathUtils.degToRad(deg);
        const cosA = Math.cos(angRad);
        const sinA = Math.sin(angRad);
        const extGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(
            aldCx + cosA * aldInnerRadM,
            SLICE_Y + 0.01,
            aldCz + sinA * aldInnerRadM,
          ),
          new THREE.Vector3(
            aldCx + cosA * aldOuterRadM,
            SLICE_Y + 0.01,
            aldCz + sinA * aldOuterRadM,
          ),
        ]);
        const extLine = new THREE.Line(extGeom, aldLineMat);
        extLine.userData.detailComponent = true;
        extLine.userData.bimPickId = p.id;
        grp.add(extLine);
      });

      const aldMidRad = THREE.MathUtils.degToRad((p.startAngleDeg + p.endAngleDeg) / 2);
      const arcLen = ((Math.abs(p.endAngleDeg - p.startAngleDeg) * Math.PI) / 180) * p.radiusMm;
      grp.add(
        createPlanTextSprite({
          text: `arc ${arcLen.toFixed(0)}`,
          color: aldColour,
          width: 192,
          scaleX: 0.25 * (192 / 64),
          scaleY: 0.25,
          xMm: (aldCx + Math.cos(aldMidRad) * aldDimRadM) * 1000,
          yMm: (aldCz + Math.sin(aldMidRad) * aldDimRadM) * 1000,
          sliceY: SLICE_Y + 0.015,
          pickId: p.id,
          userData: { detailComponent: true },
        }),
      );
    } else if (p.kind === 'angular_dimension') {
      const angM = new THREE.LineBasicMaterial({ color: p.colour });
      [
        [
          [p.vertexMm, p.rayAMm],
          [p.vertexMm, p.rayBMm],
        ],
      ]
        .flat()
        .forEach(([a, b]) => {
          const l = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(a.xMm / 1000, SLICE_Y + 0.01, a.yMm / 1000),
              new THREE.Vector3(b.xMm / 1000, SLICE_Y + 0.01, b.yMm / 1000),
            ]),
            angM,
          );
          l.userData.detailComponent = true;
          l.userData.bimPickId = p.id;
          grp.add(l);
        });
      const aA = Math.atan2(p.rayAMm.yMm - p.vertexMm.yMm, p.rayAMm.xMm - p.vertexMm.xMm);
      const aB = Math.atan2(p.rayBMm.yMm - p.vertexMm.yMm, p.rayBMm.xMm - p.vertexMm.xMm);
      const angDeg = Math.abs(((aB - aA) * 180) / Math.PI);
      const mA = (aA + aB) / 2;
      grp.add(
        createPlanTextSprite({
          text: `${angDeg.toFixed(1)}°`,
          color: p.colour,
          width: 192,
          scaleX: 0.25 * (192 / 64),
          scaleY: 0.25,
          xMm: p.vertexMm.xMm + p.arcRadiusMm * Math.cos(mA),
          yMm: p.vertexMm.yMm + p.arcRadiusMm * Math.sin(mA),
          sliceY: SLICE_Y + 0.01,
          pickId: p.id,
          userData: { detailComponent: true },
        }),
      );
    } else if (p.kind === 'leader_text') {
      const ltMat = new THREE.LineBasicMaterial({ color: p.colour });
      const ltPts: THREE.Vector3[] = [
        new THREE.Vector3(p.anchorMm.xMm / 1000, SLICE_Y + 0.01, p.anchorMm.yMm / 1000),
      ];
      if (p.elbowMm) {
        ltPts.push(new THREE.Vector3(p.elbowMm.xMm / 1000, SLICE_Y + 0.01, p.elbowMm.yMm / 1000));
      }
      ltPts.push(new THREE.Vector3(p.textMm.xMm / 1000, SLICE_Y + 0.01, p.textMm.yMm / 1000));
      const ltLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ltPts), ltMat);
      ltLine.userData.detailComponent = true;
      ltLine.userData.bimPickId = p.id;
      grp.add(ltLine);
      grp.add(
        createPlanTextSprite({
          text: p.content,
          color: p.colour,
          scaleX: 0.3 * (256 / 64),
          scaleY: 0.3,
          xMm: p.textMm.xMm,
          yMm: p.textMm.yMm,
          sliceY: SLICE_Y + 0.01,
          pickId: p.id,
          userData: { detailComponent: true },
        }),
      );
    } else if (p.kind === 'revision_cloud' && p.boundaryMm.length >= 2) {
      const rcL = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(
          [...p.boundaryMm, p.boundaryMm[0]!].map(
            (v) => new THREE.Vector3(v.xMm / 1000, SLICE_Y + 0.01, v.yMm / 1000),
          ),
        ),
        new THREE.LineBasicMaterial({ color: p.colour }),
      );
      rcL.userData.detailComponent = true;
      rcL.userData.bimPickId = p.id;
      grp.add(rcL);
    } else if (p.kind === 'insulation_annotation') {
      const insL = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(p.startMm.xMm / 1000, SLICE_Y + 0.01, p.startMm.yMm / 1000),
          new THREE.Vector3(p.endMm.xMm / 1000, SLICE_Y + 0.01, p.endMm.yMm / 1000),
        ]),
        new THREE.LineBasicMaterial({ color: p.colour }),
      );
      insL.userData.detailComponent = true;
      insL.userData.bimPickId = p.id;
      grp.add(insL);
    }
  }
}

export function renderPlacedTags(
  grp: THREE.Group,
  elementsById: Record<string, Element>,
  activePlanViewId: string | undefined,
  hiddenSemanticKinds: ReadonlySet<string>,
  hiddenElementIds: ReadonlySet<string>,
  revealHiddenMode: boolean,
): void {
  for (let i = grp.children.length - 1; i >= 0; i--) {
    const ch = grp.children[i]!;
    if ((ch.userData as { placedTag?: unknown }).placedTag) grp.remove(ch);
  }
  if (!activePlanViewId || (hiddenSemanticKinds.has('placed_tag') && !revealHiddenMode)) return;

  const placedTagReveal = revealHiddenMode && hiddenSemanticKinds.has('placed_tag');
  for (const tag of Object.values(elementsById)) {
    if (tag.kind !== 'placed_tag') continue;
    if (tag.hostViewId !== activePlanViewId) continue;
    if (hiddenElementIds.has(tag.id) && !revealHiddenMode) continue;
    const host = elementsById[tag.hostElementId];
    if (host && hiddenElementIds.has(host.id) && !revealHiddenMode) continue;
    const label = manualPlacedTagLabel(tag, elementsById);
    const sprite = planAnnotationLabelSprite(
      tag.positionMm.xMm / 1000,
      tag.positionMm.yMm / 1000,
      label,
      tag.id,
    );
    sprite.position.y = SLICE_Y + 0.012;
    sprite.userData.placedTag = true;
    sprite.userData.elementId = tag.id;
    if (tag.categoryKind === 'room') sprite.userData.placedTagKind = 'room';
    if (placedTagReveal || (revealHiddenMode && hiddenElementIds.has(tag.id))) {
      sprite.material.color.set('#ff00ff');
    }
    grp.add(sprite);
    if (tag.leaderEndMm) {
      const leader = tagLeaderLineThree(tag.leaderEndMm, tag.positionMm, SLICE_Y + 0.002);
      leader.userData.placedTag = true;
      grp.add(leader);
    }
  }
}
