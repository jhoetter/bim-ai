import type { Element } from '@bim-ai/core';

import type { DiagnosticUiSchedulingPolicy } from './diagnosticSchedulingPolicy';
import type { ElementRenderFeatureStatus } from './elementRenderFeatureStatus';

export type RendererDiagnosticSeverity = 'error' | 'warning' | 'info';

export type RendererDiagnosticIssueClass =
  | 'model-invalid'
  | 'renderer-unsupported'
  | 'renderer-failed'
  | 'renderer-degraded';

export type RendererArea =
  | 'viewport-3d'
  | 'plan'
  | 'section'
  | 'sheet'
  | 'export'
  | 'boolean-cut'
  | 'materials'
  | 'family-runtime';

export type RendererDiagnosticFeature =
  | 'wall-cut'
  | 'roof-opening'
  | 'slab-opening'
  | 'dormer-cut'
  | 'stair-geometry'
  | 'railing-geometry'
  | 'room-visualization'
  | 'family-instance'
  | 'asset-instance'
  | 'material-resolution'
  | 'plan-projection'
  | 'section-projection'
  | 'sheet-viewport'
  | 'export-preview'
  | 'renderer-performance';

export type RendererDiagnosticEvidence = {
  modelRevision?: number | string | null;
  gitHead?: string | null;
  rendererBuild?: string | null;
  supportMatrixDigest?: string | null;
  screenshotPath?: string | null;
  artifactPath?: string | null;
  commandId?: string | null;
  sourceCommandId?: string | null;
  sourceRecipeRow?: string | null;
  agentWave?: string | null;
  commit?: string | null;
  phasePacketId?: string | null;
  source?: 'viewport' | 'plan' | 'sheet' | 'export' | 'sketch-acceptance' | 'test';
  details?: Record<string, string | number | boolean | null>;
};

export type RendererDiagnostic = {
  format: 'rendererDiagnostic_v1';
  ruleId: string;
  code: string;
  severity: RendererDiagnosticSeverity;
  issueClass: RendererDiagnosticIssueClass;
  rendererArea: RendererArea;
  feature: RendererDiagnosticFeature;
  message: string;
  elementIds: string[];
  viewId?: string | null;
  evidence?: RendererDiagnosticEvidence;
  trackerItems: string[];
};

export type RendererDiagnosticInput = Omit<
  RendererDiagnostic,
  'format' | 'elementIds' | 'trackerItems'
> & {
  elementIds?: string | string[] | null;
  trackerItems?: string | string[] | null;
};

export type RendererDiagnosticPacket = {
  format: 'rendererDiagnosticPacket_v1';
  generatedAtIso: string;
  modelRevision?: number | string | null;
  viewId?: string | null;
  gitHead?: string | null;
  rendererBuild?: string | null;
  supportMatrixDigest: string;
  diagnostics: RendererDiagnostic[];
  elementRenderStatuses?: ElementRenderFeatureStatus[];
  diagnosticSchedulingPolicy?: DiagnosticUiSchedulingPolicy;
};

export type RendererSurfaceSupport = 'supported' | 'partial' | 'unsupported' | 'not_applicable';

export type RendererSupportMatrixEntry = {
  id: string;
  elementKind: Element['kind'] | 'door/window' | 'view' | 'export_artifact';
  feature: RendererDiagnosticFeature;
  surface: {
    viewport3d: RendererSurfaceSupport;
    plan: RendererSurfaceSupport;
    section: RendererSurfaceSupport;
    sheet: RendererSurfaceSupport;
    export: RendererSurfaceSupport;
  };
  rendererAreas: RendererArea[];
  diagnosticCodes: string[];
  limitations: string[];
  trackerItems: string[];
};

function asArray(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry) => entry.trim().length > 0);
  }
  return value && value.trim().length > 0 ? [value] : [];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function createRendererDiagnostic(input: RendererDiagnosticInput): RendererDiagnostic {
  return {
    ...input,
    format: 'rendererDiagnostic_v1',
    elementIds: uniqueSorted(asArray(input.elementIds)),
    trackerItems: uniqueSorted(asArray(input.trackerItems)),
  };
}

