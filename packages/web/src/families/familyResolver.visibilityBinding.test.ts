/**
 * FAM-03 — visibility binding tests for non-instance-ref geometry nodes.
 *
 * The pre-existing FAM-01 test exercises the binding on
 * `family_instance_ref` nodes. This file extends coverage to:
 *   - sweep nodes (added in FAM-03)
 *   - the `whenTrue: false` flip (hide-when-true)
 *   - the "always visible" fallback when no binding is present
 *   - missing host param treated as falsy
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { isVisibleByBinding, resolveFamilyGeometry } from './familyResolver';
import type { FamilyDefinition, SketchLine, SweepGeometryNode, VisibilityBinding } from './types';

function rectProfile(widthMm: number, heightMm: number): SketchLine[] {
  const hw = widthMm / 2;
  const hh = heightMm / 2;
  return [
    { startMm: { xMm: -hw, yMm: hh }, endMm: { xMm: hw, yMm: hh } },
    { startMm: { xMm: hw, yMm: hh }, endMm: { xMm: hw, yMm: -hh } },
    { startMm: { xMm: hw, yMm: -hh }, endMm: { xMm: -hw, yMm: -hh } },
    { startMm: { xMm: -hw, yMm: -hh }, endMm: { xMm: -hw, yMm: hh } },
  ];
}

function frameSweep(visibilityBinding?: VisibilityBinding): SweepGeometryNode {
  return {
    kind: 'sweep',
    pathLines: [{ startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 600, yMm: 0 } }],
    profile: rectProfile(50, 50),
    profilePlane: 'normal_to_path_start',
    visibilityBinding,
  };
}

function meshCount(group: THREE.Group): number {
  let n = 0;
  group.traverse((c) => {
    if (c instanceof THREE.Mesh) n++;
  });
  return n;
}

describe('FAM-03 isVisibleByBinding', () => {
  it('no binding → always visible', () => {
    expect(isVisibleByBinding(undefined, {})).toBe(true);
  });

  it('binds whenTrue: true', () => {
    const b: VisibilityBinding = { paramName: 'hasFrame', whenTrue: true };
    expect(isVisibleByBinding(b, { hasFrame: true })).toBe(true);
    expect(isVisibleByBinding(b, { hasFrame: false })).toBe(false);
  });

  it('binds whenTrue: false (hide-when-on)', () => {
    const b: VisibilityBinding = { paramName: 'hideMe', whenTrue: false };
    expect(isVisibleByBinding(b, { hideMe: true })).toBe(false);
    expect(isVisibleByBinding(b, { hideMe: false })).toBe(true);
  });

  it('missing host param is falsy', () => {
    const b: VisibilityBinding = { paramName: 'never', whenTrue: true };
    expect(isVisibleByBinding(b, {})).toBe(false);
  });

  it('coerces non-boolean truthy values', () => {
    const b: VisibilityBinding = { paramName: 'count', whenTrue: true };
    expect(isVisibleByBinding(b, { count: 1 })).toBe(true);
    expect(isVisibleByBinding(b, { count: 0 })).toBe(false);
  });
});

describe('FAM-03 visibility on sweep nodes', () => {
  function windowWithFrameToggle(): FamilyDefinition {
    return {
      id: 'window-with-toggle',
      name: 'WindowWithToggle',
      discipline: 'window',
      params: [
        {
          key: 'hasFrame',
          label: 'Has Frame',
          type: 'boolean',
          default: false,
          instanceOverridable: true,
        },
      ],
      defaultTypes: [],
      geometry: [frameSweep({ paramName: 'hasFrame', whenTrue: true })],
    };
  }

  it('hides the bound sweep when host param is false', () => {
    const def = windowWithFrameToggle();
    const group = resolveFamilyGeometry(def.id, { hasFrame: false }, { [def.id]: def });
    expect(meshCount(group)).toBe(0);
  });

  it('shows the bound sweep when host param is true', () => {
    const def = windowWithFrameToggle();
    const group = resolveFamilyGeometry(def.id, { hasFrame: true }, { [def.id]: def });
    expect(meshCount(group)).toBeGreaterThanOrEqual(1);
  });

  it('default param value (false) hides the sweep when host params are empty', () => {
    const def = windowWithFrameToggle();
    const group = resolveFamilyGeometry(def.id, {}, { [def.id]: def });
    expect(meshCount(group)).toBe(0);
  });

  it('mixed sweep nodes — some bound, some unconditional', () => {
    const def: FamilyDefinition = {
      id: 'mixed',
      name: 'Mixed',
      discipline: 'window',
      params: [
        {
          key: 'hasFrame',
          label: 'Has Frame',
          type: 'boolean',
          default: false,
          instanceOverridable: true,
        },
      ],
      defaultTypes: [],
      geometry: [frameSweep(), frameSweep({ paramName: 'hasFrame', whenTrue: true })],
    };
    const offGroup = resolveFamilyGeometry(def.id, { hasFrame: false }, { [def.id]: def });
    expect(meshCount(offGroup)).toBe(1);
    const onGroup = resolveFamilyGeometry(def.id, { hasFrame: true }, { [def.id]: def });
    expect(meshCount(onGroup)).toBe(2);
  });
});
