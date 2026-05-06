import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import {
  InspectorConstraintsFor,
  InspectorGraphicsFor,
  InspectorIdentityFor,
  InspectorPropertiesFor,
} from './InspectorContent';

afterEach(() => {
  cleanup();
});

const wall = {
  kind: 'wall',
  id: 'seed-w-eg-south',
  name: 'EG South',
  levelId: 'seed-lvl-ground',
  start: { xMm: 5000, yMm: 4000 },
  end: { xMm: 17000, yMm: 4000 },
  thicknessMm: 200,
  heightMm: 2800,
} as const;

const door = {
  kind: 'door',
  id: 'seed-d-1',
  name: 'Door',
  wallId: 'seed-w-eg-south',
  alongT: 0.5,
  widthMm: 900,
} as const;

const stair = {
  kind: 'stair',
  id: 'seed-stair',
  name: 'Stair',
  baseLevelId: 'seed-lvl-ground',
  topLevelId: 'seed-lvl-upper',
  runStartMm: { xMm: 0, yMm: 0 },
  runEndMm: { xMm: 4000, yMm: 0 },
  widthMm: 1100,
  riserMm: 176,
  treadMm: 280,
} as const;

describe('InspectorPropertiesFor — spec §13', () => {
  it('renders wall properties', () => {
    const { getByText } = render(InspectorPropertiesFor(wall));
    expect(getByText('200 mm')).toBeTruthy();
    expect(getByText('2.80 m')).toBeTruthy();
  });

  it('renders door alongT and width', () => {
    const { getByText } = render(InspectorPropertiesFor(door));
    expect(getByText('900 mm')).toBeTruthy();
    expect(getByText('0.500')).toBeTruthy();
  });

  it('renders stair risers/treads', () => {
    const { getByText } = render(InspectorPropertiesFor(stair));
    expect(getByText('176 mm')).toBeTruthy();
    expect(getByText('280 mm')).toBeTruthy();
  });
});

describe('InspectorConstraintsFor', () => {
  it('renders wall constraints (location line, wrap rule)', () => {
    const { getByText } = render(InspectorConstraintsFor(wall));
    expect(getByText('Wall centerline')).toBeTruthy();
  });

  it('falls back gracefully for unsupported kinds', () => {
    const { getByText } = render(InspectorConstraintsFor(door));
    expect(getByText(/No constraints surface/)).toBeTruthy();
  });
});

describe('InspectorIdentityFor', () => {
  it('renders kind, id, and name', () => {
    const { getByText } = render(InspectorIdentityFor(wall));
    expect(getByText('wall')).toBeTruthy();
    expect(getByText('seed-w-eg-south')).toBeTruthy();
    expect(getByText('EG South')).toBeTruthy();
  });
});

describe('InspectorGraphicsFor — T-14 / WP-UI-B01', () => {
  const planView: Element = {
    kind: 'plan_view',
    id: 'seed-plan-eg',
    name: 'Ground Floor Plan',
    levelId: 'seed-lvl-ground',
    planPresentation: 'default',
  };

  const viewTemplate: Element = {
    kind: 'view_template',
    id: 'seed-tmpl-1',
    name: 'Default Template',
    scale: 'scale_100',
  };

  const elementsById: Record<string, Element> = {
    [planView.id]: planView,
    [viewTemplate.id]: viewTemplate,
  };

  it('renders graphics panel for plan_view', () => {
    const result = InspectorGraphicsFor({
      el: planView,
      elementsById,
      revision: 1,
      onPersistProperty: vi.fn(),
    });
    const { container } = render(result!);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders graphics panel for view_template with footnote', () => {
    const result = InspectorGraphicsFor({
      el: viewTemplate,
      elementsById,
      revision: 1,
      onPersistProperty: vi.fn(),
    });
    const { getByText } = render(result!);
    expect(getByText(/Template defaults/)).toBeTruthy();
  });

  it('returns null for non-graphics element kinds', () => {
    const result = InspectorGraphicsFor({
      el: wall as Element,
      elementsById,
      revision: 1,
      onPersistProperty: vi.fn(),
    });
    expect(result).toBeNull();
  });
});
