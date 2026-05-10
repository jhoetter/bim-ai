/**
 * FAM-01 — nested family resolver.
 *
 * Given a family-authored geometry tree (sweep nodes + nested
 * `family_instance_ref` placements) plus a host parameter map and
 * a family catalog, walks the tree and produces a Three.js Group
 * containing the resolved geometry. Nested-family parameter bindings
 * pull their effective values from host params, literals, or
 * FAM-04 formulas.
 *
 * Geometry is emitted in millimetre space — the same convention as
 * `meshFromSweep` (FAM-02). Callers scale to scene units.
 *
 * Cycle detection: BFS up to depth 10. `detectFamilyCycle` is
 * intended for save-time validation; the resolver itself also
 * throws if it walks past the depth limit, defensively guarding
 * against in-memory graphs that bypassed save validation.
 */

import * as THREE from 'three';
import { evaluateFormulaOrThrow } from '../lib/expressionEvaluator';
import { meshFromSweep } from './sweepGeometry';
import type {
  ArrayGeometryNode,
  FamilyDefinition,
  FamilyGeometryNode,
  FamilyInstanceRefNode,
  FamilyPlanViewRange,
  FamilyVisibilityViewType,
  ParameterBinding,
  ParametricLengthExpression,
  SweepGeometryNode,
  VisibilityBinding,
  VisibilityByDetailLevel,
  VisibilityByViewType,
} from './types';

/**
 * VIE-02 — plan detail levels at which the resolver may be asked to run.
 * Mirrors `PlanDetailLevel` in `plan/planDetailLevelLines.ts`; duplicated
 * here so `families/familyResolver.ts` doesn't import the plan package.
 */
export type ResolverDetailLevel = 'coarse' | 'medium' | 'fine';
export type ResolverViewType = FamilyVisibilityViewType;

export interface FamilyResolveVisibilityOptions {
  detailLevel?: ResolverDetailLevel;
  viewType?: ResolverViewType;
  viewRange?: FamilyPlanViewRange;
  applyViewRange?: boolean;
}

type FamilyResolveContext = FamilyResolveVisibilityOptions & {
  zOffsetMm: number;
};

/**
 * VIE-02 — true if a node is hidden at `detailLevel`. Unset levels
 * default to visible. Returns false (i.e. "render") when no
 * `detailLevel` is supplied — back-compat for non-plan callers like
 * the 3D viewport that don't yet differentiate by detail.
 */
function isHiddenByDetailLevel(
  vis: VisibilityByDetailLevel | undefined,
  detailLevel: ResolverDetailLevel | undefined,
): boolean {
  if (!detailLevel || !vis) return false;
  return vis[detailLevel] === false;
}

function isHiddenByViewType(
  vis: VisibilityByViewType | undefined,
  viewType: ResolverViewType | undefined,
): boolean {
  if (!viewType || !vis) return false;
  return vis[viewType] === false;
}

function normalizeResolveContext(
  detailLevelOrOptions?: ResolverDetailLevel | FamilyResolveVisibilityOptions,
): FamilyResolveContext {
  if (typeof detailLevelOrOptions === 'string') {
    return { detailLevel: detailLevelOrOptions, zOffsetMm: 0 };
  }
  return {
    ...(detailLevelOrOptions ?? {}),
    zOffsetMm: (detailLevelOrOptions as { zOffsetMm?: number } | undefined)?.zOffsetMm ?? 0,
  };
}

function withZOffset(context: FamilyResolveContext, zOffsetMm: number): FamilyResolveContext {
  if (zOffsetMm === 0) return context;
  return { ...context, zOffsetMm: context.zOffsetMm + zOffsetMm };
}

/** Max recursion depth for nested-family expansion. */
export const MAX_NESTED_FAMILY_DEPTH = 10;

export type HostParams = Record<string, number | boolean | string>;

export type FamilyCatalogLookup = Record<string, FamilyDefinition>;

function catalogWithEmbeddedNestedDefinitions(
  rootDef: FamilyDefinition,
  catalog: FamilyCatalogLookup,
): FamilyCatalogLookup {
  const hydrated: FamilyCatalogLookup = { ...catalog, [rootDef.id]: rootDef };
  const stack = [...(rootDef.nestedDefinitions ?? [])];
  while (stack.length > 0) {
    const def = stack.pop()!;
    if (hydrated[def.id] && hydrated[def.id] !== def) continue;
    hydrated[def.id] = def;
    stack.push(...(def.nestedDefinitions ?? []));
  }
  return hydrated;
}

