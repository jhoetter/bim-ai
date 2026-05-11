/**
 * CHR-V3-08 — toolPrefsStore unit tests.
 *
 * Verifies sticky-per-session toggle + cycle state, default fallbacks,
 * and advanceCycle wrapping.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { useToolPrefs } from './toolPrefsStore';

beforeEach(() => {
  useToolPrefs.setState({ toggles: {}, cycles: {}, draftGridVisible: true });
});

describe('toggle state', () => {
  it('returns defaultOn when no state has been set', () => {
    const { getToggle } = useToolPrefs.getState();
    expect(getToggle('wall', 'loop', false)).toBe(false);
    expect(getToggle('wall', 'loop', true)).toBe(true);
  });

  it('setToggle persists and getToggle reads it', () => {
    const { setToggle, getToggle } = useToolPrefs.getState();
    setToggle('wall', 'loop', true);
    expect(getToggle('wall', 'loop', false)).toBe(true);
  });

  it('toggle state is per-tool: wall loop does not affect door loop', () => {
    const { setToggle, getToggle } = useToolPrefs.getState();
    setToggle('wall', 'loop', true);
    expect(getToggle('door', 'loop', false)).toBe(false);
  });

  it('toggling back to false is reflected', () => {
    const { setToggle, getToggle } = useToolPrefs.getState();
    setToggle('wall', 'multiple', true);
    setToggle('wall', 'multiple', false);
    expect(getToggle('wall', 'multiple', true)).toBe(false);
  });
});

describe('cycle state', () => {
  it('returns defaultValue when no state has been set', () => {
    const { getCycle } = useToolPrefs.getState();
    expect(getCycle('wall', 'location-line', 'wall-centerline')).toBe('wall-centerline');
  });

  it('setCycle persists and getCycle reads it', () => {
    const { setCycle, getCycle } = useToolPrefs.getState();
    setCycle('wall', 'location-line', 'finish-face-exterior');
    expect(getCycle('wall', 'location-line', 'wall-centerline')).toBe('finish-face-exterior');
  });

  it('cycle state is per-tool', () => {
    const { setCycle, getCycle } = useToolPrefs.getState();
    setCycle('wall', 'location-line', 'core-centerline');
    expect(getCycle('door', 'location-line', 'wall-centerline')).toBe('wall-centerline');
  });
});

describe('advanceCycle', () => {
  const values = ['wall-centerline', 'finish-face-exterior', 'finish-face-interior'] as const;

  it('advances from first to second value', () => {
    const { advanceCycle, getCycle } = useToolPrefs.getState();
    advanceCycle('wall', 'location-line', values, 'wall-centerline');
    expect(getCycle('wall', 'location-line', 'wall-centerline')).toBe('finish-face-exterior');
  });

  it('wraps around at the end', () => {
    const { setCycle, advanceCycle, getCycle } = useToolPrefs.getState();
    setCycle('wall', 'location-line', 'finish-face-interior');
    advanceCycle('wall', 'location-line', values, 'wall-centerline');
    expect(getCycle('wall', 'location-line', 'wall-centerline')).toBe('wall-centerline');
  });

  it('returns the next value', () => {
    const { advanceCycle } = useToolPrefs.getState();
    const next = advanceCycle('wall', 'location-line', values, 'wall-centerline');
    expect(next).toBe('finish-face-exterior');
  });
});

describe('drafting grid visibility', () => {
  it('defaults on and toggles from status chrome', () => {
    const { toggleDraftGridVisible, setDraftGridVisible } = useToolPrefs.getState();
    expect(useToolPrefs.getState().draftGridVisible).toBe(true);

    toggleDraftGridVisible();
    expect(useToolPrefs.getState().draftGridVisible).toBe(false);

    setDraftGridVisible(true);
    expect(useToolPrefs.getState().draftGridVisible).toBe(true);
  });
});
