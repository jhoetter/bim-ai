export const SURFACE_EXECUTION_STATUSES = new Set([
  'executable',
  'contract-only',
  'CLI-only',
  'skill-local',
]);

export const CLI_ONLY_DESCRIPTOR_IDS = new Set(['sketch.seed.compile', 'sketch.phase.apply']);

export const READINESS_ADJACENT_SURFACES = [
  {
    id: 'evidence.package',
    stableId: 'evidence.package',
    surfaceStatus: 'executable',
    canonicalTransport:
      'GET /api/models/{model_id}/evidence-package; CLI `bim-ai evidence-package`',
    path: '/api/models/{model_id}/evidence-package',
    notes:
      'Backend route-backed evidence package. It does not replace live screenshots or phase acceptance.',
    source: 'app/bim_ai/routes_api.py',
  },
  {
    id: 'sketch.evidence.collect',
    stableId: 'sketch.evidence.collect',
    surfaceStatus: 'CLI-only',
    canonicalTransport: 'CLI `bim-ai initiation-run`',
    path: 'none',
    notes:
      'Collects snapshot, validate, evidence package, Advisor warning/info, stats, and optional screenshot artifacts. No dedicated API/MCP descriptor yet.',
    source: 'packages/cli/cli.mjs',
  },
  {
    id: 'browser-evidence',
    stableId: 'browser-evidence',
    surfaceStatus: 'skill-local',
    canonicalTransport: 'Skill-local browser automation only',
    path: 'none',
    notes:
      'Allowed for UI-equivalence and screenshot capture; not a public product authoring surface.',
    source: 'claude-skills/sketch-to-bim',
  },
];

export const SKB_B08_REQUIRED_RESOURCES = [
  {
    id: 'snapshot',
    acceptedIds: ['model.show', 'model-show'],
    requiredRoute: 'GET /api/models/{model_id}/snapshot',
  },
  {
    id: 'summary',
    acceptedIds: ['model.summary', 'model-show'],
    requiredRoute: 'GET /api/models/{model_id}/summary',
  },
  {
    id: 'levels',
    acceptedIds: ['query.levels'],
    requiredRoute: 'POST /api/models/{model_id}/query/levels',
  },
  {
    id: 'views',
    acceptedIds: ['query.views'],
    requiredRoute: 'POST /api/models/{model_id}/query/views',
  },
  {
    id: 'types',
    acceptedIds: ['query.types'],
    requiredRoute: 'POST /api/models/{model_id}/query/types',
  },
  {
    id: 'elements',
    acceptedIds: ['query.elements'],
    requiredRoute: 'POST /api/models/{model_id}/query/elements',
  },
  {
    id: 'advisor',
    acceptedIds: ['qa.advisor'],
    requiredRoute: 'POST /api/models/{model_id}/qa/advisor',
  },
  {
    id: 'command-log',
    acceptedIds: ['model.command_log'],
    requiredRoute: 'GET /api/models/{model_id}/command-log',
  },
  {
    id: 'evidence-package',
    acceptedIds: ['evidence.package'],
    requiredRoute: 'GET /api/models/{model_id}/evidence-package',
  },
];

export const SKB_B09_COMMAND_SCHEMA_SURFACES = [
  {
    id: 'schema-catalog',
    acceptedIds: ['commands.schema.catalog'],
    requiredRoute: 'GET /api/v3/commands',
  },
  {
    id: 'schema-inspect',
    acceptedIds: ['commands.schema.inspect'],
    requiredRoute: 'GET /api/v3/commands/{name}',
  },
];

export const SKB_B10_REQUIRED_QUERY_RESOLVE = [
  'query.elements',
  'query.hosts',
  'query.levels',
  'query.types',
  'query.views',
  'query.nearest_wall',
  'query.enclosed_loops',
  'resolve.active_or_default_level',
  'resolve.default_plan_view',
  'resolve.wall_by_line',
  'resolve.host_face',
  'resolve.family_type',
  'resolve.room_boundary',
  'resolve.loop_for_boundary',
];

