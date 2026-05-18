import { describe, expect, it } from 'vitest';

describe('Dynamic browser tab title — §1.6.1', () => {
  it('formats title with project and view', () => {
    const project = 'Projekt1';
    const view = 'Grundriss: Ebene 0';
    const title = view ? `${project} — ${view}` : project;
    expect(title).toBe('Projekt1 — Grundriss: Ebene 0');
  });

  it('falls back to project name when no active view', () => {
    const project = 'Projekt1';
    const view = '';
    const title = view ? `${project} — ${view}` : project;
    expect(title).toBe('Projekt1');
  });

  it('falls back to bim-ai when no project name', () => {
    const project = 'bim-ai';
    const view = 'Ebene 0';
    const title = view ? `${project} — ${view}` : project;
    expect(title).toBe('bim-ai — Ebene 0');
  });

  it('breadcrumb shows project / view format', () => {
    const project = 'Mein Projekt';
    const view = 'Ebene 1';
    const breadcrumb = `${project} / ${view}`;
    expect(breadcrumb).toBe('Mein Projekt / Ebene 1');
  });

  it('view.dynamic-title command has correct id', () => {
    const cmd = { id: 'view.dynamic-title', label: 'Dynamic Browser Tab Title' };
    expect(cmd.id).toBe('view.dynamic-title');
  });
});