/**
 * Compute the effective value of a single binding against the host
 * parameter map. Throws on missing host param or formula error.
 */
export function resolveParameterBinding(
  binding: ParameterBinding,
  hostParams: HostParams,
): number | boolean | string {
  if (binding.kind === 'literal') return binding.value;
  if (binding.kind === 'host_param') {
    if (!Object.prototype.hasOwnProperty.call(hostParams, binding.paramName)) {
      throw new Error(`host_param '${binding.paramName}' not present on host`);
    }
    return hostParams[binding.paramName];
  }
  // formula
  const numericParams: Record<string, number | boolean> = {};
  for (const [k, v] of Object.entries(hostParams)) {
    if (typeof v === 'number' || typeof v === 'boolean') numericParams[k] = v;
  }
  return evaluateFormulaOrThrow(binding.expression, numericParams);
}

/**
 * Build the parameter map a nested family will be resolved against:
 * start from the family's declared defaults, then layer the
 * `parameterBindings` resolved against the host's params.
 */
function buildNestedParamMap(
  def: FamilyDefinition,
  bindings: Record<string, ParameterBinding>,
  hostParams: HostParams,
): HostParams {
  const out = buildFamilyParamMap(def, {});
  for (const [paramName, binding] of Object.entries(bindings)) {
    out[paramName] = resolveParameterBinding(binding, hostParams);
  }
  resolveFormulaParams(def, out);
  return out;
}

function numericParams(params: HostParams): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

function resolveFormulaParams(def: FamilyDefinition, params: HostParams): void {
  for (let pass = 0; pass < def.params.length; pass++) {
    let changed = false;
    for (const p of def.params) {
      const formula = typeof p.formula === 'string' ? p.formula.trim() : '';
      if (!formula) continue;
      const next = evaluateFormulaOrThrow(formula, numericParams(params));
      if (params[p.key] !== next) {
        params[p.key] = next;
        changed = true;
      }
    }
    if (!changed) return;
  }
}

/**
 * Resolve a family's effective host parameter map:
 * defaults, then caller overrides, then formula-backed params.
 */
export function buildFamilyParamMap(def: FamilyDefinition, params: HostParams): HostParams {
  const merged: HostParams = {};
  for (const p of def.params) {
    const dv = p.default;
    if (typeof dv === 'number' || typeof dv === 'boolean' || typeof dv === 'string') {
      merged[p.key] = dv;
    }
  }
  Object.assign(merged, params);
  resolveFormulaParams(def, merged);
  return merged;
}

/**
 * FAM-03 — evaluate a visibility binding against the host params.
 *
 * Returns true if the bound node should render. Missing param is
 * treated as falsy (consistent with `Boolean(undefined) === false`).
 */
export function isVisibleByBinding(
  binding: VisibilityBinding | undefined,
  hostParams: HostParams,
): boolean {
  if (!binding) return true;
  const v = hostParams[binding.paramName];
  return Boolean(v) === binding.whenTrue;
}

/**
 * Resolve a single geometry node to an Object3D.
 *
 * Sweep nodes go through FAM-02's `meshFromSweep`. Nested-family
 * refs recurse into `resolveNestedFamilyInstance`. Array nodes
 * expand into N nested-family copies (FAM-05). Returns null for
 * nodes hidden by their `visibilityBinding` (FAM-03) or their
 * VIE-02 `visibilityByDetailLevel` at the active `detailLevel`.
 */
function resolveGeometryNode(
  node: FamilyGeometryNode,
  hostParams: HostParams,
  catalog: FamilyCatalogLookup,
  depth: number,
  context: FamilyResolveContext,
): THREE.Object3D | null {
  // VIE-02: per-detail-level visibility short-circuit.
  if (isHiddenByDetailLevel(node.visibilityByDetailLevel, context.detailLevel)) return null;
  // F-059: per-view-type visibility short-circuit.
  if (isHiddenByViewType(node.visibilityByViewType, context.viewType)) return null;
  // FAM-03: visibility binding short-circuit applies to every node kind.
  if (!isVisibleByBinding(node.visibilityBinding, hostParams)) return null;
  if (node.kind === 'sweep') {
    if (isSweepHiddenByPlanCut(node, hostParams, context)) return null;
    return resolveSweepNode(node, hostParams);
  }
  if (node.kind === 'family_instance_ref') {
    return resolveNestedFamilyInstance(node, hostParams, catalog, depth, context);
  }
  if (node.kind === 'array') {
    return resolveArrayNode(node, hostParams, catalog, depth, context);
  }
  return null;
}

