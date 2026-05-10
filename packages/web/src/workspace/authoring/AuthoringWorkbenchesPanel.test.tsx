import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { useBimStore } from '../../state/store';
import { AuthoringWorkbenchesPanel } from './AuthoringWorkbenchesPanel';

afterEach(() => {
  cleanup();
  useBimStore.setState({
    revision: 0,
    violations: [],
    planProjectionPrimitives: null,
    elementsById: {},
  });
});

const noop = () => {};

const level: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-ground',
  name: 'Ground Floor',
  elevationMm: 0,
} as Extract<Element, { kind: 'level' }>;

describe('AuthoringWorkbenchesPanel — T-13 smoke', () => {
  it('mounts with no selection and renders panel root', () => {
    const { getByTestId } = render(
      <AuthoringWorkbenchesPanel
        selected={undefined}
        elementsById={{}}
        activeLevelId=""
        onUpsertSemantic={noop}
      />,
    );
    expect(getByTestId('authoring-workbenches-panel')).toBeTruthy();
  });

  it('RoomSeparationAuthoringWorkbench — renders add-form with no selection', () => {
    const { getByTestId } = render(
      <AuthoringWorkbenchesPanel
        selected={undefined}
        elementsById={{ 'lvl-ground': level }}
        activeLevelId="lvl-ground"
        onUpsertSemantic={noop}
      />,
    );
    expect(getByTestId('room-separation-authoring-workbench')).toBeTruthy();
  });

  it('LevelDatumStackWorkbench — renders when a level element is selected', () => {
    const { getByTestId } = render(
      <AuthoringWorkbenchesPanel
        selected={level}
        elementsById={{ 'lvl-ground': level }}
        activeLevelId="lvl-ground"
        onUpsertSemantic={noop}
      />,
    );
    expect(getByTestId('level-datum-stack-workbench')).toBeTruthy();
  });

  it('RoofAuthoringWorkbench — renders when a roof element is selected', () => {
    const roof: Extract<Element, { kind: 'roof' }> = {
      kind: 'roof',
      id: 'roof-1',
      name: 'Main Roof',
      referenceLevelId: 'lvl-ground',
      footprintMm: [],
      slopeDeg: 30,
      overhangMm: 500,
      roofGeometryMode: 'gable_pitched_rectangle',
    } as Extract<Element, { kind: 'roof' }>;
    const { getByTestId } = render(
      <AuthoringWorkbenchesPanel
        selected={roof}
        elementsById={{ 'roof-1': roof }}
        activeLevelId=""
        onUpsertSemantic={noop}
      />,
    );
    expect(getByTestId('roof-authoring-workbench')).toBeTruthy();
  });

  it('MaterialLayerStackWorkbench — renders when a wall_type element is selected', () => {
    const wallType: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wt-1',
      name: 'Brick Wall',
      layers: [],
    } as Extract<Element, { kind: 'wall_type' }>;
    const { getByTestId } = render(
      <AuthoringWorkbenchesPanel
        selected={wallType}
        elementsById={{ 'wt-1': wallType }}
        activeLevelId=""
        onUpsertSemantic={noop}
      />,
    );
    expect(getByTestId('material-layer-catalog-workbench')).toBeTruthy();
  });

  it('SiteAuthoringPanel — always renders with apply button', () => {
    const { getByText } = render(
      <AuthoringWorkbenchesPanel
        selected={undefined}
        elementsById={{ 'lvl-ground': level }}
        activeLevelId="lvl-ground"
        onUpsertSemantic={noop}
      />,
    );
    expect(getByText(/Apply \(upsertSite\)/)).toBeTruthy();
  });

  it('RoomColorSchemePanel — always renders with scheme title', () => {
    const { getByText } = render(
      <AuthoringWorkbenchesPanel
        selected={undefined}
        elementsById={{}}
        activeLevelId=""
        onUpsertSemantic={noop}
      />,
    );
    expect(getByText(/Room colour scheme/i)).toBeTruthy();
  });
});