export const SOURCES = {
  commands: 'app/bim_ai/commands.py',
  commandSchemas: 'app/bim_ai/command_schemas.py',
  apiRegistry: 'app/bim_ai/api/registry.py',
  apiRoutesGlob: 'app/bim_ai/routes_*.py',
  cmdk: 'packages/web/src/cmdPalette/defaultCommands.ts',
  capabilities: 'packages/web/src/workspace/commandCapabilities.ts',
  toolRegistry: 'packages/web/src/tools/toolRegistry.ts',
  seedDsl: 'packages/cli/lib/seed-dsl.mjs',
  queryResolve: 'app/bim_ai/query_resolve.py',
  semanticAuthoring: 'app/bim_ai/semantic_authoring.py',
  benchmarkRoot: 'spec/benchmarks',
};

export const M2_FIRST_PACK_TOOLS = [
  'model.show',
  'model.dry_run',
  'model.commit_bundle',
  'query.elements',
  'query.hosts',
  'query.levels',
  'query.types',
  'query.views',
  'query.nearest_wall',
  'query.enclosed_loops',
  'resolve.active_or_default_level',
  'resolve.wall_by_line',
  'resolve.room_boundary',
  'resolve.host_face',
  'resolve.family_type',
  'author.wall',
  'author.wall_chain',
  'author.floor_from_boundary',
  'author.floor_from_walls',
  'opening.door_on_wall',
  'opening.window_on_wall',
  'author.roof_from_walls',
  'opening.roof_opening',
  'author.stair_between_levels',
  'author.rooms_from_outlines',
  'view.save_3d',
  'document.sheet_with_views',
  'qa.advisor',
];

export const M2_WAVE2_TOOLS = [
  'model.dry_run',
  'model.commit_bundle',
  'query.nearest_wall',
  'author.wall',
  'opening.roof_opening',
  'view.save_3d',
  'qa.advisor',
];

export const M2_CLOSURE_GATES = [
  {
    id: 'firstPackSurfaces',
    label: 'First-pack surfaces',
    blocker: 'M2 first-pack surfaces are not all present.',
  },
  {
    id: 'liveDryRunEvidence',
    label: 'Live dry-run evidence',
    blocker: 'No clean live typed dry-run benchmark evidence was detected.',
  },
  {
    id: 'liveCommitEvidence',
    label: 'Live commit evidence',
    blocker: 'No live typed commit benchmark evidence was detected.',
  },
  {
    id: 'committedAdvisorValidation',
    label: 'Committed advisor/validation',
    blocker: 'No committed-model advisor or validation evidence was detected.',
  },
  {
    id: 'visualRenderEvidence',
    label: 'Visual/render evidence',
    blocker: 'No nonblank visual/render evidence was detected.',
  },
  {
    id: 'exportEvidence',
    label: 'Export evidence',
    blocker: 'No export artifact or manifest evidence was detected.',
  },
  {
    id: 'uiEquivalentPath',
    label: 'UI-equivalent path',
    blocker: 'No executable or validated UI/Cmd+K equivalent path was detected.',
  },
];

export const BENCHMARK_COMMAND_TOOL_MARKERS = new Map([
  ['createWall', ['author.wall']],
  ['createWallChain', ['author.wall_chain']],
  ['createRoofOpening', ['opening.roof_opening']],
  ['saveViewpoint', ['view.save_3d']],
]);

export const EVIDENCE_ARTIFACT_FILE_RE =
  /(^|\/)(benchmark-result|execution-evidence|live-dry-run-evidence|live-commit-evidence|committed-evidence|advisor-validation|visual-evidence|render-evidence|screenshot-evidence|export-evidence|ui-cmdk-traceability|ui-equivalence|ui-equivalent|ui-validated-replay|semantic-diff)[^/]*\.json$/i;

