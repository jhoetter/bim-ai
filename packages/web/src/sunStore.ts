import { create } from 'zustand';

import type { SunOverlayValues } from './viewport/SunOverlay';

type SunStore = {
  values: SunOverlayValues;
  azimuthDeg: number;
  elevationDeg: number;
  setValues: (patch: Partial<SunOverlayValues>) => void;
  setComputedPosition: (azimuth: number, elevation: number) => void;
};

const DEFAULT_VALUES: SunOverlayValues = {
  latitudeDeg: 48.14,
  longitudeDeg: 11.58,
  dateIso: new Date().toISOString().slice(0, 10),
  hours: 14,
  minutes: 0,
  daylightSavingStrategy: 'auto',
};

export const useSunStore = create<SunStore>((set) => ({
  values: DEFAULT_VALUES,
  azimuthDeg: 145,
  elevationDeg: 35,
  setValues: (patch) => set((s) => ({ values: { ...s.values, ...patch } })),
  setComputedPosition: (azimuthDeg, elevationDeg) => set({ azimuthDeg, elevationDeg }),
}));
