/** §1.6.4: indexed help topics for the in-product help search panel. */
export interface HelpTopic {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  shortcut?: string;
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'wall',
    title: 'Draw Walls',
    summary:
      'Press W to activate the Wall tool. Click-click to draw each segment. Press Esc to finish.',
    keywords: ['wall', 'draw', 'segment', 'WA'],
    shortcut: 'W',
  },
  {
    id: 'door',
    title: 'Place Doors',
    summary: 'Press D to activate the Door tool. Click on a wall to insert a door.',
    keywords: ['door', 'insert', 'opening'],
    shortcut: 'D',
  },
  {
    id: 'window',
    title: 'Place Windows',
    summary: 'Press N to activate the Window tool. Click on a wall to insert a window.',
    keywords: ['window', 'insert', 'opening', 'glazing'],
    shortcut: 'N',
  },
  {
    id: 'floor',
    title: 'Draw Floors',
    summary:
      'Press F to activate the Floor tool. Click to define boundary points, then press Enter to create.',
    keywords: ['floor', 'slab', 'boundary'],
    shortcut: 'F',
  },
  {
    id: 'room',
    title: 'Place Rooms',
    summary:
      'Press R to activate the Room tool. Click inside a closed wall boundary to create a room.',
    keywords: ['room', 'space', 'area'],
    shortcut: 'R',
  },
  {
    id: 'column',
    title: 'Place Columns',
    summary: 'Press CO to activate the Column tool. Click to place a structural column.',
    keywords: ['column', 'structural', 'pillar', 'CO'],
    shortcut: 'CO',
  },
  {
    id: 'beam',
    title: 'Place Beams',
    summary: 'Press BM to activate the Beam tool. Click-click to define a beam span.',
    keywords: ['beam', 'structural', 'span', 'framing', 'BM'],
    shortcut: 'BM',
  },
  {
    id: 'stair',
    title: 'Draw Stairs',
    summary:
      'Press ST to activate the Stair tool. Click-click to define the run direction and length.',
    keywords: ['stair', 'steps', 'riser', 'run', 'ST'],
    shortcut: 'ST',
  },
  {
    id: 'roof',
    title: 'Draw Roofs',
    summary: 'Press RP to activate the Roof tool. Sketch the roof boundary, set the slope angle.',
    keywords: ['roof', 'slope', 'eave', 'ridge', 'RP'],
    shortcut: 'RP',
  },
  {
    id: 'dimension',
    title: 'Add Dimensions',
    summary:
      'Press DI to activate the Dimension tool. Click two reference points, then place the dimension line.',
    keywords: ['dimension', 'annotation', 'measure', 'DI'],
    shortcut: 'DI',
  },
  {
    id: 'tag',
    title: 'Tag Elements',
    summary: 'Press TG to add a tag to a selected element (room, door, window).',
    keywords: ['tag', 'label', 'annotation', 'TG'],
    shortcut: 'TG',
  },
  {
    id: 'undo',
    title: 'Undo / Redo',
    summary: 'Ctrl+Z to undo the last action. Ctrl+Y or Ctrl+Shift+Z to redo.',
    keywords: ['undo', 'redo', 'ctrl z', 'ctrl y'],
    shortcut: 'Ctrl+Z',
  },
  {
    id: 'select',
    title: 'Select Elements',
    summary:
      'Click to select a single element. Box select (left→right: crossing) selects all enclosed elements.',
    keywords: ['select', 'pick', 'box select', 'crossing'],
  },
  {
    id: 'move',
    title: 'Move Elements',
    summary: 'Select an element, then press M or drag a grip handle to move it.',
    keywords: ['move', 'drag', 'grip', 'reposition'],
    shortcut: 'M',
  },
  {
    id: 'copy',
    title: 'Copy Elements',
    summary: 'Select elements, press Ctrl+C to copy, Ctrl+V to paste at a new location.',
    keywords: ['copy', 'paste', 'duplicate', 'ctrl c'],
  },
  {
    id: 'mirror',
    title: 'Mirror Elements',
    summary: 'Select an element, then use Modify > Mirror or the context menu Mirror option.',
    keywords: ['mirror', 'flip', 'symmetric', 'MR'],
  },
  {
    id: 'rotate',
    title: 'Rotate Elements',
    summary: 'Select an element, use the rotate grip (orange dot) or press RO and pick the center.',
    keywords: ['rotate', 'spin', 'angle', 'RO'],
    shortcut: 'RO',
  },
  {
    id: 'level',
    title: 'Manage Levels',
    summary:
      'Levels define floor heights. Add levels in the Project Browser or via the Level tool.',
    keywords: ['level', 'storey', 'floor height', 'elevation'],
  },
  {
    id: '3d',
    title: '3D View',
    summary:
      'Click the 3D icon or press VV to switch to 3D orbit view. Scroll to zoom, right-drag to orbit.',
    keywords: ['3d', 'orbit', 'view', 'VV'],
    shortcut: 'VV',
  },
  {
    id: 'section',
    title: 'Create Sections',
    summary: 'Press SE to place a section marker. The section view appears in the Project Browser.',
    keywords: ['section', 'cut', 'section view', 'SE'],
    shortcut: 'SE',
  },
  {
    id: 'grid',
    title: 'Draw Grids',
    summary: 'Press GR to activate the Grid tool. Draw horizontal and vertical grid lines.',
    keywords: ['grid', 'column grid', 'GR'],
    shortcut: 'GR',
  },
  {
    id: 'material',
    title: 'Assign Materials',
    summary:
      'Select an element, click the Material field in the inspector to open the Material Browser.',
    keywords: ['material', 'texture', 'finish', 'paint'],
  },
  {
    id: 'export',
    title: 'Export DXF / IFC',
    summary:
      'Use Project Menu > Export DXF for CAD export, or Export IFC for BIM interoperability.',
    keywords: ['export', 'dxf', 'ifc', 'dwg', 'cad'],
  },
  {
    id: 'pdf',
    title: 'Export to PDF',
    summary: 'Use Project Menu > Export PDF to generate a multi-sheet PDF from your sheets.',
    keywords: ['pdf', 'print', 'plot', 'export'],
  },
  {
    id: 'family',
    title: 'Family Editor',
    summary:
      'Double-click a family_definition element or open from the Family Library to enter the family editor.',
    keywords: ['family', 'parametric', 'family editor', 'FE'],
  },
];

export function searchHelpTopics(query: string): HelpTopic[] {
  if (!query.trim()) return HELP_TOPICS;
  const q = query.toLowerCase();
  return HELP_TOPICS.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.summary.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}