export function createUnsupportedCutDiagnostic(input: {
  code: string;
  feature: Extract<
    RendererDiagnosticFeature,
    'wall-cut' | 'roof-opening' | 'slab-opening' | 'dormer-cut'
  >;
  rendererArea?: RendererArea;
  message: string;
  elementIds?: string | string[] | null;
  viewId?: string | null;
  evidence?: RendererDiagnosticEvidence;
  trackerItems?: string | string[] | null;
}): RendererDiagnostic {
  return createRendererDiagnostic({
    ruleId: 'renderer_unsupported_cut',
    code: input.code,
    severity: 'error',
    issueClass: 'renderer-unsupported',
    rendererArea: input.rendererArea ?? 'boolean-cut',
    feature: input.feature,
    message: input.message,
    elementIds: input.elementIds,
    viewId: input.viewId,
    evidence: input.evidence,
    trackerItems: input.trackerItems ?? ['BIR-I02', 'BIR-I07'],
  });
}

export function isRendererIssue(diagnostic: RendererDiagnostic): boolean {
  return diagnostic.issueClass !== 'model-invalid';
}

export function isModelInvalidIssue(diagnostic: RendererDiagnostic): boolean {
  return diagnostic.issueClass === 'model-invalid';
}

export function summarizeRendererDiagnostics(diagnostics: RendererDiagnostic[]): {
  total: number;
  bySeverity: Record<RendererDiagnosticSeverity, number>;
  byIssueClass: Record<RendererDiagnosticIssueClass, number>;
  rendererIssues: number;
  modelInvalidIssues: number;
} {
  const bySeverity: Record<RendererDiagnosticSeverity, number> = {
    error: 0,
    warning: 0,
    info: 0,
  };
  const byIssueClass: Record<RendererDiagnosticIssueClass, number> = {
    'model-invalid': 0,
    'renderer-unsupported': 0,
    'renderer-failed': 0,
    'renderer-degraded': 0,
  };
  for (const diagnostic of diagnostics) {
    bySeverity[diagnostic.severity] += 1;
    byIssueClass[diagnostic.issueClass] += 1;
  }
  return {
    total: diagnostics.length,
    bySeverity,
    byIssueClass,
    rendererIssues: diagnostics.filter(isRendererIssue).length,
    modelInvalidIssues: diagnostics.filter(isModelInvalidIssue).length,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(',')}}`;
}

export function rendererSupportMatrixDigest(
  entries: RendererSupportMatrixEntry[] = RENDERER_SUPPORT_MATRIX,
): string {
  let hash = 5381;
  const text = stableStringify(entries);
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33) ^ text.charCodeAt(index);
  }
  return `rsm-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createRendererDiagnosticPacket(input: {
  diagnostics: RendererDiagnostic[];
  elementRenderStatuses?: ElementRenderFeatureStatus[];
  generatedAtIso: string;
  modelRevision?: number | string | null;
  viewId?: string | null;
  gitHead?: string | null;
  rendererBuild?: string | null;
  supportMatrixDigest?: string | null;
  diagnosticSchedulingPolicy?: DiagnosticUiSchedulingPolicy;
}): RendererDiagnosticPacket {
  return {
    format: 'rendererDiagnosticPacket_v1',
    generatedAtIso: input.generatedAtIso,
    modelRevision: input.modelRevision,
    viewId: input.viewId,
    gitHead: input.gitHead,
    rendererBuild: input.rendererBuild,
    supportMatrixDigest: input.supportMatrixDigest ?? rendererSupportMatrixDigest(),
    diagnostics: input.diagnostics,
    elementRenderStatuses: input.elementRenderStatuses,
    diagnosticSchedulingPolicy: input.diagnosticSchedulingPolicy,
  };
}

