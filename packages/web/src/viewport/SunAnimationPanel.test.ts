import { describe, expect, it } from 'vitest';

import { computeSunPositionNoaa } from './sunPositionNoaa';

describe('G1 — Sun study animation', () => {
  it('21 Jun 12:00 UTC lat=48°N yields altitude ≈ 64°', () => {
    // Solar noon at 11.58°E is ~11:46 UTC; 12:00 UTC yields ~63.9°
    const { elevationDeg } = computeSunPositionNoaa(48, 11.58, '2026-06-21', 12, 0, 'off', 0);
    expect(elevationDeg).toBeCloseTo(64, 0);
  });

  it('animation time increments correctly across step boundary', () => {
    // Simulate the animation counter: stepSec=1800, speed=1, framesPerStep=30
    const stepSec = 1800;
    const speed = 1;
    const framesPerStep = 30;
    const increment = (stepSec * speed) / framesPerStep;
    expect(increment).toBe(60); // 60 seconds per frame

    let currentSec = 6 * 3600; // 06:00
    const endSec = 6 * 3600 + 1800; // 06:30
    let frames = 0;
    while (currentSec < endSec) {
      currentSec += increment;
      frames++;
    }
    // After 30 frames we should have crossed the 30-min step
    expect(frames).toBe(30);
    expect(currentSec).toBeGreaterThanOrEqual(endSec);
  });

  it('summer solstice morning has positive elevation', () => {
    const { elevationDeg } = computeSunPositionNoaa(48, 11.58, '2026-06-21', 9, 0, 'off', 0);
    expect(elevationDeg).toBeGreaterThan(0);
  });
});
