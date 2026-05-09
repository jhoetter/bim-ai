import { describe, it, expect, beforeEach } from 'vitest';
import { useSunStore } from '../sunStore';

// Reset store state between tests
beforeEach(() => {
  useSunStore.setState({
    values: {
      latitudeDeg: 48.14,
      longitudeDeg: 11.58,
      dateIso: new Date().toISOString().slice(0, 10),
      hours: 14,
      minutes: 0,
      daylightSavingStrategy: 'auto',
    },
    azimuthDeg: 145,
    elevationDeg: 35,
  });
});

describe('sunStore', () => {
  it('is importable without a DOM (node environment)', () => {
    expect(useSunStore).toBeDefined();
    expect(typeof useSunStore.getState).toBe('function');
  });

  it('has reasonable Munich default values (latitude ~48°)', () => {
    const state = useSunStore.getState();
    expect(state.values.latitudeDeg).toBeCloseTo(48.14, 1);
    expect(state.values.longitudeDeg).toBeCloseTo(11.58, 1);
  });

  it('setValues updates values correctly', () => {
    useSunStore.getState().setValues({ hours: 10, minutes: 30 });
    const state = useSunStore.getState();
    expect(state.values.hours).toBe(10);
    expect(state.values.minutes).toBe(30);
  });

  it('setValues with partial patch only changes provided fields', () => {
    const before = useSunStore.getState().values;
    useSunStore.getState().setValues({ hours: 8 });
    const after = useSunStore.getState().values;
    // Only hours changed
    expect(after.hours).toBe(8);
    // All other fields remain unchanged
    expect(after.latitudeDeg).toBe(before.latitudeDeg);
    expect(after.longitudeDeg).toBe(before.longitudeDeg);
    expect(after.dateIso).toBe(before.dateIso);
    expect(after.minutes).toBe(before.minutes);
    expect(after.daylightSavingStrategy).toBe(before.daylightSavingStrategy);
  });

  it('setComputedPosition updates azimuth and elevation', () => {
    useSunStore.getState().setComputedPosition(200, 45);
    const state = useSunStore.getState();
    expect(state.azimuthDeg).toBe(200);
    expect(state.elevationDeg).toBe(45);
  });

  it('setComputedPosition does not affect values', () => {
    const before = useSunStore.getState().values;
    useSunStore.getState().setComputedPosition(90, 60);
    const after = useSunStore.getState().values;
    expect(after).toEqual(before);
  });

  it('setValues with dateIso updates only the date', () => {
    const newDate = '2026-12-21';
    useSunStore.getState().setValues({ dateIso: newDate });
    expect(useSunStore.getState().values.dateIso).toBe(newDate);
    // latitude stays unchanged
    expect(useSunStore.getState().values.latitudeDeg).toBeCloseTo(48.14, 1);
  });

  it('default azimuthDeg and elevationDeg are reasonable starting values', () => {
    const state = useSunStore.getState();
    expect(state.azimuthDeg).toBe(145);
    expect(state.elevationDeg).toBe(35);
  });
});
