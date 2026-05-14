import type { ToolId, WorkspaceMode } from './toolRegistry';

export type AuthoringCommandKind =
  | 'line'
  | 'sketch'
  | 'hosted'
  | 'point'
  | 'modify'
  | 'review'
  | 'document'
  | 'resource';

export type AuthoringCompletionBehavior =
  | 'select-after-commit'
  | 'remain-active-while-looping'
  | 'explicit-finish'
  | 'stay-active'
  | 'selection-only'
  | 'opens-resource';

export interface AuthoringCommandContract {
  toolId: ToolId;
  kind: AuthoringCommandKind;
  validModes: WorkspaceMode[];
  requiredContext: string[];
  activeOptions: string[];
  previewSemantics: string;
  completionBehavior: AuthoringCompletionBehavior;
  defaultAfterCancel: 'select';
}

function contract(
  toolId: ToolId,
  kind: AuthoringCommandKind,
  validModes: WorkspaceMode[],
  previewSemantics: string,
  completionBehavior: AuthoringCompletionBehavior,
  requiredContext: string[] = [],
  activeOptions: string[] = [],
): AuthoringCommandContract {
  return {
    toolId,
    kind,
    validModes,
    requiredContext,
    activeOptions,
    previewSemantics,
    completionBehavior,
    defaultAfterCancel: 'select',
  };
}

