import { describe, expect, it } from 'vitest';
import { planAnnotationLabelLines } from './planElementMeshBuilders';

describe('plan room label layout', () => {
  it('keeps short labels on a single line', () => {
    expect(planAnnotationLabelLines('Kitchen · 12.4 m²')).toEqual(['Kitchen · 12.4 m²']);
  });

  it('wraps long labels into multiple readable lines', () => {
    const lines = planAnnotationLabelLines('Compact Bathroom Layout Type A · 18.8 m²', 18, 3);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.length > 1)).toBe(true);
    expect(lines.join(' ')).toContain('Bathroom');
    expect(lines.join(' ')).toContain('18.8');
  });

  it('adds an explicit ellipsis when text exceeds the max line count', () => {
    const lines = planAnnotationLabelLines(
      'Ultra long label for a room with many descriptors and metadata fields that should not clip',
      14,
      2,
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith('...')).toBe(true);
  });
});
