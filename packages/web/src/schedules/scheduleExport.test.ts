import { describe, expect, it } from 'vitest';

import { buildScheduleCsv } from './scheduleExport';

describe('buildScheduleCsv', () => {
  it('produces correct header row matching column labels', () => {
    const cols = ['name', 'level', 'areaM2'];
    const rows = [{ name: 'Room A', level: 'L1', areaM2: 42 }];
    const csv = buildScheduleCsv(cols, rows);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('name,level,areaM2');
  });

  it('double-quotes values containing commas', () => {
    const cols = ['name', 'note'];
    const rows = [{ name: 'Room A', note: 'width, height' }];
    const csv = buildScheduleCsv(cols, rows);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('Room A,"width, height"');
  });

  it('returns header only for empty rows without crashing', () => {
    const cols = ['elementId', 'name', 'level'];
    const csv = buildScheduleCsv(cols, []);
    expect(csv).toBe('elementId,name,level');
  });
});