export const AUTHORING_COMMAND_CONTRACTS = {
  select: contract(
    'select',
    'review',
    ['plan', '3d', 'section', 'sheet', 'schedule'],
    'Selection cursor with hover hit feedback and no model mutation.',
    'selection-only',
  ),
  query: contract(
    'query',
    'review',
    ['plan'],
    'Hover/click imported underlay geometry and report the source primitive.',
    'stay-active',
    ['visible-import-underlay'],
  ),
  wall: contract(
    'wall',
    'line',
    ['plan', '3d'],
    'Two-click wall center/location line preview; committed payload must match preview endpoints.',
    'remain-active-while-looping',
    [],
    ['type', 'level', 'height', 'location-line', 'chain', 'flip'],
  ),
  door: contract(
    'door',
    'hosted',
    ['plan', '3d'],
    'Host-wall preview with swing, rough opening, and conflict state before click.',
    'select-after-commit',
    ['has-wall-host'],
    ['type', 'host-lock', 'handing'],
  ),
  window: contract(
    'window',
    'hosted',
    ['plan', '3d'],
    'Host-wall preview with size, sill height, and conflict state before click.',
    'select-after-commit',
    ['has-wall-host'],
    ['type', 'host-lock', 'sill-height'],
  ),
  floor: contract(
    'floor',
    'sketch',
    ['plan', '3d'],
    'Closed boundary sketch preview with slab thickness and loop validation.',
    'explicit-finish',
    [],
    ['type', 'level', 'pick-lines', 'pick-walls', 'finish', 'cancel'],
  ),
  'floor-sketch': contract(
    'floor-sketch',
    'sketch',
    ['plan'],
    'Closed boundary sketch preview with finish/cancel validation.',
    'explicit-finish',
    [],
    ['type', 'level', 'pick-lines', 'pick-walls', 'finish', 'cancel'],
  ),
  roof: contract(
    'roof',
    'sketch',
    ['plan', '3d'],
    'Roof footprint or picked loop preview with overhang and slope intent.',
    'explicit-finish',
    [],
    ['type', 'level', 'overhang', 'slope', 'pick-walls', 'finish', 'cancel'],
  ),
  'roof-sketch': contract(
    'roof-sketch',
    'sketch',
    ['plan'],
    'Roof footprint sketch preview with slope/overhang validation.',
    'explicit-finish',
    [],
    ['type', 'level', 'overhang', 'slope', 'finish', 'cancel'],
  ),
  'room-separation-sketch': contract(
    'room-separation-sketch',
    'sketch',
    ['plan'],
    'Room boundary line sketch preview used by room closure detection.',
    'remain-active-while-looping',
    [],
    ['chain', 'finish', 'cancel'],
  ),
  stair: contract(
    'stair',
    'sketch',
    ['plan', '3d'],
    'Stair run/path sketch preview with generated riser count before finish.',
    'explicit-finish',
    [],
    ['base-level', 'top-level', 'run-width', 'finish', 'cancel'],
  ),
  railing: contract(
    'railing',
    'line',
    ['plan', '3d'],
    'Path preview hosted on floor, stair, or work plane before commit.',
    'remain-active-while-looping',
    ['floor-or-wall-or-stair-host'],
    ['type', 'host', 'chain'],
  ),
  room: contract(
    'room',
    'point',
    ['plan', '3d'],
    'Room placement preview resolves the enclosing boundary before commit.',
    'select-after-commit',
    ['room-bounding-loop'],
    ['name', 'number', 'tag-on-place'],
  ),
  area: contract(
    'area',
    'point',
    ['plan', '3d'],
    'Area placement preview resolves the active area boundary before commit.',
    'select-after-commit',
    ['area-boundary-loop'],
    ['scheme', 'tag-on-place'],
  ),
  dimension: contract(
    'dimension',
    'line',
    ['plan', 'section'],
    'Two-reference dimension preview with snap references and text location.',
    'select-after-commit',
    ['dimensionable-reference'],
    ['style', 'snap-reference'],
  ),
  section: contract(
    'section',
    'document',
    ['plan', 'section'],
    'Section cut line preview with far clip before view creation.',
    'select-after-commit',
    [],
    ['depth', 'view-template'],
  ),
  elevation: contract(
    'elevation',
    'document',
    ['plan'],
    'Elevation marker preview with direction before view creation.',
    'select-after-commit',
    [],
    ['direction', 'view-template'],
  ),
  grid: contract(
    'grid',
    'line',
    ['plan', '3d'],
    'Two-click datum line preview with bubble endpoint.',
    'remain-active-while-looping',
    [],
    ['name', 'bubble-end'],
  ),
  'reference-plane': contract(
    'reference-plane',
    'line',
    ['plan', '3d'],
    'Two-click reference plane preview on active work plane.',
    'remain-active-while-looping',
    [],
    ['name', 'chain'],
  ),
  'property-line': contract(
    'property-line',
    'line',
    ['plan'],
    'Site boundary segment preview on active plan.',
    'remain-active-while-looping',
    [],
    ['chain'],
  ),
  'area-boundary': contract(
    'area-boundary',
    'sketch',
    ['plan'],
    'Area boundary segment preview with closure feedback.',
    'remain-active-while-looping',
    [],
    ['chain', 'finish', 'cancel'],
  ),
  'masking-region': contract(
    'masking-region',
    'sketch',
    ['plan'],
    'Closed annotation region preview with loop validation.',
    'explicit-finish',
    [],
    ['finish', 'cancel'],
  ),
  'plan-region': contract(
    'plan-region',
    'sketch',
    ['plan'],
    'Closed plan-region preview with cut-plane override fields.',
    'explicit-finish',
    [],
    ['cut-plane', 'finish', 'cancel'],
  ),
  tag: contract(
    'tag',
    'point',
    ['plan'],
    'Tag preview bound to the hovered element category before commit.',
    'select-after-commit',
    ['taggable-element'],
    ['tag-type', 'leader'],
  ),
  align: contract(
    'align',
    'modify',
    ['plan'],
    'Reference then target alignment preview before transform commit.',
    'select-after-commit',
    ['has-alignable-reference'],
    ['lock'],
  ),
  split: contract(
    'split',
    'modify',
    ['plan'],
    'Hover split-point preview on supported linear elements.',
    'select-after-commit',
    ['linear-element'],
  ),
  trim: contract(
    'trim',
    'modify',
    ['plan'],
    'Two-wall trim preview that shows the kept/removed extents before commit.',
    'select-after-commit',
    ['two-trimmable-elements'],
  ),
  'trim-extend': contract(
    'trim-extend',
    'modify',
    ['plan'],
    'Two-wall trim/extend preview to a clean intersection.',
    'select-after-commit',
    ['two-trimmable-elements'],
  ),
  offset: contract(
    'offset',
    'modify',
    ['plan'],
    'Selected-wall parallel offset preview from original centerline to clicked target line.',
    'select-after-commit',
    ['has-selection', 'wall'],
  ),
  mirror: contract(
    'mirror',
    'modify',
    ['plan'],
    'Mirror-axis preview and copied/original result before commit.',
    'select-after-commit',
    ['has-selection'],
    ['copy'],
  ),
  'wall-join': contract(
    'wall-join',
    'modify',
    ['plan'],
    'Join/disallow-join endpoint preview before topology update.',
    'select-after-commit',
    ['wall-endpoint'],
  ),
  'wall-opening': contract(
    'wall-opening',
    'hosted',
    ['plan', '3d'],
    'Opening preview on the selected/hovered wall face before commit.',
    'select-after-commit',
    ['has-wall-host'],
    ['sill', 'head', 'host-lock'],
  ),
  shaft: contract(
    'shaft',
    'sketch',
    ['plan', '3d'],
    'Shaft footprint and vertical extent preview with affected levels.',
    'explicit-finish',
    [],
    ['base-level', 'top-level', 'finish', 'cancel'],
  ),
  column: contract(
    'column',
    'point',
    ['plan', '3d'],
    'Column footprint/height preview at the active work plane before commit.',
    'select-after-commit',
    [],
    ['type', 'base-level', 'top-level'],
  ),
  beam: contract(
    'beam',
    'line',
    ['plan', '3d'],
    'Two-point beam preview with level, offset, and support snaps.',
    'remain-active-while-looping',
    [],
    ['type', 'level', 'offset', 'chain'],
  ),
  ceiling: contract(
    'ceiling',
    'sketch',
    ['plan', '3d'],
    'Ceiling boundary/room-loop preview with height offset before finish.',
    'explicit-finish',
    [],
    ['type', 'level', 'offset', 'pick-room', 'finish', 'cancel'],
  ),
  toposolid_subdivision: contract(
    'toposolid_subdivision',
    'sketch',
    ['plan'],
    'Subdivision region preview on the picked toposolid face.',
    'explicit-finish',
    ['toposolid-host'],
    ['category', 'finish', 'cancel'],
  ),
  measure: contract(
    'measure',
    'review',
    ['plan'],
    'Two-point measurement preview with temporary readout only.',
    'stay-active',
    [],
    ['snap'],
  ),
  component: contract(
    'component',
    'resource',
    ['plan', '3d'],
    'Family-specific placement preview using the loaded placement adapter.',
    'select-after-commit',
    ['loaded-family-type'],
    ['type', 'rotate', 'host-lock'],
  ),
  copy: contract(
    'copy',
    'modify',
    ['plan'],
    'Reference and destination preview for copied selected elements.',
    'select-after-commit',
    ['has-selection'],
    ['multiple'],
  ),
  rotate: contract(
    'rotate',
    'modify',
    ['plan'],
    'Center/reference/angle preview for selected elements.',
    'select-after-commit',
    ['has-selection'],
    ['angle', 'copy'],
  ),
  move: contract(
    'move',
    'modify',
    ['plan'],
    'Reference and destination preview for selected elements.',
    'select-after-commit',
    ['has-selection'],
  ),
} satisfies Record<ToolId, AuthoringCommandContract>;

export function getAuthoringCommandContract(toolId: ToolId): AuthoringCommandContract {
  return AUTHORING_COMMAND_CONTRACTS[toolId];
}
