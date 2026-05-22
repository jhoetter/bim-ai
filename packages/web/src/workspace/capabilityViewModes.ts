import type { WorkspaceMode } from '../tools/toolRegistry';

export const CAPABILITY_VIEW_MODES = [
  'plan',
  '3d',
  'elevation',
  'section',
  'sheet',
  'schedule',
] as const satisfies readonly WorkspaceMode[];

export type CapabilityViewMode = (typeof CAPABILITY_VIEW_MODES)[number];
