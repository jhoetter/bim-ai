/** §3.6.2: standard window type presets for the family library panel. */
export interface WindowPreset {
  id: string;
  label: string;
  labelDe: string;
  widthMm: number;
  heightMm: number;
  sillHeightMm: number;
  windowStyle: 'casement' | 'double_hung' | 'awning' | 'fixed' | 'sliding';
}

export const WINDOW_PRESETS: WindowPreset[] = [
  {
    id: 'wp-casement-900x1200',
    label: 'Single Casement 900×1200',
    labelDe: 'Einfachflügel 900×1200',
    widthMm: 900,
    heightMm: 1200,
    sillHeightMm: 900,
    windowStyle: 'casement',
  },
  {
    id: 'wp-double-hung-900x1500',
    label: 'Double Hung 900×1500',
    labelDe: 'Doppelt-Hänge 900×1500',
    widthMm: 900,
    heightMm: 1500,
    sillHeightMm: 800,
    windowStyle: 'double_hung',
  },
  {
    id: 'wp-awning-1200x600',
    label: 'Awning 1200×600',
    labelDe: 'Kippfenster 1200×600',
    widthMm: 1200,
    heightMm: 600,
    sillHeightMm: 1400,
    windowStyle: 'awning',
  },
  {
    id: 'wp-fixed-1800x2100',
    label: 'Fixed Glazing 1800×2100',
    labelDe: 'Festverglasung 1800×2100',
    widthMm: 1800,
    heightMm: 2100,
    sillHeightMm: 0,
    windowStyle: 'fixed',
  },
  {
    id: 'wp-sliding-1600x2100',
    label: 'Sliding 2-Panel 1600×2100',
    labelDe: 'Schiebefenster 1600×2100',
    widthMm: 1600,
    heightMm: 2100,
    sillHeightMm: 0,
    windowStyle: 'sliding',
  },
];

/** §3.6.2: standard door type presets for the family library panel. */
export interface DoorPreset {
  id: string;
  label: string;
  labelDe: string;
  widthMm: number;
  heightMm: number;
  doorStyle: 'single' | 'sliding' | 'double_leaf' | 'pocket';
}

export const DOOR_PRESETS: DoorPreset[] = [
  {
    id: 'dp-single-900x2100',
    label: 'Single Door 900×2100',
    labelDe: 'Einfachtür 900×2100',
    widthMm: 900,
    heightMm: 2100,
    doorStyle: 'single',
  },
  {
    id: 'dp-sliding-1800x2100',
    label: 'Sliding Door 1800×2100',
    labelDe: 'Schiebetür 1800×2100',
    widthMm: 1800,
    heightMm: 2100,
    doorStyle: 'sliding',
  },
  {
    id: 'dp-double-leaf-1500x2100',
    label: 'Double-leaf Door 1500×2100',
    labelDe: 'Zweiflügeltür 1500×2100',
    widthMm: 1500,
    heightMm: 2100,
    doorStyle: 'double_leaf',
  },
  {
    id: 'dp-pocket-900x2100',
    label: 'Pocket Door 900×2100',
    labelDe: 'Schiebetür (versenkbar) 900×2100',
    widthMm: 900,
    heightMm: 2100,
    doorStyle: 'pocket',
  },
];
