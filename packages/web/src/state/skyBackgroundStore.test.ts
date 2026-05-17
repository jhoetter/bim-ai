import { describe, expect, it } from 'vitest';

import { useBimStore } from './store';

describe('sky background store — §14.4', () => {
  it('default skyBackground is "default"', () => {
    const { skyBackground } = useBimStore.getState();
    expect(skyBackground).toBe('default');
  });

  it('setSkyBackground updates the store', () => {
    const { setSkyBackground } = useBimStore.getState();
    setSkyBackground('gradient-sky');
    expect(useBimStore.getState().skyBackground).toBe('gradient-sky');
    setSkyBackground('overcast');
    expect(useBimStore.getState().skyBackground).toBe('overcast');
    setSkyBackground('solid');
    expect(useBimStore.getState().skyBackground).toBe('solid');
    setSkyBackground('default');
    expect(useBimStore.getState().skyBackground).toBe('default');
  });

  it('setSkyBackgroundColor updates the color', () => {
    const { setSkyBackgroundColor } = useBimStore.getState();
    setSkyBackgroundColor('#ff0000');
    expect(useBimStore.getState().skyBackgroundColor).toBe('#ff0000');
    setSkyBackgroundColor('#001122');
    expect(useBimStore.getState().skyBackgroundColor).toBe('#001122');
  });
});
