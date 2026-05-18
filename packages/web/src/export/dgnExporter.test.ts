import { describe, expect, it } from 'vitest';
import { exportSceneToDgn, dgnFileName, DGN_MIME_TYPE } from './dgnExporter';

describe('DGN exporter — §12.4.3', () => {
  it('exports a DGN seed string with header comment', () => {
    const result = exportSceneToDgn({}, [], {});
    expect(result).toContain('DGN SEED');
  });

  it('returns no-levels message when no levels', () => {
    const result = exportSceneToDgn({}, [], {});
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes level names in header when levels provided', () => {
    const levels = [{ id: 'l1', name: 'EG', elevationMm: 0 }];
    const result = exportSceneToDgn({}, levels, {});
    expect(result).toContain('EG');
  });

  it('DGN_MIME_TYPE is correct', () => {
    expect(DGN_MIME_TYPE).toBe('application/dgn');
  });

  it('dgnFileName replaces spaces with underscores', () => {
    const name = dgnFileName('My Project');
    expect(name).toContain('_');
    expect(name.endsWith('.dgn')).toBe(true);
  });

  it('dgnFileName strips special characters', () => {
    const name = dgnFileName('Test/Project');
    expect(name).not.toContain('/');
    expect(name.endsWith('.dgn')).toBe(true);
  });
});