export const BLOCKING_EVIDENCE_STATUS_RE =
  /todo|placeholder|optional|capable|expected|required|requires|missing|none|unknown|declared|fixture|traceability-only|documentation-only|docs-only|opt[-_\s]?in|stale|expired|failed|failure|error|unavailable|invalid|blank|not[-_\s]?requested|non[-_\s]?executable|skipped|deferred|stub|mock/i;

export const POSITIVE_EVIDENCE_STATUS_RE =
  /live|validated|passing|passed|clean|committed|executable|nonblank|artifact|manifest|done|server-side-substitute/i;

export const SIMPLE_HOUSE_MIN_SEMANTIC_COUNTS = {
  walls: 6,
  openings: 6,
  floors: 1,
  roofs: 1,
};

export const M3_WORKSTREAMS = {
  sketch: 'M3-A sketch-to-BIM productization',
  export: 'M3-B documentation/export first-class pack',
  benchmark: 'M3-C benchmark parity expansion',
  transaction: 'M3-D transaction/audit hardening',
  governance: 'M3-E parity governance',
  later: 'post-M3 expert/raw backlog',
};

export const M3_WAVE2_WORKSTREAMS = [
  {
    id: 'M3-F',
    label: 'Sketch IR, seed, and phase product tools',
    requiredSurfaces: [
      'sketch.ir.validate',
      'sketch.seed.compile',
      'sketch.phase.apply',
      'sketch.phase.accept',
    ],
  },
  {
    id: 'M3-G',
    label: 'Two-storey stair benchmark executable path',
    scenarioId: 'two-storey-house-with-stair',
  },
  {
    id: 'M3-H',
    label: 'Documentation/export production evidence depth',
    requiredDescriptors: [
      'document.create_drawing_set',
      'create-schedule-view',
      'export.pdf',
      'export.ifc',
      'export.gltf',
      'export.glb',
    ],
  },
  {
    id: 'M3-I',
    label: 'Transaction idempotency and workflow metadata',
  },
];

export const M3_WAVE3_WORKSTREAMS = [
  {
    id: 'M3-K',
    label: 'Typed vertical-circulation MCP tools',
    requiredSurfaceGroups: [
      {
        id: 'typed-stair-authoring',
        label: 'Typed stair-between-levels authoring',
        acceptedStableIds: ['author.stair_between_levels', 'create_stair_between_levels'],
        rawFallbackCommands: ['createStair'],
      },
      {
        id: 'typed-stair-opening-authoring',
        label: 'Typed stair or shaft opening authoring',
        acceptedStableIds: [
          'opening.slab_opening',
          'opening.shaft_opening',
          'opening.shaft',
          'opening.floor_opening',
          'create_floor_opening',
          'create_slab_opening',
        ],
        rawFallbackCommands: ['createSlabOpening'],
      },
      {
        id: 'typed-railing-authoring',
        label: 'Typed railing authoring',
        acceptedStableIds: ['author.railing', 'create_railing'],
        rawFallbackCommands: ['createRailing'],
      },
    ],
  },
  {
    id: 'M3-L',
    label: 'Two-storey live advisor, visual, and export evidence',
    scenarioId: 'two-storey-house-with-stair',
  },
  {
    id: 'M3-M',
    label: 'Two-storey UI and Cmd+K executable equivalence',
    scenarioId: 'two-storey-house-with-stair',
  },
  {
    id: 'M3-N',
    label: 'Documentation/export clean artifact closure',
  },
  {
    id: 'M3-O',
    label: 'Idempotency, stale revision, and workflow evidence closure',
  },
  {
    id: 'M3-P',
    label: 'Wave 3 audit, verifier, and tracker finalization',
  },
];

