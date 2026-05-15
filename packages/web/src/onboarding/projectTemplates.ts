export type ProjectTemplateCommand =
  | { type: 'createLevel'; id: string; name: string; elevationMm: number; alsoCreatePlanView?: boolean }
  | { type: 'createPhase'; id: string; name: string; ord: number };

export type ProjectTemplate = {
  id: string;
  name: string;
  description: string;
  commands: ProjectTemplateCommand[];
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Single level, basic setup.',
    commands: [
      { type: 'createLevel', id: 'level-eg', name: 'EG', elevationMm: 0, alsoCreatePlanView: true },
      { type: 'createPhase', id: 'phase-new', name: 'Neubau', ord: 0 },
    ],
  },
  {
    id: 'residential',
    name: 'Wohnbau (BIM Architektur)',
    description: '4 levels, full phase set (Bestand/Abriss/Neubau), standard wall types.',
    commands: [
      { type: 'createLevel', id: 'level-eg', name: 'EG', elevationMm: 0, alsoCreatePlanView: true },
      { type: 'createLevel', id: 'level-og1', name: 'OG 1', elevationMm: 3000, alsoCreatePlanView: true },
      { type: 'createLevel', id: 'level-og2', name: 'OG 2', elevationMm: 6000, alsoCreatePlanView: true },
      { type: 'createLevel', id: 'level-dach', name: 'Dach', elevationMm: 9000, alsoCreatePlanView: true },
      { type: 'createPhase', id: 'phase-existing', name: 'Bestand', ord: 0 },
      { type: 'createPhase', id: 'phase-demo', name: 'Abriss', ord: 1 },
      { type: 'createPhase', id: 'phase-new', name: 'Neubau', ord: 2 },
    ],
  },
  {
    id: 'commercial',
    name: 'Gewerbebau (BIM Architektur & Ingenieurbau)',
    description: 'Multi-level commercial building, MEP-ready.',
    commands: [
      { type: 'createLevel', id: 'level-ug', name: 'UG', elevationMm: -3000, alsoCreatePlanView: true },
      { type: 'createLevel', id: 'level-eg', name: 'EG', elevationMm: 0, alsoCreatePlanView: true },
      { type: 'createLevel', id: 'level-og1', name: 'OG 1', elevationMm: 3600, alsoCreatePlanView: true },
      { type: 'createLevel', id: 'level-og2', name: 'OG 2', elevationMm: 7200, alsoCreatePlanView: true },
      { type: 'createLevel', id: 'level-og3', name: 'OG 3', elevationMm: 10800, alsoCreatePlanView: true },
      { type: 'createPhase', id: 'phase-new', name: 'Neubau', ord: 0 },
    ],
  },
];
