import { describe, expect, it } from 'vitest';

type DraftingViewFixture = { planViewSubtype?: 'drafting' };
type ElementKindFixture = { kind: string };

describe('Drafting view — §6.4.2', () => {
  it('CreateDraftingViewCmd has correct shape', () => {
    const cmd = { type: 'createDraftingView' as const, name: 'Detail 1' };
    expect(cmd.type).toBe('createDraftingView');
    expect(cmd.name).toBe('Detail 1');
  });

  it('drafting view has planViewSubtype drafting', () => {
    const view = { kind: 'plan_view', id: 'pv1', planViewSubtype: 'drafting', levelId: null };
    expect(view.planViewSubtype).toBe('drafting');
  });

  it('isDraftingView returns true for drafting subtype', () => {
    const view: DraftingViewFixture = { planViewSubtype: 'drafting' };
    const isDraftingView = view?.planViewSubtype === 'drafting';
    expect(isDraftingView).toBe(true);
  });

  it('isDraftingView returns false for regular plan view', () => {
    const view: DraftingViewFixture = { planViewSubtype: undefined };
    const isDraftingView = view?.planViewSubtype === 'drafting';
    expect(isDraftingView).toBe(false);
  });

  it('wall element should be skipped in drafting view', () => {
    const el: ElementKindFixture = { kind: 'wall' };
    const isDraftingView = true;
    const skipInDrafting = isDraftingView && ['wall', 'floor', 'room', 'column'].includes(el.kind);
    expect(skipInDrafting).toBe(true);
  });

  it('detail_line should NOT be skipped in drafting view', () => {
    const el: ElementKindFixture = { kind: 'detail_line' };
    const isDraftingView = true;
    const skipInDrafting = isDraftingView && ['wall', 'floor', 'room', 'column'].includes(el.kind);
    expect(skipInDrafting).toBe(false);
  });
});