export const RENDERER_SUPPORT_MATRIX: RendererSupportMatrixEntry[] = [
  {
    id: 'rsm-wall-base',
    elementKind: 'wall',
    feature: 'wall-cut',
    surface: {
      viewport3d: 'partial',
      plan: 'supported',
      section: 'partial',
      sheet: 'partial',
      export: 'partial',
    },
    rendererAreas: ['viewport-3d', 'boolean-cut', 'plan', 'section', 'sheet', 'export'],
    diagnosticCodes: [
      'renderer.wall_geometry.degenerate',
      'renderer.wall_geometry.unsupported',
      'renderer.wall_cut.unsupported',
      'renderer.wall_cut.failed',
    ],
    limitations: [
      'Hosted door/window/opening cuts must report diagnostics when CSG or fallback paths cannot cut the wall.',
      'Joined, sloped, profiled, and very short walls need explicit per-case coverage.',
    ],
    trackerItems: ['BIR-I01', 'BIR-I02', 'BIR-I07', 'BIR-J01'],
  },
  {
    id: 'rsm-door-window-hosted',
    elementKind: 'door/window',
    feature: 'wall-cut',
    surface: {
      viewport3d: 'partial',
      plan: 'supported',
      section: 'partial',
      sheet: 'partial',
      export: 'partial',
    },
    rendererAreas: ['viewport-3d', 'boolean-cut', 'plan', 'section', 'sheet', 'export'],
    diagnosticCodes: [
      'renderer.hosted_opening.detached_proxy',
      'renderer.hosted_opening.no_cut',
      'renderer.wall_cut.unsupported',
    ],
    limitations: [
      'A visible family proxy is not enough; the host cut must also be rendered or diagnosed.',
      'Model-invalid hosting belongs to Advisor/model integrity; renderer-invalid cut failure belongs here.',
    ],
    trackerItems: ['BIR-I01', 'BIR-I02', 'BIR-I07', 'BIR-J01', 'BIR-J05'],
  },
  {
    id: 'rsm-roof-openings',
    elementKind: 'roof',
    feature: 'roof-opening',
    surface: {
      viewport3d: 'partial',
      plan: 'partial',
      section: 'partial',
      sheet: 'partial',
      export: 'partial',
    },
    rendererAreas: ['viewport-3d', 'boolean-cut', 'plan', 'section', 'sheet', 'export'],
    diagnosticCodes: [
      'renderer.roof_geometry.unsupported',
      'renderer.roof_opening.unsupported',
      'renderer.roof_opening.failed_cut',
    ],
    limitations: [
      'Flat, gable, asymmetric gable, hip-like, terrace/court, dormer, fascia, and return cases need separate golden coverage.',
      'Fallback CSG failure must not silently render an uncut roof for sketch acceptance evidence.',
    ],
    trackerItems: ['BIR-I01', 'BIR-I02', 'BIR-I06', 'BIR-I07', 'BIR-J02'],
  },
  {
    id: 'rsm-slab-openings',
    elementKind: 'floor',
    feature: 'slab-opening',
    surface: {
      viewport3d: 'partial',
      plan: 'partial',
      section: 'partial',
      sheet: 'partial',
      export: 'partial',
    },
    rendererAreas: ['viewport-3d', 'boolean-cut', 'plan', 'section', 'sheet', 'export'],
    diagnosticCodes: ['renderer.slab_opening.unsupported', 'renderer.slab_opening.failed_cut'],
    limitations: [
      'Shafts, stair penetrations, balconies, terraces, and stacked floors need explicit support declarations.',
      'Unsupported voids must be persisted with affected floor/opening ids.',
    ],
    trackerItems: ['BIR-I01', 'BIR-I02', 'BIR-I06', 'BIR-I07', 'BIR-J03'],
  },
  {
    id: 'rsm-stairs',
    elementKind: 'stair',
    feature: 'stair-geometry',
    surface: {
      viewport3d: 'partial',
      plan: 'partial',
      section: 'partial',
      sheet: 'partial',
      export: 'partial',
    },
    rendererAreas: ['viewport-3d', 'plan', 'section', 'sheet', 'export'],
    diagnosticCodes: [
      'renderer.stair_geometry.degraded',
      'renderer.stair_geometry.unsupported',
      'renderer.stair_geometry.unsupported_shape',
    ],
    limitations: [
      'Runs, landings, winding segments, shafts, handrails, and headroom evidence need separate coverage.',
    ],
    trackerItems: ['BIR-I01', 'BIR-I02', 'BIR-I06', 'BIR-I07', 'BIR-J04'],
  },
  {
    id: 'rsm-railings',
    elementKind: 'railing',
    feature: 'railing-geometry',
    surface: {
      viewport3d: 'partial',
      plan: 'partial',
      section: 'partial',
      sheet: 'partial',
      export: 'partial',
    },
    rendererAreas: ['viewport-3d', 'plan', 'section', 'sheet', 'export', 'materials'],
    diagnosticCodes: [
      'renderer.railing_geometry.degraded',
      'renderer.railing_geometry.unsupported',
      'renderer.railing_geometry.unsupported_baluster_pattern',
      'renderer.railing_geometry.missing_host_edge',
    ],
    limitations: [
      'Guard, handrail, baluster spacing, hosted edge, and material-slot fidelity need explicit diagnostics.',
    ],
    trackerItems: ['BIR-I01', 'BIR-I02', 'BIR-I06', 'BIR-I07', 'BIR-J04'],
  },
  {
    id: 'rsm-rooms-spaces',
    elementKind: 'room',
    feature: 'room-visualization',
    surface: {
      viewport3d: 'partial',
      plan: 'supported',
      section: 'partial',
      sheet: 'partial',
      export: 'partial',
    },
    rendererAreas: ['viewport-3d', 'plan', 'section', 'sheet', 'export'],
    diagnosticCodes: [
      'renderer.room_visualization.degenerate_outline',
      'renderer.room_visualization.volume_unsupported',
      'renderer.room_visualization.unsupported',
      'renderer.room_separation.degenerate_segment',
    ],
    limitations: [
      'Room/space volumes and boundary overlays must remain diagnostic overlays, not physical clutter.',
      'Room separation lines are analytical boundary evidence and must diagnose missing levels or dropped segments.',
    ],
    trackerItems: ['BIR-I01', 'BIR-I06', 'BIR-I07', 'BIR-J06'],
  },
  {
    id: 'rsm-families-assets',
    elementKind: 'family_instance',
    feature: 'family-instance',
    surface: {
      viewport3d: 'partial',
      plan: 'partial',
      section: 'partial',
      sheet: 'partial',
      export: 'partial',
    },
    rendererAreas: ['viewport-3d', 'plan', 'section', 'sheet', 'export', 'family-runtime'],
    diagnosticCodes: [
      'renderer.family_instance.proxy_fallback',
      'renderer.family_instance.unsupported',
    ],
    limitations: [
      'Family geometry, nested components, visibility/detail levels, host offsets, and material slots need per-family diagnostics.',
    ],
    trackerItems: ['BIR-I01', 'BIR-I06', 'BIR-I07', 'BIR-J05'],
  },
  {
    id: 'rsm-placed-assets',
    elementKind: 'placed_asset',
    feature: 'asset-instance',
    surface: {
      viewport3d: 'partial',
      plan: 'partial',
      section: 'partial',
      sheet: 'partial',
      export: 'partial',
    },
    rendererAreas: ['viewport-3d', 'plan', 'section', 'sheet', 'export', 'family-runtime'],
    diagnosticCodes: [
      'renderer.asset_instance.proxy_fallback',
      'renderer.asset_instance.unsupported',
    ],
    limitations: [
      'Placed assets must declare a render proxy or loaded-family path; missing assets cannot silently render as generic boxes.',
      'Target-house furniture and fixture markers are evidence features, so unsupported asset proxies must be surfaced deterministically.',
    ],
    trackerItems: ['BIR-I01', 'BIR-I02', 'BIR-I05', 'BIR-I06', 'BIR-J05'],
  },
  {
    id: 'rsm-materials',
    elementKind: 'material',
    feature: 'material-resolution',
    surface: {
      viewport3d: 'partial',
      plan: 'partial',
      section: 'partial',
      sheet: 'partial',
      export: 'partial',
    },
    rendererAreas: ['viewport-3d', 'plan', 'section', 'sheet', 'export', 'materials'],
    diagnosticCodes: ['renderer.material.unresolved', 'renderer.material.fallback'],
    limitations: [
      'Type-layer, instance, face override, transparent, realistic, wire, cut face, and export material drift need explicit reporting.',
    ],
    trackerItems: ['BIR-I01', 'BIR-I06', 'BIR-I07', 'BIR-J07'],
  },
  {
    id: 'rsm-plan-section-sheet',
    elementKind: 'view',
    feature: 'sheet-viewport',
    surface: {
      viewport3d: 'not_applicable',
      plan: 'partial',
      section: 'partial',
      sheet: 'partial',
      export: 'partial',
    },
    rendererAreas: ['plan', 'section', 'sheet', 'export'],
    diagnosticCodes: ['renderer.view_projection.degraded', 'renderer.sheet_viewport.unsupported'],
    limitations: [
      'Plan, section, elevation, sheet viewport, hidden line, realistic, wire, and print/export parity need separate acceptance.',
    ],
    trackerItems: ['BIR-I01', 'BIR-I06', 'BIR-I07', 'BIR-J08'],
  },
  {
    id: 'rsm-export-preview',
    elementKind: 'export_artifact',
    feature: 'export-preview',
    surface: {
      viewport3d: 'not_applicable',
      plan: 'not_applicable',
      section: 'not_applicable',
      sheet: 'partial',
      export: 'partial',
    },
    rendererAreas: ['sheet', 'export'],
    diagnosticCodes: ['renderer.export_preview.drift', 'renderer.export_preview.unsupported'],
    limitations: [
      'Viewport support does not prove IFC/glTF/DXF/DWG fidelity; export/readback must record drift separately.',
    ],
    trackerItems: ['BIR-I01', 'BIR-I06', 'BIR-I07'],
  },
];

