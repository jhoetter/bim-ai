import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import { buildProfiledWallMesh } from '../../viewport/meshBuilders.wallProfile';
import i18n from '../../i18n';
import * as THREE from 'three';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const wall: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'wall-profile-1',
  name: 'Profile Wall',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 5000, yMm: 0 },
  heightMm: 3000,
  thicknessMm: 200,
  levelId: 'lvl-1',
};

const wallWithProfile: Extract<Element, { kind: 'wall' }> = {
  ...wall,
  id: 'wall-profile-2',
  profilePoints: [
    { xPct: 0, yPct: 0 },
    { xPct: 1, yPct: 0 },
    { xPct: 0.5, yPct: 1 },
  ],
};

describe('wall profile inspector — §3.5.5', () => {
  it('renders Edit Profile button', () => {
    const { getByTestId } = render(InspectorPropertiesFor(wall, t, {}));
    const btn = getByTestId('inspector-wall-edit-profile');
    expect(btn).toBeTruthy();
  });

  it('shows point count when profilePoints is set', () => {
    const { getByTestId } = render(InspectorPropertiesFor(wallWithProfile, t, {}));
    const span = getByTestId('inspector-wall-profile-point-count');
    expect(span.textContent).toContain('3');
  });

  it('shows Reset button when profile points exist', () => {
    const { getByTestId } = render(InspectorPropertiesFor(wallWithProfile, t, {}));
    const btn = getByTestId('inspector-wall-reset-profile');
    expect(btn).toBeTruthy();
  });

  it('does not show Reset button when no profile points', () => {
    const { queryByTestId } = render(InspectorPropertiesFor(wall, t, {}));
    expect(queryByTestId('inspector-wall-reset-profile')).toBeNull();
  });

  it('clicking Edit Profile button calls onPropertyChange with editProfileActive=true', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(wall, t, { onPropertyChange: onChange }));
    fireEvent.click(getByTestId('inspector-wall-edit-profile'));
    expect(onChange).toHaveBeenCalledWith('editProfileActive', true);
  });

  it('clicking Reset button calls onPropertyChange with profilePoints=[]', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(wallWithProfile, t, { onPropertyChange: onChange }),
    );
    fireEvent.click(getByTestId('inspector-wall-reset-profile'));
    expect(onChange).toHaveBeenCalledWith('profilePoints', []);
  });
});

describe('buildProfiledWallMesh wiring — §3.5.5', () => {
  it('returns a Mesh for a valid triangle profile', () => {
    const profile = [
      { xPct: 0, yPct: 0 },
      { xPct: 1, yPct: 0 },
      { xPct: 0.5, yPct: 1 },
    ];
    const mesh = buildProfiledWallMesh(5000, 3000, 200, profile);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeTruthy();
  });

  it('returns empty Mesh for fewer than 3 points', () => {
    const profile = [
      { xPct: 0, yPct: 0 },
      { xPct: 1, yPct: 0 },
    ];
    const mesh = buildProfiledWallMesh(5000, 3000, 200, profile);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    // Empty mesh has no position attribute
    expect(mesh.geometry.attributes['position']).toBeUndefined();
  });
});