function resolveSweepNode(node: SweepGeometryNode, hostParams: HostParams): THREE.Mesh {
  const geom = resolveSweepGeometry(node, hostParams);
  const mesh = new THREE.Mesh(geom);
  mesh.userData.materialKey = resolveSweepMaterialKey(node, hostParams);
  return mesh;
}

function resolveSweepGeometry(
  node: SweepGeometryNode,
  hostParams: HostParams,
): THREE.BufferGeometry {
  const resolvedNode = applySweepParametricProfile(
    applySweepPathLengthParam(node, hostParams),
    hostParams,
  );
  const geom = meshFromSweep(resolvedNode);
  const startOffsetMm = numericHostParam(hostParams, node.pathStartOffsetParam);
  if (startOffsetMm !== null && startOffsetMm !== 0) {
    geom.translate(0, 0, startOffsetMm);
  }
  return geom;
}

export function sweepIntersectsPlanCut(
  node: SweepGeometryNode,
  hostParams: HostParams,
  viewRange: FamilyPlanViewRange,
  zOffsetMm = 0,
): boolean {
  const geom = resolveSweepGeometry(node, hostParams);
  geom.computeBoundingBox();
  const box = geom.boundingBox;
  const minZ = (box?.min.z ?? 0) + zOffsetMm;
  const maxZ = (box?.max.z ?? 0) + zOffsetMm;
  geom.dispose();
  const cut = viewRange.cutPlaneOffsetMm;
  return minZ <= cut && maxZ >= cut;
}

function isSweepHiddenByPlanCut(
  node: SweepGeometryNode,
  hostParams: HostParams,
  context: FamilyResolveContext,
): boolean {
  if (context.viewType !== 'plan_rcp' || context.applyViewRange === false || !context.viewRange) {
    return false;
  }
  return !sweepIntersectsPlanCut(node, hostParams, context.viewRange, context.zOffsetMm);
}

function resolveSweepMaterialKey(
  node: SweepGeometryNode,
  hostParams: HostParams,
): string | undefined {
  if (!node.materialKeyParam) return node.materialKey;
  const raw = hostParams[node.materialKeyParam];
  return typeof raw === 'string' && raw.trim() ? raw : node.materialKey;
}

function applySweepPathLengthParam(
  node: SweepGeometryNode,
  hostParams: HostParams,
): SweepGeometryNode {
  if (node.pathLines.length !== 1) return node;
  const startOffsetMm = numericHostParam(hostParams, node.pathStartOffsetParam) ?? 0;
  const endOffsetMm = numericHostParam(hostParams, node.pathEndOffsetParam);
  const lengthMm =
    endOffsetMm !== null
      ? endOffsetMm - startOffsetMm
      : (numericHostParam(hostParams, node.pathLengthParam) ?? NaN);
  if (!Number.isFinite(lengthMm) || lengthMm <= 0) return node;
  const line = node.pathLines[0]!;
  const dx = line.endMm.xMm - line.startMm.xMm;
  const dy = line.endMm.yMm - line.startMm.yMm;
  const currentLength = Math.hypot(dx, dy);
  if (currentLength <= 0) return node;
  const scale = lengthMm / currentLength;
  return {
    ...node,
    pathLines: [
      {
        ...line,
        endMm: {
          xMm: line.startMm.xMm + dx * scale,
          yMm: line.startMm.yMm + dy * scale,
        },
      },
    ],
  };
}

