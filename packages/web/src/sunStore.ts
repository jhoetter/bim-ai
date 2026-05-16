import { create } from 'zustand';

import type { SunOverlayValues } from './viewport/SunOverlay';

type SunStore = {
  values: SunOverlayValues;
  azimuthDeg: number;
  elevationDeg: number;
  /** F6: project north offset added to the geographic azimuth for plan-view display. */
  projectNorthOffsetDeg: number;
  setValues: (patch: Partial<SunOverlayValues>) => void;
  setComputedPosition: (azimuth: number, elevation: number) => void;
  setProjectNorthOffsetDeg: (deg: number) => void;
  /** Azimuth adjusted for project north rotation — use this for plan-view sun direction. */
  displayAzimuthDeg: () => number;
};

const DEFAULT_VALUES: SunOverlayValues = {
  latitudeDeg: 48.14,
  longitudeDeg: 11.58,
  dateIso: new Date().toISOString().slice(0, 10),
  hours: 14,
  minutes: 0,
  daylightSavingStrategy: 'auto',
};

export const useSunStore = create<SunStore>((set, get) => ({
  values: DEFAULT_VALUES,
  azimuthDeg: 145,
  elevationDeg: 35,
  projectNorthOffsetDeg: 0,
  setValues: (patch) => set((s) => ({ values: { ...s.values, ...patch } })),
  setComputedPosition: (azimuthDeg, elevationDeg) => set({ azimuthDeg, elevationDeg }),
  setProjectNorthOffsetDeg: (deg) => set({ projectNorthOffsetDeg: deg }),
  displayAzimuthDeg: () => {
    const s = get();
    return (((s.azimuthDeg - s.projectNorthOffsetDeg) % 360) + 360) % 360;
  },
}));
