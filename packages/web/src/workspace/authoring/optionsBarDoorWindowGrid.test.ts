import { describe, expect, it } from 'vitest';
import {
  doorTagOnPlace,
  setDoorTagOnPlace,
  windowSillHeightMm,
  setWindowSillHeightMm,
  windowTagOnPlace,
  setWindowTagOnPlace,
  gridSpacingMm,
  setGridSpacingMm,
  gridNamePrefix,
  setGridNamePrefix,
} from './OptionsBar';

describe('Options bar door/window/grid — §1.6.6', () => {
  it('doorTagOnPlace defaults to false', () => {
    expect(doorTagOnPlace).toBe(false);
  });

  it('setDoorTagOnPlace updates module var', () => {
    setDoorTagOnPlace(true);
    expect(doorTagOnPlace).toBe(true);
    setDoorTagOnPlace(false);
  });

  it('windowSillHeightMm defaults to 900', () => {
    expect(windowSillHeightMm).toBe(900);
  });

  it('setWindowSillHeightMm updates module var', () => {
    setWindowSillHeightMm(1200);
    expect(windowSillHeightMm).toBe(1200);
    setWindowSillHeightMm(900);
  });

  it('gridSpacingMm defaults to 6000', () => {
    expect(gridSpacingMm).toBe(6000);
  });

  it('setGridSpacingMm updates module var', () => {
    setGridSpacingMm(8000);
    expect(gridSpacingMm).toBe(8000);
    setGridSpacingMm(6000);
  });

  it('gridNamePrefix defaults to A', () => {
    expect(gridNamePrefix).toBe('A');
  });

  it('setGridNamePrefix updates module var', () => {
    setGridNamePrefix('1');
    expect(gridNamePrefix).toBe('1');
    setGridNamePrefix('A');
  });
});