function applySweepParametricProfile(
  node: SweepGeometryNode,
  hostParams: HostParams,
): SweepGeometryNode {
  const profile = node.parametricProfile;
  if (!profile) return node;
  if (profile.kind === 'rectangle') {
    const minX = resolveLengthExpression(profile.minX, hostParams);
    const maxX = resolveLengthExpression(profile.maxX, hostParams);
    const minY = resolveLengthExpression(profile.minY, hostParams);
    const maxY = resolveLengthExpression(profile.maxY, hostParams);
    if (
      [minX, maxX, minY, maxY].some((v) => !Number.isFinite(v)) ||
      minX === maxX ||
      minY === maxY
    ) {
      return node;
    }
    return {
      ...node,
      profile: rectProfileLines(
        Math.min(minX, maxX),
        Math.max(minX, maxX),
        Math.min(minY, maxY),
        Math.max(minY, maxY),
      ),
    };
  }
  const radiusMm =
    numericHostParam(hostParams, profile.radiusParam) ??
    (typeof profile.fallbackRadiusMm === 'number' ? profile.fallbackRadiusMm : NaN);
  if (!Number.isFinite(radiusMm) || radiusMm <= 0) return node;
  const centerXMm = resolveLengthExpression(profile.centerX, hostParams);
  const centerYMm = resolveLengthExpression(profile.centerY, hostParams);
  if (!Number.isFinite(centerXMm) || !Number.isFinite(centerYMm)) return node;
  return {
    ...node,
    profile: circularProfileLines(
      centerXMm,
      centerYMm,
      radiusMm,
      Math.max(8, Math.floor(profile.segments ?? 24)),
    ),
  };
}

function numericHostParam(hostParams: HostParams, paramName: string | undefined): number | null {
  if (!paramName) return null;
  const raw = hostParams[paramName];
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : null;
}

function resolveLengthExpression(expr: ParametricLengthExpression, hostParams: HostParams): number {
  if (typeof expr === 'number') return expr;
  if (expr.kind === 'param') {
    return numericHostParam(hostParams, expr.paramName) ?? expr.fallbackMm ?? NaN;
  }
  try {
    return evaluateFormulaOrThrow(expr.expression, numericParams(hostParams));
  } catch (error) {
    if (typeof expr.fallbackMm === 'number') return expr.fallbackMm;
    throw error;
  }
}

function rectProfileLines(minX: number, maxX: number, minY: number, maxY: number) {
  return [
    { startMm: { xMm: minX, yMm: minY }, endMm: { xMm: maxX, yMm: minY } },
    { startMm: { xMm: maxX, yMm: minY }, endMm: { xMm: maxX, yMm: maxY } },
    { startMm: { xMm: maxX, yMm: maxY }, endMm: { xMm: minX, yMm: maxY } },
    { startMm: { xMm: minX, yMm: maxY }, endMm: { xMm: minX, yMm: minY } },
  ];
}

function circularProfileLines(
  centerXMm: number,
  centerYMm: number,
  radiusMm: number,
  segments: number,
) {
  return Array.from({ length: segments }, (_value, index) => {
    const a = (index / segments) * Math.PI * 2;
    const b = ((index + 1) / segments) * Math.PI * 2;
    return {
      startMm: {
        xMm: centerXMm + Math.cos(a) * radiusMm,
        yMm: centerYMm + Math.sin(a) * radiusMm,
      },
      endMm: {
        xMm: centerXMm + Math.cos(b) * radiusMm,
        yMm: centerYMm + Math.sin(b) * radiusMm,
      },
    };
  });
}

/**
 * FAM-05 — expand an array node into `count` placements of `target`.
 *
 * `count = max(1, floor(host_param_value(countParam)))`. Linear mode
 * spaces along (axisStart → axisEnd). Radial mode rotates around the
 * mid-point of the segment. The center copy (only emitted if a
 * `centerVisibilityBinding` is bound and currently truthy) is placed
 * at the midpoint with no rotation, regardless of mode.
 */