export const M4_WAVE1_WORKSTREAMS = [
  {
    id: 'M4-A',
    label: 'Site/context first-class MCP pack',
    domain: 'site-context',
    scenarioIds: ['site-and-context-house'],
    requiredSurfaceGroups: [
      {
        id: 'toposolid-authoring',
        label: 'Toposolid create/update authoring',
        acceptedStableIds: [
          'toposolid-create',
          'toposolid-update',
          'create-toposolid-subdivision',
          'site.toposolid-subdivision-update',
          'site.toposolid-excavation-create',
        ],
      },
      {
        id: 'grading-property-line-georeference',
        label: 'Grading, property line, and georeference tools',
        acceptedStableIds: [
          'create-graded-region',
          'site.setup-georeference',
          'site.graded-region-update',
          'site.property-line-create',
          'site.project-base-point-create',
          'site.survey-point-create',
          'site.sun-settings-create',
          'import-neighborhood',
        ],
      },
    ],
  },
  {
    id: 'M4-B',
    label: 'Structure and construction-lite MCP pack',
    domain: 'structure-construction',
    scenarioIds: ['structure-and-mep-lite'],
    requiredSurfaceGroups: [
      {
        id: 'structural-authoring',
        label: 'Structural column and beam authoring',
        acceptedStableIds: ['structure.column', 'structure.beam', 'structure.column_update'],
      },
      {
        id: 'construction-lite',
        label: 'Construction package, logistics, and checklist tools',
        acceptedStableIds: [
          'construction.package',
          'construction.logistics',
          'construction.qa_checklist',
        ],
      },
    ],
  },
  {
    id: 'M4-C',
    label: 'MEP-lite MCP pack',
    domain: 'mep-lite',
    scenarioIds: ['structure-and-mep-lite'],
    requiredSurfaceGroups: [
      {
        id: 'mep-route-authoring',
        label: 'Pipe, duct, and cable route authoring',
        acceptedStableIds: ['mep.pipe_route', 'mep.duct_route', 'mep.cable_tray'],
      },
      {
        id: 'mep-equipment-fixtures-openings',
        label: 'MEP equipment, fixtures, terminals, and opening requests',
        acceptedStableIds: ['mep.equipment', 'mep.fixture', 'mep.terminal', 'mep.opening_request'],
      },
    ],
  },
  {
    id: 'M4-D',
    label: 'Families, assets, materials, decals pack',
    domain: 'families-assets-materials',
    scenarioIds: ['families-assets-materials'],
    requiredSurfaceGroups: [
      {
        id: 'family-asset-catalog',
        label: 'Family type upsert, catalog query, and asset placement',
        acceptedStableIds: [
          'family.upsert_type',
          'family.place_instance',
          'asset.query',
          'asset.place',
          'place-kitchen-kit',
        ],
      },
      {
        id: 'material-decal-authoring',
        label: 'PBR material update, assignment, paint, and decals',
        acceptedStableIds: [
          'material.upsert_pbr',
          'material.assign',
          'material.paint_face',
          'decal.create',
        ],
      },
    ],
  },
  {
    id: 'M4-E',
    label: 'Presentation, branded export, and advanced docs',
    domain: 'presentation-advanced-docs',
    scenarioIds: ['documentation-pack', 'presentation-pack'],
    requiredSurfaceGroups: [
      {
        id: 'presentation-pack',
        label: 'Presentation frames, branded templates, render bundle, and share/export',
        acceptedStableIds: [
          'presentation-documentation-pack',
          'create-frame',
          'create-brand-template',
          'export-render-bundle',
          'presentation-create',
          'export-presentation',
        ],
      },
      {
        id: 'advanced-documentation',
        label: 'Advanced sheets, schedules, revisions, and documentation exports',
        acceptedStableIds: [
          'document.create_drawing_set',
          'create-schedule-view',
          'presentation-documentation-pack',
          'export-branded-pdf',
        ],
      },
    ],
  },
];

export const M4_DYNAMIC_DESCRIPTOR_IDS = new Set(
  M4_WAVE1_WORKSTREAMS.flatMap((workstream) =>
    workstream.requiredSurfaceGroups.flatMap((group) => group.acceptedStableIds),
  ),
);
