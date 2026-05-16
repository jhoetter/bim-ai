import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import { resolvePlanViewDisplay } from './planProjection';

const makeElementsById = (extra: Record<string, Element> = {}): Record<string, Element> => ({
  lv: { kind: 'level', id: 'lv', name: 'Level 1', elevationMm: 0 } as Element,
  ...extra,
});

const makePlanView = (subtype: string | undefined, extra: Record<string, unknown> = {}): Element =>
  ({
    kind: 'plan_view',
    id: 'pv',
    name: 'Test Plan',
    levelId: 'lv',
    planViewSubtype: subtype,
    ...extra,
  }) as unknown as Element;

describe('D1 — ceiling plan projection', () => {
  it('isRcp is true for ceiling_plan subtype', () => {
    const elementsById = makeElementsById({ pv: makePlanView('ceiling_plan') });
    const result = resolvePlanViewDisplay(elementsById, 'pv', 'lv', 'default');
    expect(result.isRcp).toBe(true);
  });

  it('isRcp is false for floor_plan subtype', () => {
    const elementsById = makeElementsById({ pv: makePlanView('floor_plan') });
    const result = resolvePlanViewDisplay(elementsById, 'pv', 'lv', 'default');
    expect(result.isRcp).toBeFalsy();
  });

  it('floor category is hidden by default in RCP', () => {
    const elementsById = makeElementsById({ pv: makePlanView('ceiling_plan') });
    const result = resolvePlanViewDisplay(elementsById, 'pv', 'lv', 'default');
    expect(result.hiddenSemanticKinds.has('floor')).toBe(true);
  });

  it('roof category is hidden by default in RCP', () => {
    const elementsById = makeElementsById({ pv: makePlanView('ceiling_plan') });
    const result = resolvePlanViewDisplay(elementsById, 'pv', 'lv', 'default');
    expect(result.hiddenSemanticKinds.has('roof')).toBe(true);
  });

  it('ceiling category is not hidden in RCP (ceilings are visible)', () => {
    const elementsById = makeElementsById({ pv: makePlanView('ceiling_plan') });
    const result = resolvePlanViewDisplay(elementsById, 'pv', 'lv', 'default');
    expect(result.hiddenSemanticKinds.has('ceiling')).toBe(false);
  });

  it('beam category is not hidden in RCP (beams are visible)', () => {
    const elementsById = makeElementsById({ pv: makePlanView('ceiling_plan') });
    const result = resolvePlanViewDisplay(elementsById, 'pv', 'lv', 'default');
    expect(result.hiddenSemanticKinds.has('beam')).toBe(false);
  });

  it('floor is not hidden by default in a regular floor_plan', () => {
    const elementsById = makeElementsById({ pv: makePlanView('floor_plan') });
    const result = resolvePlanViewDisplay(elementsById, 'pv', 'lv', 'default');
    expect(result.hiddenSemanticKinds.has('floor')).toBe(false);
  });
});
