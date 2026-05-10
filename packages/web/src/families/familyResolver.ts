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
  ParameterBinding,
  SweepGeometryNode,
  VisibilityBinding,
  VisibilityByDetailLevel,
} from './types';

/**
 * VIE-02 — plan detail levels at which the resolver may be asked to run.
 * Mirrors `PlanDetailLevel` in `plan/planDetailLevelLines.ts`; duplicated
 * here so `families/familyResolver.ts` doesn't import the plan package.
 */
export type ResolverDetailLevel = 'coarse' | 'medium' | 'fine';

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

/** Max recursion depth for nested-family expansion. */
export const MAX_NESTED_FAMILY_DEPTH = 10;

export type HostParams = Record<string, number | boolean | string>;

export type FamilyCatalogLookup = Record<string, FamilyDefinition>;

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
  detailLevel?: ResolverDetailLevel,
): THREE.Object3D | null {
  // VIE-02: per-detail-level visibility short-circuit.
  if (isHiddenByDetailLevel(node.visibilityByDetailLevel, detailLevel)) return null;
  // FAM-03: visibility binding short-circuit applies to every node kind.
  if (!isVisibleByBinding(node.visibilityBinding, hostParams)) return null;
  if (node.kind === 'sweep') {
    return resolveSweepNode(node);
  }
  if (node.kind === 'family_instance_ref') {
    return resolveNestedFamilyInstance(node, hostParams, catalog, depth, detailLevel);
  }
  if (node.kind === 'array') {
    return resolveArrayNode(node, hostParams, catalog, depth, detailLevel);
  }
  return null;
}

function resolveSweepNode(node: SweepGeometryNode): THREE.Mesh {
  const geom = meshFromSweep(node);
  return new THREE.Mesh(geom);
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
  detailLevel?: ResolverDetailLevel,
): THREE.Group {
  if (depth > MAX_NESTED_FAMILY_DEPTH) {
    throw new Error(
      `FAM-05: array node depth ${depth} exceeds MAX_NESTED_FAMILY_DEPTH (${MAX_NESTED_FAMILY_DEPTH}); cycle in family graph?`,
    );
  }
  const group = new THREE.Group();
  group.userData.arrayMode = node.mode;
  group.userData.countParam = node.countParam;

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
        detailLevel,
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
        detailLevel,
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
      detailLevel,
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
  detailLevel?: ResolverDetailLevel,
): THREE.Group {
  if (depth > MAX_NESTED_FAMILY_DEPTH) {
    throw new Error(
      `FAM-01: nested family depth ${depth} exceeds MAX_NESTED_FAMILY_DEPTH (${MAX_NESTED_FAMILY_DEPTH}); cycle in family graph?`,
    );
  }
  const def = catalog[node.familyId];
  if (!def) {
    throw new Error(`FAM-01: family '${node.familyId}' not found in catalog`);
  }
  const group = new THREE.Group();
  group.userData.familyId = node.familyId;

  // Visibility short-circuit before we recurse.
  if (node.visibilityBinding) {
    const v = hostParams[node.visibilityBinding.paramName];
    const truthy = Boolean(v);
    if (truthy !== node.visibilityBinding.whenTrue) {
      group.position.set(node.positionMm.xMm, node.positionMm.yMm, node.positionMm.zMm);
      group.rotation.y = (node.rotationDeg * Math.PI) / 180;
      return group;
    }
  }

  const nestedParams = buildNestedParamMap(def, node.parameterBindings, hostParams);
  const geometry = def.geometry ?? [];
  for (const geomNode of geometry) {
    const child = resolveGeometryNode(geomNode, nestedParams, catalog, depth + 1, detailLevel);
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
  detailLevel?: ResolverDetailLevel,
): THREE.Group {
  const def = catalog[familyId];
  if (!def) throw new Error(`FAM-01: family '${familyId}' not found in catalog`);
  // Detect cycles defensively before we walk.
  const cycle = detectFamilyCycle(familyId, catalog);
  if (cycle) {
    throw new Error(`FAM-01: cycle detected in family graph: ${cycle.join(' → ')}`);
  }
  const group = new THREE.Group();
  group.userData.familyId = familyId;
  const merged = buildFamilyParamMap(def, params);
  for (const geomNode of def.geometry ?? []) {
    const child = resolveGeometryNode(geomNode, merged, catalog, 1, detailLevel);
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
