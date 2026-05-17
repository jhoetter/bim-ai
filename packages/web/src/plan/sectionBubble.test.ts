import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import { sectionCutBubbles } from './sectionBubble';

type SectionCut = Extract<Element, { kind: 'section_cut' }>;

const BASE_SECTION: SectionCut = {
  kind: 'section_cut',
  id: 'sc-test-1',
  name: 'Section A',
  lineStartMm: { xMm: 0, yMm: 0 },
  lineEndMm: { xMm: 5000, yMm: 0 },
};

describe('section view head bubble — §6.1.6', () => {
  it('section marker plan symbol includes bubble meshes', () => {
    const grp = sectionCutBubbles(BASE_SECTION);
    const bubbles = grp.children.filter((c) => c instanceof THREE.Mesh);
    expect(bubbles.length).toBeGreaterThanOrEqual(2);
  });

  it('bubble userData has sectionBubble=true', () => {
    const grp = sectionCutBubbles(BASE_SECTION);
    const bubbles = grp.children.filter((c) => c instanceof THREE.Mesh);
    for (const b of bubbles) {
      expect(b.userData.sectionBubble).toBe(true);
    }
  });

  it('bubble userData has sectionViewId set', () => {
    const grp = sectionCutBubbles(BASE_SECTION);
    const bubbles = grp.children.filter((c) => c instanceof THREE.Mesh);
    for (const b of bubbles) {
      expect(b.userData.sectionViewId).toBe('sc-test-1');
    }
  });

  it('arrow-end bubble uses CircleGeometry (filled)', () => {
    const grp = sectionCutBubbles(BASE_SECTION);
    const arrowBubble = grp.children.find(
      (c) => c instanceof THREE.Mesh && c.userData.bubbleEnd === 'arrow',
    ) as THREE.Mesh | undefined;
    expect(arrowBubble).toBeDefined();
    expect(arrowBubble!.geometry).toBeInstanceOf(THREE.CircleGeometry);
  });

  it('tail-end bubble uses RingGeometry (open)', () => {
    const grp = sectionCutBubbles(BASE_SECTION);
    const tailBubble = grp.children.find(
      (c) => c instanceof THREE.Mesh && c.userData.bubbleEnd === 'tail',
    ) as THREE.Mesh | undefined;
    expect(tailBubble).toBeDefined();
    expect(tailBubble!.geometry).toBeInstanceOf(THREE.RingGeometry);
  });

  it('group userData records which section cut it belongs to', () => {
    const grp = sectionCutBubbles(BASE_SECTION);
    expect(grp.userData.sectionBubblesFor).toBe('sc-test-1');
  });

  it('accepts a custom colour without throwing', () => {
    expect(() => sectionCutBubbles(BASE_SECTION, '#ef4444')).not.toThrow();
  });
});