export function resolveArrayNode(
  node: ArrayGeometryNode,
  hostParams: HostParams,
  catalog: FamilyCatalogLookup,
  depth: number = 0,
  detailLevelOrOptions?: ResolverDetailLevel | FamilyResolveVisibilityOptions,
): THREE.Group {
  const context = normalizeResolveContext(detailLevelOrOptions);
  if (depth > MAX_NESTED_FAMILY_DEPTH) {
    throw new Error(
      `FAM-05: array node depth ${depth} exceeds MAX_NESTED_FAMILY_DEPTH (${MAX_NESTED_FAMILY_DEPTH}); cycle in family graph?`,
    );
  }
  const group = new THREE.Group();
  group.userData.arrayMode = node.mode;
  group.userData.countParam = node.countParam;
  if (isHiddenByDetailLevel(node.visibilityByDetailLevel, context.detailLevel)) return group;
  if (isHiddenByViewType(node.visibilityByViewType, context.viewType)) return group;
  if (!isVisibleByBinding(node.visibilityBinding, hostParams)) return group;

  const rawCount = hostParams[node.countParam];
  const numericCount = typeof rawCount === 'number' ? rawCount : Number(rawCount ?? 1);
  const count = Math.max(1, Math.floor(Number.isFinite(numericCount) ? numericCount : 1));
  group.userData.resolvedCount = count;

  const start = new THREE.Vector3(node.axisStart.xMm, node.axisStart.yMm, node.axisStart.zMm);
  const end = new THREE.Vector3(node.axisEnd.xMm, node.axisEnd.yMm, node.axisEnd.zMm);
  const axisVec = new THREE.Vector3().subVectors(end, start);
  const axisLen = axisVec.length();
  const axisDir = axisLen > 0 ? axisVec.clone().normalize() : new THREE.Vector3(1, 0, 0);
  const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  if (node.mode === 'linear') {
    let stepMm: number;
    if (node.spacing.kind === 'fixed_mm') {
      stepMm = node.spacing.mm;
    } else {
      const total =
        typeof hostParams[node.spacing.totalLengthParam] === 'number'
          ? (hostParams[node.spacing.totalLengthParam] as number)
          : axisLen;
      stepMm = count > 1 ? total / (count - 1) : 0;
    }
    for (let i = 0; i < count; i++) {
      const offset = axisDir.clone().multiplyScalar(i * stepMm);
      const child = resolveNestedFamilyInstance(
        node.target,
        hostParams,
        catalog,
        depth + 1,
        context,
      );
      child.position.add(offset);
      group.add(child);
    }
  } else {
    // radial — distribute around an axis from start→end through `center`.
    const axis = axisLen > 0 ? axisDir.clone() : new THREE.Vector3(0, 0, 1);
    const stepDeg = 360 / count;
    for (let i = 0; i < count; i++) {
      const angleRad = (i * stepDeg * Math.PI) / 180;
      const child = resolveNestedFamilyInstance(
        node.target,
        hostParams,
        catalog,
        depth + 1,
        context,
      );
      // Rotate the child's position around the axis through `center`.
      const rel = new THREE.Vector3().subVectors(child.position, center);
      rel.applyAxisAngle(axis, angleRad);
      child.position.copy(center).add(rel);
      // Stack the angular rotation onto the target's existing yaw if axis ≈ +Y.
      if (Math.abs(axis.y) > Math.abs(axis.x) && Math.abs(axis.y) > Math.abs(axis.z)) {
        child.rotation.y += angleRad;
      } else {
        // For non-Y axes, apply the rotation as a quaternion on top of the child.
        const q = new THREE.Quaternion().setFromAxisAngle(axis, angleRad);
        child.quaternion.premultiply(q);
      }
      group.add(child);
    }
  }

  if (
    node.centerVisibilityBinding &&
    isVisibleByBinding(node.centerVisibilityBinding, hostParams)
  ) {
    const centerCopy = resolveNestedFamilyInstance(
      node.target,
      hostParams,
      catalog,
      depth + 1,
      context,
    );
    centerCopy.position.set(center.x, center.y, center.z);
    centerCopy.userData.arrayCenter = true;
    group.add(centerCopy);
  }

  return group;
}

/**
 * FAM-01 entry point. Walks `node.familyId`'s geometry tree using
 * effective parameter values derived from `node.parameterBindings`
 * + `hostParams`. Returns a Group positioned/rotated per `node`'s
 * placement. Hidden subtrees (per `visibilityBinding`) return an
 * empty Group rather than null so callers can still attach them.
 */
