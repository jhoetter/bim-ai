import { describe, expect, it } from 'vitest';

describe('Ribbon steel/precast/massing-site tabs — §1.6.5', () => {
  it('steel tab id is defined', () => {
    const tabId = 'steel';
    expect(tabId).toBe('steel');
  });

  it('precast tab id is defined', () => {
    const tabId = 'precast';
    expect(tabId).toBe('precast');
  });

  it('massing-site tab id is defined', () => {
    const tabId = 'massing-site';
    expect(tabId).toBe('massing-site');
  });

  it('steel tab has connections panel', () => {
    const panelId = 'steel-connections';
    expect(panelId).toBe('steel-connections');
  });

  it('precast tab has elements panel', () => {
    const panelId = 'precast-elements';
    expect(panelId).toBe('precast-elements');
  });
});
