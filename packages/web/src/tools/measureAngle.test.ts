import { describe, it, expect } from 'vitest';
import {
  initialMeasureAngleState,
  reduceMeasureAngle,
  initialMeasureArcState,
  reduceMeasureArc,
} from './toolGrammar';

const pt = (xMm: number, yMm: number) => ({ xMm, yMm });

describe('measure angle grammar — §3.3.8', () => {
  it('initialMeasureAngleState returns idle status', () => {
    expect(initialMeasureAngleState().status).toBe('idle');
  });

  it('first click sets vertexMm and status=picked-vertex', () => {
    const s0 = initialMeasureAngleState();
    const s1 = reduceMeasureAngle(s0, { type: 'click', positionMm: pt(0, 0) });
    expect(s1.status).toBe('picked-vertex');
    expect(s1.vertexMm).toEqual(pt(0, 0));
  });

  it('second click sets firstRayMm and status=picked-first-ray', () => {
    let s = initialMeasureAngleState();
    s = reduceMeasureAngle(s, { type: 'click', positionMm: pt(0, 0) });
    s = reduceMeasureAngle(s, { type: 'click', positionMm: pt(1000, 0) });
    expect(s.status).toBe('picked-first-ray');
    expect(s.firstRayMm).toEqual(pt(1000, 0));
  });

  it('third click computes angleDeg and status=complete', () => {
    let s = initialMeasureAngleState();
    s = reduceMeasureAngle(s, { type: 'click', positionMm: pt(0, 0) }); // vertex
    s = reduceMeasureAngle(s, { type: 'click', positionMm: pt(1000, 0) }); // first ray
    s = reduceMeasureAngle(s, { type: 'click', positionMm: pt(0, 1000) }); // second ray → 90°
    expect(s.status).toBe('complete');
    expect(s.angleDeg).not.toBeNull();
    expect(s.angleDeg!).toBeCloseTo(90, 4);
  });

  it('cancel resets to idle', () => {
    let s = initialMeasureAngleState();
    s = reduceMeasureAngle(s, { type: 'click', positionMm: pt(0, 0) });
    s = reduceMeasureAngle(s, { type: 'cancel' });
    expect(s.status).toBe('idle');
    expect(s.vertexMm).toBeNull();
  });

  it('activate resets to idle regardless of current state', () => {
    let s = initialMeasureAngleState();
    s = reduceMeasureAngle(s, { type: 'click', positionMm: pt(0, 0) });
    s = reduceMeasureAngle(s, { type: 'activate' });
    expect(s.status).toBe('idle');
  });
});

describe('measure arc grammar — §3.3.8', () => {
  it('initialMeasureArcState returns idle status', () => {
    expect(initialMeasureArcState().status).toBe('idle');
  });

  it('first click sets startMm and status=picked-start', () => {
    const s = reduceMeasureArc(initialMeasureArcState(), {
      type: 'click',
      positionMm: pt(1000, 0),
    });
    expect(s.status).toBe('picked-start');
    expect(s.startMm).toEqual(pt(1000, 0));
  });

  it('second click sets endMm and status=picked-end', () => {
    let s = initialMeasureArcState();
    s = reduceMeasureArc(s, { type: 'click', positionMm: pt(1000, 0) });
    s = reduceMeasureArc(s, { type: 'click', positionMm: pt(-1000, 0) });
    expect(s.status).toBe('picked-end');
    expect(s.endMm).toEqual(pt(-1000, 0));
  });

  it('third click computes arcLengthMm and radiusMm on semicircle', () => {
    let s = initialMeasureArcState();
    s = reduceMeasureArc(s, { type: 'click', positionMm: pt(1000, 0) });
    s = reduceMeasureArc(s, { type: 'click', positionMm: pt(-1000, 0) });
    s = reduceMeasureArc(s, { type: 'click', positionMm: pt(0, 1000) }); // pass-through
    expect(s.status).toBe('complete');
    expect(s.radiusMm).toBeCloseTo(1000, 0);
    expect(s.arcLengthMm).toBeCloseTo(Math.PI * 1000, 0);
  });

  it('cancel resets to idle', () => {
    let s = initialMeasureArcState();
    s = reduceMeasureArc(s, { type: 'click', positionMm: pt(0, 0) });
    s = reduceMeasureArc(s, { type: 'cancel' });
    expect(s.status).toBe('idle');
    expect(s.startMm).toBeNull();
  });
});
