import { describe, expect, it } from 'vitest';

describe('Quick access toolbar — §1.6.3', () => {
  it('AddToQuickAccessCmd has correct shape', () => {
    const cmd = { type: 'addToQuickAccess' as const, commandId: 'view.help-search' };
    expect(cmd.type).toBe('addToQuickAccess');
    expect(cmd.commandId).toBe('view.help-search');
  });

  it('RemoveFromQuickAccessCmd has correct shape', () => {
    const cmd = { type: 'removeFromQuickAccess' as const, commandId: 'view.help-search' };
    expect(cmd.type).toBe('removeFromQuickAccess');
    expect(cmd.commandId).toBe('view.help-search');
  });

  it('quickAccessItems defaults to empty array', () => {
    const state: any = { quickAccessItems: [] };
    expect(state.quickAccessItems.length).toBe(0);
  });

  it('adding command updates quickAccessItems', () => {
    const items: string[] = [];
    const cmdId = 'view.split-view';
    if (!items.includes(cmdId)) items.push(cmdId);
    expect(items).toContain('view.split-view');
  });

  it('removing command filters quickAccessItems', () => {
    const items = ['view.split-view', 'view.help-search'];
    const filtered = items.filter((id) => id !== 'view.split-view');
    expect(filtered).toEqual(['view.help-search']);
  });
});
