import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { BUILT_IN_FAMILIES } from '../families/familyCatalog';
import {
  buildFamilyParamMap,
  isVisibleByBinding,
  type FamilyCatalogLookup,
  type HostParams,
} from '../families/familyResolver';
import type { FamilyDefinition, FamilySymbolicLine } from '../families/types';
import {
  authoredFamilyDefinitionsFromElements,
  buildAuthoredFamilyDefinition,
  FAMILY_EDITOR_DEFINITION_PARAM,
  FAMILY_EDITOR_DOCUMENT_PARAM,
  type AuthoredFamilyDocument,
} from '../familyEditor/familyEditorPersistence';
import { liveTokenReader } from '../viewport/materials';
import type { PlanDetailLevel } from './planDetailLevelLines';

type FamilyTypeElement = Extract<Element, { kind: 'family_type' }>;
type FamilyInstanceElement = Extract<Element, { kind: 'family_instance' }>;

const FAMILY_INSTANCE_PLAN_Y = 0.075;

function readPlanToken(name: string, fallback: string): string {
  const value = liveTokenReader().read(name);
  return value && value.trim().length > 0 ? value : fallback;
}

function isFamilyDefinition(value: unknown): value is FamilyDefinition {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as { id?: unknown }).id === 'string' &&
    Array.isArray((value as { params?: unknown }).params),
  );
}

function familyDefinitionForType(type: FamilyTypeElement): FamilyDefinition | null {
  const embedded = type.parameters[FAMILY_EDITOR_DEFINITION_PARAM];
  if (isFamilyDefinition(embedded)) return embedded;
  const document = type.parameters[FAMILY_EDITOR_DOCUMENT_PARAM];
  if (document && typeof document === 'object') {
    return buildAuthoredFamilyDefinition(document as AuthoredFamilyDocument);
  }
  return BUILT_IN_FAMILIES.find((def) => def.id === type.familyId) ?? null;
}

function buildCatalog(elementsById: Record<string, Element>): FamilyCatalogLookup {
  const catalog: FamilyCatalogLookup = {};
  for (const def of BUILT_IN_FAMILIES) catalog[def.id] = def;
  for (const def of authoredFamilyDefinitionsFromElements(elementsById)) catalog[def.id] = def;
  for (const element of Object.values(elementsById)) {
    if (element.kind !== 'family_type') continue;
    const def = familyDefinitionForType(element);
    if (def) catalog[def.id] = def;
  }
  return catalog;
}

function lineVisible(
  line: FamilySymbolicLine,
  params: HostParams,
  detailLevel: PlanDetailLevel,
): boolean {
  if (line.visibilityByDetailLevel?.[detailLevel] === false) return false;
  return isVisibleByBinding(line.visibilityBinding, params);
}

function lineMaterial(
  line: FamilySymbolicLine,
): THREE.LineBasicMaterial | THREE.LineDashedMaterial {
  const subcategory = line.subcategory ?? 'symbolic';
  const color =
    subcategory === 'opening_projection'
      ? readToken('--draft-construction-blue', '#0ea5e9')
      : subcategory === 'hidden_cut'
        ? readPlanToken('--draft-witness', '#64748b')
        : readPlanToken('--draft-cut', '#111827');
  if (subcategory === 'hidden_cut') {
    return new THREE.LineDashedMaterial({
      color,
      dashSize: 0.09,
      gapSize: 0.055,
      depthTest: false,
    });
  }
  return new THREE.LineBasicMaterial({ color, depthTest: false });
}

function transformForInstance(
  instance: FamilyInstanceElement,
  elementsById: Record<string, Element>,
): { xMm: number; yMm: number; rotationDeg: number } {
  const host =
    instance.hostElementId && instance.hostAlongT != null
      ? elementsById[instance.hostElementId]
      : undefined;
  if (host?.kind === 'wall') {
    const t = Math.max(0, Math.min(1, instance.hostAlongT ?? 0));
    const dx = host.end.xMm - host.start.xMm;
    const dy = host.end.yMm - host.start.yMm;
    return {
      xMm: host.start.xMm + dx * t,
      yMm: host.start.yMm + dy * t,
      rotationDeg: (Math.atan2(dy, dx) * 180) / Math.PI + (instance.rotationDeg ?? 0),
    };
  }
  return {
    xMm: instance.positionMm.xMm,
    yMm: instance.positionMm.yMm,
    rotationDeg: instance.rotationDeg ?? 0,
  };
}

export function makeFamilyInstancePlanSymbol(
  instance: FamilyInstanceElement,
  elementsById: Record<string, Element>,
  detailLevel: PlanDetailLevel,
): THREE.Group | null {
  const type = elementsById[instance.familyTypeId];
  if (type?.kind !== 'family_type') return null;
  const def = familyDefinitionForType(type);
  if (!def?.symbolicLines?.length) return null;

  const params = buildFamilyParamMap(def, {
    ...type.parameters,
    ...(instance.paramValues ?? {}),
  } as HostParams);
  const visibleLines = def.symbolicLines.filter((line) => lineVisible(line, params, detailLevel));
  if (visibleLines.length === 0) return null;

  const group = new THREE.Group();
  const placement = transformForInstance(instance, elementsById);
  group.position.set(placement.xMm / 1000, PLAN_Y + 0.055, placement.yMm / 1000);
  group.rotation.y = -THREE.MathUtils.degToRad(placement.rotationDeg);
  group.userData.bimPickId = instance.id;
  group.userData.familyTypeId = instance.familyTypeId;

  for (const line of visibleLines) {
    const pts = [
      new THREE.Vector3(line.startMm.xMm / 1000, 0, line.startMm.yMm / 1000),
      new THREE.Vector3(line.endMm.xMm / 1000, 0, line.endMm.yMm / 1000),
    ];
    const segment = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      lineMaterial(line),
    );
    segment.userData.bimPickId = instance.id;
    segment.userData.familySymbolicSubcategory = line.subcategory ?? 'symbolic';
    segment.renderOrder = 8;
    if (segment.material instanceof THREE.LineDashedMaterial) segment.computeLineDistances();
    group.add(segment);
  }
  return group;
}

export function addFamilyInstancePlanSymbols(
  holder: THREE.Object3D,
  elementsById: Record<string, Element>,
  opts: {
    activeLevelId?: string;
    activeViewId?: string;
    detailLevel: PlanDetailLevel;
    kindHidden?: (kind: string) => boolean;
  },
): void {
  if (opts.kindHidden?.('placed_asset')) return;
  buildCatalog(elementsById);
  for (const element of Object.values(elementsById)) {
    if (element.kind !== 'family_instance') continue;
    if (element.hostViewId) {
      if (!opts.activeViewId || element.hostViewId !== opts.activeViewId) continue;
    } else if (opts.activeLevelId && element.levelId !== opts.activeLevelId) {
      continue;
    }
    const symbol = makeFamilyInstancePlanSymbol(element, elementsById, opts.detailLevel);
    if (symbol) holder.add(symbol);
  }
}
