import type { LensMode } from '@bim-ai/core';

export type LensViewMode = 'plan' | '3d' | 'section' | 'sheet' | 'schedule';

export interface LensUxDefinition {
  id: LensMode;
  label: string;
  germanName: string;
  shortPurpose: string;
  visualBehavior: Partial<Record<LensViewMode, string>>;
  inspectorFocus: string[];
  scheduleFamilies: string[];
  sheetDeliverables: string[];
  ribbonFocus: string[];
}

export const LENS_ORDER = [
  'architecture',
  'structure',
  'mep',
  'coordination',
  'fire-safety',
  'energy',
  'construction',
  'sustainability',
  'cost-quantity',
  'all',
] as const satisfies readonly LensMode[];

export type SelectableLensMode = (typeof LENS_ORDER)[number];

export const LENS_UX: Record<SelectableLensMode, LensUxDefinition> = {
  architecture: {
    id: 'architecture',
    label: 'Architecture',
    germanName: 'Architektur',
    shortPurpose: 'Spatial, envelope, opening, and documentation authoring.',
    visualBehavior: {
      plan: 'Architectural elements stay foregrounded; consultant data remains secondary.',
      '3d': 'The building model is shown as the primary design model.',
      section: 'Cut geometry, materials, room/opening context, and annotations are foregrounded.',
      schedule: 'Room, door, window, and type schedules are prioritized.',
      sheet:
        'General arrangement, plans, sections, elevations, and documentation sheets are prioritized.',
    },
    inspectorFocus: [
      'Type and dimensions',
      'Hosts and openings',
      'Materials',
      'Room relationships',
    ],
    scheduleFamilies: [
      'Room schedule',
      'Door schedule',
      'Window schedule',
      'Wall/Floor/Roof types',
    ],
    sheetDeliverables: ['General arrangement', 'Floor plans', 'Sections', 'Elevations'],
    ribbonFocus: ['Wall', 'Floor/Roof', 'Door/Window', 'Room', 'Stair/Railing'],
  },
  structure: {
    id: 'structure',
    label: 'Structure',
    germanName: 'Tragwerk',
    shortPurpose: 'Load-bearing classification, framing, slabs, grids, and structural review.',
    visualBehavior: {
      plan: 'Structural elements and load-bearing shared elements stay foregrounded.',
      '3d': 'Columns, beams, slabs, grids, and load-bearing walls stay foregrounded.',
      section: 'Structural cut elements and analytical context are foregrounded.',
      schedule: 'Column, beam, slab, opening, and load-bearing wall schedules are prioritized.',
      sheet:
        'Structural plans, framing sheets, and foundation/roof-structure deliverables are prioritized.',
    },
    inspectorFocus: [
      'Structural role',
      'Load-bearing',
      'Analytical alignment',
      'Structural material',
    ],
    scheduleFamilies: ['Column schedule', 'Beam schedule', 'Slab schedule', 'Load-bearing walls'],
    sheetDeliverables: ['Structural plans', 'Framing plans', 'Foundation sheets'],
    ribbonFocus: ['Grid', 'Column', 'Beam', 'Structural slab', 'Opening'],
  },
  mep: {
    id: 'mep',
    label: 'MEP',
    germanName: 'TGA',
    shortPurpose: 'Technical building services systems, equipment, penetrations, and coordination.',
    visualBehavior: {
      plan: 'MEP systems and service-space context should stay foregrounded.',
      '3d': 'Pipes, ducts, fixtures, equipment, and system context should stay foregrounded.',
      section: 'Services crossing the cut and penetrations should be emphasized.',
      schedule: 'System, equipment, fixture, duct, and pipe schedules are prioritized.',
      sheet: 'HVAC, plumbing, electrical, and coordination sheets are prioritized.',
    },
    inspectorFocus: ['System', 'Service type', 'Size/offset', 'Host and penetration coordination'],
    scheduleFamilies: ['Equipment schedule', 'Fixture schedule', 'Duct schedule', 'Pipe schedule'],
    sheetDeliverables: ['HVAC plans', 'Plumbing plans', 'Electrical plans', 'Coordination sheets'],
    ribbonFocus: ['Component', 'System', 'Opening request', 'Coordination check'],
  },
  coordination: {
    id: 'coordination',
    label: 'Coordination',
    germanName: 'Koordination',
    shortPurpose: 'Cross-discipline model QA, clashes, linked models, issues, and review packages.',
    visualBehavior: {
      plan: 'All disciplines remain readable while issue and clash overlays are foregrounded.',
      '3d': 'All model context stays visible; clash markers, issue pins, and link status carry the lens.',
      section: 'Cross-discipline conflicts through the cut are foregrounded.',
      schedule: 'Clash, issue, link-status, and assignment schedules are prioritized.',
      sheet: 'Coordination issue sheets and clash viewpoints are prioritized.',
    },
    inspectorFocus: ['Issues', 'Clashes', 'Linked-model conflicts', 'Review status', 'BCF refs'],
    scheduleFamilies: ['Clash list', 'Issue list', 'Linked model status', 'Review assignments'],
    sheetDeliverables: ['Coordination issues', 'Clash viewpoints', 'Review packages'],
    ribbonFocus: ['Checks', 'Issues', 'Links', 'BCF / review'],
  },
  'fire-safety': {
    id: 'fire-safety',
    label: 'Fire Safety',
    germanName: 'Brandschutz',
    shortPurpose:
      'Fire compartments, escape routes, ratings, penetrations, and code-review handoff.',
    visualBehavior: {
      plan: 'Compartments, rated walls/doors, escape routes, travel distance, and missing ratings should be visible.',
      '3d': 'Fire-rated hosts and fire-safety properties stay foregrounded; unrelated elements can ghost.',
      section: 'Rated cut elements and penetrations should be emphasized.',
      schedule:
        'Fire-door, rated-wall, compartment, penetration, and missing-rating schedules are prioritized.',
      sheet: 'Brandschutzplan, escape route, and compartment sheets are prioritized.',
    },
    inspectorFocus: [
      'Required/actual rating',
      'Compartment boundary',
      'Door swing/compliance',
      'Firestopping',
    ],
    scheduleFamilies: [
      'Fire doors',
      'Rated walls',
      'Compartments',
      'Penetrations',
      'Missing ratings',
    ],
    sheetDeliverables: ['Brandschutzplan', 'Escape route plans', 'Compartment plans'],
    ribbonFocus: ['Compartment', 'Escape route', 'Fire rating', 'Penetration', 'Checks'],
  },
  energy: {
    id: 'energy',
    label: 'Energieberatung',
    germanName: 'Energieberatung',
    shortPurpose: 'German energy-consulting model enrichment for GEG/iSFP/BEG handoff.',
    visualBehavior: {
      plan: 'Thermal envelope, heated/unheated zones, U-values, and boundary classifications should be visible.',
      '3d': 'Thermal envelope and U-value/shading overlays should explain the energy model.',
      section:
        'Layer thicknesses, lambda values, U-values, and boundary conditions should be emphasized.',
      schedule:
        'Envelope, thermal-material, zone, window/solar, and handoff-completeness schedules are prioritized.',
      sheet:
        'Bestandsaufnahme, envelope summary, renovation scenario, and shading sheets are prioritized.',
    },
    inspectorFocus: [
      'Thermal classification',
      'U-value',
      'Layer thermal properties',
      'Adjacency/boundary',
    ],
    scheduleFamilies: ['Envelope surfaces', 'Thermal materials', 'Zones', 'Windows / solar gains'],
    sheetDeliverables: [
      'Bestandsaufnahme',
      'Envelope summary',
      'Renovation scenario',
      'Shading study',
    ],
    ribbonFocus: [
      'Classify envelope',
      'Thermal zone',
      'U-value',
      'Thermal bridge',
      'Handoff export',
    ],
  },
  construction: {
    id: 'construction',
    label: 'Bauausfuehrung',
    germanName: 'Bauausfuehrung',
    shortPurpose: 'Phase, package, progress, logistics, temporary works, and QA workflows.',
    visualBehavior: {
      plan: 'Phase, package, progress, logistics, and issue overlays should be visible.',
      '3d': 'Construction packages, logistics, QA, and phase/status metadata stay foregrounded.',
      section: 'Phase/package/status through the cut should be emphasized.',
      schedule: 'Package, QA, issue, progress, and logistics schedules are prioritized.',
      sheet: 'Construction sequence, site logistics, QA, and package sheets are prioritized.',
    },
    inspectorFocus: [
      'Phase',
      'Package',
      'Trade',
      'Progress status',
      'Responsible company',
      'QA status',
    ],
    scheduleFamilies: ['Packages', 'QA checklists', 'Issues', 'Progress', 'Logistics'],
    sheetDeliverables: ['Construction sequence', 'Site logistics', 'QA report', 'Package drawings'],
    ribbonFocus: ['Phase', 'Package', 'Logistics', 'Progress', 'QA'],
  },
  sustainability: {
    id: 'sustainability',
    label: 'Sustainability / LCA',
    germanName: 'Nachhaltigkeit / Oekobilanz',
    shortPurpose: 'Embodied carbon, EPDs, material impact, circularity, and LCA export workflows.',
    visualBehavior: {
      plan: 'Carbon hotspots, missing EPDs, and material-impact overlays should be visible.',
      '3d': 'Carbon heatmaps and material impact overlays should explain embodied impact.',
      section: 'Material quantities, EPD state, and assembly impacts should be emphasized.',
      schedule:
        'Material quantity, element carbon, assembly carbon, and missing EPD schedules are prioritized.',
      sheet: 'LCA summary, material impact, and carbon hotspot sheets are prioritized.',
    },
    inspectorFocus: ['EPD source', 'GWP', 'Material quantities', 'Recycled/reuse content'],
    scheduleFamilies: [
      'Material quantities',
      'Element carbon',
      'Assembly carbon',
      'Missing EPD data',
    ],
    sheetDeliverables: ['LCA summary', 'Material impact report', 'Carbon hotspots'],
    ribbonFocus: ['Assign EPD', 'Material impact', 'Carbon heatmap', 'Missing data', 'LCA export'],
  },
  'cost-quantity': {
    id: 'cost-quantity',
    label: 'Cost and Quantity',
    germanName: 'Kosten und Mengen',
    shortPurpose: 'Quantity takeoff, DIN 276 grouping, scenario pricing, and procurement handoff.',
    visualBehavior: {
      plan: 'Measured elements, cost groups, missing classification, and quantity source should be visible.',
      '3d': 'Takeoff/cost-classified elements stay foregrounded; unrelated elements can ghost.',
      section: 'Measured assemblies and quantity basis should be emphasized.',
      schedule:
        'Quantity takeoff, cost estimate, DIN 276, and missing-cost schedules are prioritized.',
      sheet:
        'Cost summaries, takeoff documentation, and scenario comparison sheets are prioritized.',
    },
    inspectorFocus: ['Quantity basis', 'Cost group', 'Unit rate', 'Source', 'Scenario'],
    scheduleFamilies: [
      'Quantity takeoff',
      'Cost estimate',
      'DIN 276 breakdown',
      'Missing cost data',
    ],
    sheetDeliverables: ['Cost summary', 'Takeoff documentation', 'Scenario comparison'],
    ribbonFocus: ['DIN 276', 'Quantity takeoff', 'Unit rates', 'Scenario', 'BOQ export'],
  },
  all: {
    id: 'all',
    label: 'All',
    germanName: 'Alle',
    shortPurpose: 'Visibility aggregate across all modeled disciplines.',
    visualBehavior: {
      plan: 'Everything remains visible without discipline-specific emphasis.',
      '3d': 'Everything remains visible without discipline-specific emphasis.',
      section: 'Everything remains visible without discipline-specific emphasis.',
      schedule: 'All schedule families remain available.',
      sheet: 'All sheet deliverables remain available.',
    },
    inspectorFocus: ['General properties', 'Identity', 'Graphics', 'Evidence'],
    scheduleFamilies: ['All schedules'],
    sheetDeliverables: ['All sheets'],
    ribbonFocus: ['Select', 'View', 'Annotate', 'Review'],
  },
};

export function lensUx(lens: LensMode): LensUxDefinition {
  return LENS_UX[lens as SelectableLensMode] ?? LENS_UX.all;
}

export function lensLabel(lens: LensMode): string {
  return lensUx(lens).label;
}

export function lensViewBehavior(lens: LensMode, mode: LensViewMode): string {
  return lensUx(lens).visualBehavior[mode] ?? lensUx(lens).shortPurpose;
}