function supportLabel(status: RendererSurfaceSupport): string {
  return status.replace('_', ' ');
}

export function renderRendererSupportMatrixMarkdown(
  entries: RendererSupportMatrixEntry[] = RENDERER_SUPPORT_MATRIX,
): string {
  const digest = rendererSupportMatrixDigest(entries);
  const rows = entries.map((entry) =>
    [
      `\`${entry.id}\``,
      `\`${entry.elementKind}\``,
      entry.feature,
      supportLabel(entry.surface.viewport3d),
      supportLabel(entry.surface.plan),
      supportLabel(entry.surface.section),
      supportLabel(entry.surface.sheet),
      supportLabel(entry.surface.export),
      entry.diagnosticCodes.map((code) => `\`${code}\``).join('<br>'),
      entry.trackerItems.map((item) => `\`${item}\``).join(', '),
      entry.limitations.join('<br>'),
    ].join(' | '),
  );

  return [
    '# Renderer Support Matrix',
    '',
    `Generated from \`packages/web/src/viewport/rendererDiagnostics.ts\`. Digest: \`${digest}\`.`,
    '',
    'This matrix is the initial BIR-I01 renderer contract. It states whether a semantic model feature is expected to render, export, or produce a structured renderer diagnostic instead of failing silently.',
    '',
    '| ID | Element kind | Feature | 3D viewport | Plan | Section | Sheet | Export | Diagnostic codes | Tracker items | Known limitations |',
    '| -- | ------------ | ------- | ----------- | ---- | ------- | ----- | ------ | ---------------- | ------------- | ----------------- |',
    ...rows.map((row) => `| ${row} |`),
    '',
    'Issue classes:',
    '',
    '- `model-invalid`: the semantic model is bad and belongs to Advisor/model integrity.',
    '- `renderer-unsupported`: the model can be valid, but the renderer has no supported path.',
    '- `renderer-failed`: a supported renderer path was attempted and failed.',
    '- `renderer-degraded`: the renderer produced an intentional approximation that must be recorded in evidence.',
    '',
  ].join('\n');
}
