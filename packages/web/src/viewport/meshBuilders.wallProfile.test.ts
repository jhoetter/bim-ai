import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildProfiledWallMesh } from './meshBuilders.wallProfile';
import { initialWallProfileState, reduceWallProfile } from '../tools/toolGrammar';

describe('buildProfiledWallMesh — §3.5.5', () => {
  it('returns empty Mesh for fewer than 3 profile points', () => {
    const mesh = buildProfiledWallMesh(5000, 3000, 200, [
      { xPct: 0, yPct: 0 },
      { xPct: 1, yPct: 0 },
    ]);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    // Empty mesh has no geometry attributes
    expect(mesh.geometry.attributes.position).toBeUndefined();
  });

  it('returns a Mesh for a valid triangle profile', () => {
    const mesh = buildProfiledWallMesh(5000, 3000, 200, [
      { xPct: 0, yPct: 0 },
      { xPct: 1, yPct: 0 },
      { xPct: 0.5, yPct: 1 },
    ]);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('Mesh geometry is not null for valid profile', () => {
    const mesh = buildProfiledWallMesh(4000, 2800, 250, [
      { xPct: 0, yPct: 0 },
      { xPct: 1, yPct: 0 },
      { xPct: 1, yPct: 1 },
      { xPct: 0, yPct: 1 },
    ]);
    expect(mesh.geometry).not.toBeNull();
    expect(mesh.geometry.attributes.position).toBeDefined();
  });
});

describe('reduceWallProfile grammar — §3.5.5', () => {
  it('starts in idle phase', () => {
    const state = initialWallProfileState();
    expect(state.phase).toBe('idle');
  });

  it('activate with wallId moves to editing', () => {
    const state = initialWallProfileState();
    const result = reduceWallProfile(state, { type: 'activate', wallId: 'wall-1' });
    expect(result.state.phase).toBe('editing');
    if (result.state.phase === 'editing') {
      expect(result.state.wallId).toBe('wall-1');
      expect(result.state.points).toHaveLength(0);
    }
  });

  it('activate without wallId stays idle', () => {
    const state = initialWallProfileState();
    const result = reduceWallProfile(state, { type: 'activate' });
    expect(result.state.phase).toBe('idle');
  });

  it('click accumulates profile points', () => {
    const state = initialWallProfileState();
    const { state: editingState } = reduceWallProfile(state, {
      type: 'activate',
      wallId: 'wall-1',
    });
    const { state: afterClick } = reduceWallProfile(editingState, {
      type: 'click',
      xPct: 0.0,
      yPct: 0.0,
    });
    const { state: afterClick2 } = reduceWallProfile(afterClick, {
      type: 'click',
      xPct: 1.0,
      yPct: 0.0,
    });
    if (afterClick2.phase === 'editing') {
      expect(afterClick2.points).toHaveLength(2);
      expect(afterClick2.points[0]).toEqual({ xPct: 0, yPct: 0 });
      expect(afterClick2.points[1]).toEqual({ xPct: 1, yPct: 0 });
    }
  });

  it('Enter with 3+ points emits commitWallProfile', () => {
    let state = initialWallProfileState();
    ({ state } = reduceWallProfile(state, { type: 'activate', wallId: 'wall-42' }));
    ({ state } = reduceWallProfile(state, { type: 'click', xPct: 0, yPct: 0 }));
    ({ state } = reduceWallProfile(state, { type: 'click', xPct: 1, yPct: 0 }));
    ({ state } = reduceWallProfile(state, { type: 'click', xPct: 0.5, yPct: 1 }));
    const result = reduceWallProfile(state, { type: 'Enter' });
    expect(result.state.phase).toBe('idle');
    expect(result.effect).toBeDefined();
    expect(result.effect?.kind).toBe('commitWallProfile');
    expect(result.effect?.wallId).toBe('wall-42');
    expect(result.effect?.points).toHaveLength(3);
  });

  it('Enter with fewer than 3 points does nothing', () => {
    let state = initialWallProfileState();
    ({ state } = reduceWallProfile(state, { type: 'activate', wallId: 'wall-1' }));
    ({ state } = reduceWallProfile(state, { type: 'click', xPct: 0, yPct: 0 }));
    ({ state } = reduceWallProfile(state, { type: 'click', xPct: 1, yPct: 0 }));
    const result = reduceWallProfile(state, { type: 'Enter' });
    expect(result.state.phase).toBe('editing');
    expect(result.effect).toBeUndefined();
  });

  it('Escape returns to idle', () => {
    let state = initialWallProfileState();
    ({ state } = reduceWallProfile(state, { type: 'activate', wallId: 'wall-1' }));
    const result = reduceWallProfile(state, { type: 'Escape' });
    expect(result.state.phase).toBe('idle');
  });
});