export function resolveNestedFamilyInstance(
  node: FamilyInstanceRefNode,
  hostParams: HostParams,
  catalog: FamilyCatalogLookup,
  depth: number = 0,
  detailLevelOrOptions?: ResolverDetailLevel | FamilyResolveVisibilityOptions,
): THREE.Group {
  const context = normalizeResolveContext(detailLevelOrOptions);
  if (depth > MAX_NESTED_FAMILY_DEPTH) {
    throw new Error(
      `FAM-01: nested family depth ${depth} exceeds MAX_NESTED_FAMILY_DEPTH (${MAX_NESTED_FAMILY_DEPTH}); cycle in family graph?`,
    );
  }
  const def = catalog[node.familyId];
  if (!def) {
    throw new Error(`FAM-01: family '${node.familyId}' not found in catalog`);
  }
  const nestedCatalog = catalogWithEmbeddedNestedDefinitions(def, catalog);
  const group = new THREE.Group();
  group.userData.familyId = node.familyId;
  const positionEmptyGroup = () => {
    group.position.set(node.positionMm.xMm, node.positionMm.yMm, node.positionMm.zMm);
    group.rotation.y = (node.rotationDeg * Math.PI) / 180;
    return group;
  };

  if (isHiddenByDetailLevel(node.visibilityByDetailLevel, context.detailLevel)) {
    return positionEmptyGroup();
  }
  if (isHiddenByViewType(node.visibilityByViewType, context.viewType)) {
    return positionEmptyGroup();
  }

  // Visibility short-circuit before we recurse.
  if (node.visibilityBinding) {
    const v = hostParams[node.visibilityBinding.paramName];
    const truthy = Boolean(v);
    if (truthy !== node.visibilityBinding.whenTrue) {
      return positionEmptyGroup();
    }
  }

  const nestedParams = buildNestedParamMap(def, node.parameterBindings, hostParams);
  const geometry = def.geometry ?? [];
  const nestedContext = withZOffset(context, node.positionMm.zMm);
  for (const geomNode of geometry) {
    const child = resolveGeometryNode(
      geomNode,
      nestedParams,
      nestedCatalog,
      depth + 1,
      nestedContext,
    );
    if (child) group.add(child);
  }

  group.position.set(node.positionMm.xMm, node.positionMm.yMm, node.positionMm.zMm);
  group.rotation.y = (node.rotationDeg * Math.PI) / 180;
  return group;
}

/**
 * Resolve a top-level family's geometry given a parameter map.
 *
 * Useful for both family-thumbnail rendering and KRN-09's
 * `family_instance` curtain panel resolution where the host (the
 * curtain wall) doesn't itself live in a family-instance ref.
 */
export function resolveFamilyGeometry(
  familyId: string,
  params: HostParams,
  catalog: FamilyCatalogLookup,
  detailLevelOrOptions?: ResolverDetailLevel | FamilyResolveVisibilityOptions,
): THREE.Group {
  const context = normalizeResolveContext(detailLevelOrOptions);
  const originalDef = catalog[familyId];
  const catalogForResolve = originalDef
    ? catalogWithEmbeddedNestedDefinitions(originalDef, catalog)
    : catalog;
  const def = catalogForResolve[familyId];
  if (!def) throw new Error(`FAM-01: family '${familyId}' not found in catalog`);
  // Detect cycles defensively before we walk.
  const cycle = detectFamilyCycle(familyId, catalogForResolve);
  if (cycle) {
    throw new Error(`FAM-01: cycle detected in family graph: ${cycle.join(' → ')}`);
  }
  const group = new THREE.Group();
  group.userData.familyId = familyId;
  const merged = buildFamilyParamMap(def, params);
  for (const geomNode of def.geometry ?? []) {
    const child = resolveGeometryNode(geomNode, merged, catalogForResolve, 1, context);
    if (child) group.add(child);
  }
  return group;
}

/**
 * BFS the family-instance-ref graph starting at `rootFamilyId`.
 * Returns the cyclic path (`[a, b, c, a]`) if a cycle is found, or
 * `null` otherwise. Throws if the BFS frontier exceeds
 * MAX_NESTED_FAMILY_DEPTH (which is itself an upper bound on the
 * graph diameter we permit, regardless of cycles).
 *
 * Intended for save-time validation. Catalog edits that would
 * introduce a cycle should be rejected by calling this with the
 * proposed catalog state.
 */
export function detectFamilyCycle(
  rootFamilyId: string,
  catalog: FamilyCatalogLookup,
): string[] | null {
  type Step = { id: string; path: string[] };
  const queue: Step[] = [{ id: rootFamilyId, path: [rootFamilyId] }];
  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (path.length > MAX_NESTED_FAMILY_DEPTH) {
      throw new Error(
        `FAM-01: family graph depth exceeds ${MAX_NESTED_FAMILY_DEPTH} for root '${rootFamilyId}'`,
      );
    }
    const def = catalog[id];
    if (!def?.geometry) continue;
    for (const node of def.geometry) {
      let nestedId: string | null = null;
      if (node.kind === 'family_instance_ref') nestedId = node.familyId;
      else if (node.kind === 'array') nestedId = node.target.familyId;
      if (!nestedId) continue;
      if (path.includes(nestedId)) {
        return [...path, nestedId];
      }
      queue.push({ id: nestedId, path: [...path, nestedId] });
    }
  }
  return null;
}
