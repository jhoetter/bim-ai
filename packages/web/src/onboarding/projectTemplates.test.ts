import { describe, expect, it } from 'vitest';

import { PROJECT_TEMPLATES } from './projectTemplates';

describe('PROJECT_TEMPLATES', () => {
  it("'residential' template has exactly 4 createLevel commands", () => {
    const residential = PROJECT_TEMPLATES.find((t) => t.id === 'residential');
    expect(residential).toBeDefined();
    const levelCmds = residential!.commands.filter((c) => c.type === 'createLevel');
    expect(levelCmds).toHaveLength(4);
  });

  it("'residential' template has exactly 3 createPhase commands (Bestand, Abriss, Neubau)", () => {
    const residential = PROJECT_TEMPLATES.find((t) => t.id === 'residential');
    expect(residential).toBeDefined();
    const phaseCmds = residential!.commands.filter((c) => c.type === 'createPhase');
    expect(phaseCmds).toHaveLength(3);
    const phaseNames = phaseCmds.map((c) => (c as { type: 'createPhase'; name: string }).name);
    expect(phaseNames).toContain('Bestand');
    expect(phaseNames).toContain('Abriss');
    expect(phaseNames).toContain('Neubau');
  });

  it('all templates have unique id fields', () => {
    const ids = PROJECT_TEMPLATES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("'minimal' template has at least 1 createLevel command", () => {
    const minimal = PROJECT_TEMPLATES.find((t) => t.id === 'minimal');
    expect(minimal).toBeDefined();
    const levelCmds = minimal!.commands.filter((c) => c.type === 'createLevel');
    expect(levelCmds.length).toBeGreaterThanOrEqual(1);
  });
});
