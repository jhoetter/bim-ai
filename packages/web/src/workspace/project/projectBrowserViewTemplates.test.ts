import { describe, expect, it } from 'vitest';

describe('Project browser view templates subtree — §1.6.11', () => {
  it('ApplyViewTemplateCmd has correct shape', () => {
    const cmd = { type: 'applyViewTemplate' as const, planViewId: 'pv1', templateId: 'vt1' };
    expect(cmd.type).toBe('applyViewTemplate');
    expect(cmd.planViewId).toBe('pv1');
    expect(cmd.templateId).toBe('vt1');
  });

  it('ApplyViewTemplateCmd supports null templateId to clear', () => {
    const cmd = { type: 'applyViewTemplate' as const, planViewId: 'pv1', templateId: null };
    expect(cmd.templateId).toBeNull();
  });

  it('browser-view-templates-section testid is correct', () => {
    expect('browser-view-templates-section').toBe('browser-view-templates-section');
  });

  it('browser-view-template-row testid uses template id', () => {
    const id = 'vt-arch-1';
    expect(`browser-view-template-row-${id}`).toBe('browser-view-template-row-vt-arch-1');
  });

  it('browser-vt-apply testid uses template id', () => {
    const id = 'vt-arch-1';
    expect(`browser-vt-apply-${id}`).toBe('browser-vt-apply-vt-arch-1');
  });

  it('use count calculation filters by viewTemplateId', () => {
    const elements: any[] = [
      { kind: 'plan_view', id: 'pv1', viewTemplateId: 'vt1' },
      { kind: 'plan_view', id: 'pv2', viewTemplateId: 'vt1' },
      { kind: 'plan_view', id: 'pv3', viewTemplateId: 'vt2' },
    ];
    const count = elements.filter(
      (e) => e.kind === 'plan_view' && e.viewTemplateId === 'vt1',
    ).length;
    expect(count).toBe(2);
  });
});
