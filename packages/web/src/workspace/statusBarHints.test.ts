import { describe, expect, it } from 'vitest';
import { getStatusHint } from './shell/statusBarHints';

describe('getStatusHint — §1.6.9', () => {
  it('returns select hint when tool is null', () => {
    expect(getStatusHint(null, null)).toBe('Click to select · Drag to pan · Scroll to zoom');
  });

  it('returns select hint when tool is "select"', () => {
    expect(getStatusHint('select', null)).toBe('Click to select · Drag to pan · Scroll to zoom');
  });

  it('returns wall idle hint', () => {
    expect(getStatusHint('wall', 'idle')).toBe('Click to start wall');
  });

  it('returns wall drawing hint', () => {
    expect(getStatusHint('wall', 'drawing')).toBe(
      'Click next point · Double-click or Enter to finish · Esc to cancel',
    );
  });

  it('returns column idle hint', () => {
    expect(getStatusHint('column', null)).toBe('Click to place column');
  });

  it('returns measure picking hint', () => {
    expect(getStatusHint('measure', 'picking')).toBe('Click second point · Esc to cancel');
  });

  it('returns floor idle hint', () => {
    expect(getStatusHint('floor', 'idle')).toBe('Click points to define floor boundary');
  });

  it('returns floor drawing hint', () => {
    expect(getStatusHint('floor', 'drawing')).toBe(
      'Click to add point · Enter to finish · Esc to cancel',
    );
  });

  it('returns stair idle hint', () => {
    expect(getStatusHint('stair', 'idle')).toBe('Click to place stair run start');
  });

  it('returns stair drawing hint', () => {
    expect(getStatusHint('stair', 'drawing')).toBe('Click to set stair end point');
  });

  it('returns permanent-dimension idle hint', () => {
    expect(getStatusHint('permanent-dimension', 'idle')).toBe('Click first witness point');
  });

  it('returns permanent-dimension picking hint', () => {
    expect(getStatusHint('permanent-dimension', 'picking')).toBe(
      'Click next point · Enter to finish',
    );
  });

  it('returns fallback for unknown tool', () => {
    expect(getStatusHint('unknown-tool', null)).toBe('Press Esc to cancel · Press Enter to finish');
  });
});
