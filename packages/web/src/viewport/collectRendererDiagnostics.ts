import type { Element } from '@bim-ai/core';

import {
  collectElementRenderFeatureStatuses,
  type ElementRenderFeatureStatus,
} from './elementRenderFeatureStatus';
import {
  type RendererDiagnostic,
  type RendererDiagnosticEvidence,
  createRendererDiagnostic,
  createRendererDiagnosticPacket,
  type RendererDiagnosticPacket,
} from './rendererDiagnostics';
import {
  diagnoseRoofOpeningRendering,
  type RoofOpeningRenderDiagnostic,
} from './roofOpeningRenderDiagnostics';
import { diagnoseRoomVisualizationRendering } from './roomVisualizationRenderDiagnostics';
import {
  diagnoseWallHostedCutRenderRisks,
  type WallHostedCutRenderDiagnostic,
} from './wallHostedCutRenderDiagnostics';
import { diagnoseVerticalCirculationRendering } from './verticalCirculationRenderDiagnostics';

export type CollectRendererDiagnosticsInput = {
  elements?: readonly Element[] | Record<string, Element | undefined> | null;
  elementsById?: Record<string, Element | undefined> | null;
  viewId?: string | null;
  evidence?: RendererDiagnosticEvidence;
  csgEnabled?: boolean;
  includeElementRenderStatusDiagnostics?: boolean;
  includeElementRenderStatuses?: boolean;
};

export type CollectRendererDiagnosticsPacketInput = CollectRendererDiagnosticsInput & {
  generatedAtIso: string;
  modelRevision?: number | string | null;
  gitHead?: string | null;
  rendererBuild?: string | null;
  supportMatrixDigest?: string | null;
};

export function collectRendererDiagnostics(
  input: CollectRendererDiagnosticsInput,
): RendererDiagnostic[] {
  const elementsById = normalizeElementsById(input.elementsById ?? input.elements);
  const fullEvidence = {
    ...input.evidence,
    source: input.evidence?.source ?? 'viewport',
  } satisfies RendererDiagnosticEvidence;
  const elementStatuses =
    input.includeElementRenderStatusDiagnostics === false
      ? []
      : collectElementRenderFeatureStatuses({ elementsById });

  return dedupeDiagnostics([
    ...elementStatuses.flatMap((status) =>
      fromElementRenderFeatureStatus(status, input.viewId, fullEvidence),
    ),
    ...diagnoseRoofOpeningRendering(compactElementsById(elementsById)).map((diagnostic) =>
      fromRoofOpeningDiagnostic(diagnostic, input.viewId, fullEvidence),
    ),
    ...diagnoseWallHostedCutRenderRisks({
      elementsById: compactElementsById(elementsById),
      csgEnabled: input.csgEnabled,
    }).map((diagnostic) => fromWallHostedCutDiagnostic(diagnostic, input.viewId, fullEvidence)),
    ...diagnoseRoomVisualizationRendering(elementsById, {
      viewId: input.viewId,
      evidence: fullEvidence,
    }),
    ...diagnoseVerticalCirculationRendering(elementsById, {
      viewId: input.viewId,
      evidence: fullEvidence,
    }),
  ]).sort((a, b) => {
    const severityOrder = severityRank(a.severity) - severityRank(b.severity);
    if (severityOrder !== 0) return severityOrder;
    return `${a.code}:${a.elementIds.join(',')}`.localeCompare(
      `${b.code}:${b.elementIds.join(',')}`,
    );
  });
}

function fromElementRenderFeatureStatus(
  status: ElementRenderFeatureStatus,
  viewId: string | null | undefined,
  evidence: RendererDiagnosticEvidence,
): RendererDiagnostic[] {
  return status.diagnosticCodes.map((code) => {
    const feature = elementStatusFeature(code);
    const issueClass = elementStatusIssueClass(code, status);
    const unsupported = issueClass === 'renderer-unsupported';
    const fallback = code.endsWith('.fallback') || code.endsWith('_fallback');
    return createRendererDiagnostic({
      ruleId: code.replaceAll('.', '_'),
      code,
      severity: elementStatusSeverity(code, issueClass),
      issueClass,
      rendererArea: elementStatusRendererArea(code),
      feature,
      message: elementRenderStatusMessage(status, code),
      elementIds: [status.elementId],
      viewId,
      evidence: {
        ...evidence,
        details: {
          kind: status.kind,
          geometryFeature: status.geometry.feature,
          geometryState: status.geometry.state,
          geometryImplementation: status.geometry.implementation,
          implementation: status.implementation.geometryImplementation,
          materialState: status.material.state,
          familyState: status.family.state,
          assetState: status.asset.state,
          fallback,
          blocking: status.blocking,
          skippedSubfeatureCount: status.skippedSubfeatures.length,
        },
      },
      trackerItems: elementStatusTrackerItems(code),
    });
  });
}

function elementRenderStatusMessage(status: ElementRenderFeatureStatus, code: string): string {
  if (code === 'renderer.wall_geometry.degenerate') {
    return `Wall "${status.elementId}" has degenerate geometry and cannot render a faithful wall body.`;
  }
  if (code === 'renderer.wall_geometry.unsupported') {
    return `Wall "${status.elementId}" declares unsupported renderer geometry.`;
  }
  if (code === 'renderer.wall_cut.unsupported') {
    return `Hosted opening "${status.elementId}" declares an unsupported wall-cut renderer feature.`;
  }
  if (code === 'renderer.roof_geometry.unsupported') {
    return `Roof "${status.elementId}" declares unsupported renderer geometry.`;
  }
  if (code === 'renderer.roof_opening.unsupported') {
    return `Roof opening "${status.elementId}" declares an unsupported roof-cut renderer feature.`;
  }
  if (code === 'renderer.slab_opening.unsupported') {
    return `Slab opening "${status.elementId}" declares an unsupported slab-cut renderer feature.`;
  }
  if (code === 'renderer.stair_geometry.unsupported') {
    return `Stair "${status.elementId}" declares unsupported renderer geometry.`;
  }
  if (code === 'renderer.stair_geometry.unsupported_shape') {
    return `Stair "${status.elementId}" uses a shape outside the renderer support contract.`;
  }
  if (code === 'renderer.railing_geometry.unsupported') {
    return `Railing "${status.elementId}" declares unsupported renderer geometry.`;
  }
  if (code === 'renderer.railing_geometry.unsupported_baluster_pattern') {
    return `Railing "${status.elementId}" uses a baluster pattern outside the renderer support contract.`;
  }
  if (code === 'renderer.railing_geometry.missing_host_edge') {
    return `Railing "${status.elementId}" requires hosted edge evidence that the renderer status cannot resolve.`;
  }
  if (code === 'renderer.room_visualization.volume_unsupported') {
    return `Room "${status.elementId}" requests 3D volume rendering, but only diagnostic overlays are supported.`;
  }
  if (code === 'renderer.room_visualization.unsupported') {
    return `Room visualization "${status.elementId}" declares an unsupported renderer feature.`;
  }
  if (code === 'renderer.material.unresolved') {
    return `Element "${status.elementId}" references material data the renderer cannot resolve.`;
  }
  if (code === 'renderer.material.fallback') {
    return `Element "${status.elementId}" is rendered with fallback material resolution.`;
  }
  if (code === 'renderer.asset_instance.unsupported') {
    return `Placed asset "${status.elementId}" cannot render because its asset proxy is unsupported.`;
  }
  if (code === 'renderer.asset_instance.proxy_fallback') {
    return `Placed asset "${status.elementId}" falls back to proxy geometry.`;
  }
  if (code === 'renderer.family_instance.unsupported') {
    return `Family instance "${status.elementId}" cannot render with loaded family geometry.`;
  }
  return `Family instance "${status.elementId}" falls back to proxy geometry.`;
}

function elementStatusTrackerItems(code: string): string[] {
  if (code.startsWith('renderer.wall_geometry') || code.startsWith('renderer.wall_cut')) {
    return ['BIR-I02', 'BIR-I03', 'BIR-I05', 'BIR-J01'];
  }
  if (code.startsWith('renderer.roof_geometry') || code.startsWith('renderer.roof_opening')) {
    return ['BIR-I02', 'BIR-I03', 'BIR-I05', 'BIR-J02'];
  }
  if (code.startsWith('renderer.slab_opening')) {
    return ['BIR-I02', 'BIR-I03', 'BIR-I05', 'BIR-J03'];
  }
  if (code.startsWith('renderer.stair_geometry')) {
    return ['BIR-I02', 'BIR-I03', 'BIR-I05', 'BIR-J04'];
  }
  if (code.startsWith('renderer.railing_geometry')) {
    return ['BIR-I02', 'BIR-I03', 'BIR-I05', 'BIR-J04'];
  }
  if (code.startsWith('renderer.room_visualization')) {
    return ['BIR-I02', 'BIR-I03', 'BIR-I04', 'BIR-I05', 'BIR-J06'];
  }
  if (code.startsWith('renderer.material')) return ['BIR-I02', 'BIR-I03', 'BIR-I05', 'BIR-J07'];
  if (code.startsWith('renderer.asset_instance')) {
    return ['BIR-I02', 'BIR-I03', 'BIR-I05', 'BIR-J05'];
  }
  return ['BIR-I02', 'BIR-I03', 'BIR-I05', 'BIR-J05'];
}

export function collectRendererDiagnosticPacket(
  input: CollectRendererDiagnosticsPacketInput,
): RendererDiagnosticPacket {
  const elementsById = normalizeElementsById(input.elementsById ?? input.elements);
  const elementRenderStatuses =
    input.includeElementRenderStatuses === false
      ? undefined
      : collectElementRenderFeatureStatuses({ elementsById });
  return createRendererDiagnosticPacket({
    diagnostics: collectRendererDiagnostics({ ...input, elementsById }),
    elementRenderStatuses,
    generatedAtIso: input.generatedAtIso,
    modelRevision: input.modelRevision,
    viewId: input.viewId,
    gitHead: input.gitHead,
    rendererBuild: input.rendererBuild,
    supportMatrixDigest: input.supportMatrixDigest,
  });
}

function elementStatusFeature(code: string): RendererDiagnostic['feature'] {
  if (code.startsWith('renderer.material')) return 'material-resolution';
  if (code.startsWith('renderer.asset_instance')) return 'asset-instance';
  if (code.startsWith('renderer.family_instance')) return 'family-instance';
  if (code.startsWith('renderer.wall_geometry') || code.startsWith('renderer.wall_cut')) {
    return 'wall-cut';
  }
  if (code.startsWith('renderer.roof_geometry') || code.startsWith('renderer.roof_opening')) {
    return 'roof-opening';
  }
  if (code.startsWith('renderer.slab_opening')) return 'slab-opening';
  if (code.startsWith('renderer.stair_geometry')) return 'stair-geometry';
  if (code.startsWith('renderer.railing_geometry')) return 'railing-geometry';
  if (code.startsWith('renderer.room_visualization')) return 'room-visualization';
  return 'family-instance';
}

function elementStatusRendererArea(code: string): RendererDiagnostic['rendererArea'] {
  if (code.startsWith('renderer.material')) return 'materials';
  if (
    code.startsWith('renderer.wall_cut') ||
    code.startsWith('renderer.roof_opening') ||
    code.startsWith('renderer.slab_opening')
  ) {
    return 'boolean-cut';
  }
  if (code === 'renderer.room_visualization.volume_unsupported') return 'viewport-3d';
  if (code.startsWith('renderer.room_visualization')) return 'plan';
  return 'viewport-3d';
}

function elementStatusIssueClass(
  code: string,
  status: ElementRenderFeatureStatus,
): RendererDiagnostic['issueClass'] {
  if (code.endsWith('.degenerate')) return 'model-invalid';
  if (code.includes('.missing_host_edge')) return 'model-invalid';
  if (code.endsWith('.unresolved')) return 'renderer-unsupported';
  if (code === 'renderer.room_visualization.volume_unsupported') return 'renderer-unsupported';
  if (
    code.endsWith('.unsupported') ||
    code.endsWith('_unsupported') ||
    code.endsWith('.unsupported_shape')
  ) {
    return status.blocking ? 'renderer-unsupported' : 'renderer-degraded';
  }
  if (code.endsWith('.unsupported_baluster_pattern')) return 'renderer-unsupported';
  return 'renderer-degraded';
}

function elementStatusSeverity(
  code: string,
  issueClass: RendererDiagnostic['issueClass'],
): RendererDiagnostic['severity'] {
  if (issueClass === 'model-invalid') return 'error';
  if (issueClass === 'renderer-unsupported')
    return code.includes('volume_unsupported') ? 'warning' : 'error';
  return 'warning';
}

function dedupeDiagnostics(diagnostics: RendererDiagnostic[]): RendererDiagnostic[] {
  const byKey = new Map<string, RendererDiagnostic>();
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.code}:${diagnostic.elementIds.join(',')}`;
    const existing = byKey.get(key);
    if (!existing || severityRank(diagnostic.severity) < severityRank(existing.severity)) {
      byKey.set(key, diagnostic);
    }
  }
  return [...byKey.values()];
}

function normalizeElementsById(
  input: readonly Element[] | Record<string, Element | undefined> | null | undefined,
): Record<string, Element | undefined> {
  if (!input) return {};
  if (Array.isArray(input)) {
    return Object.fromEntries(input.map((element) => [element.id, element]));
  }
  return input as Record<string, Element | undefined>;
}

function compactElementsById(
  elementsById: Record<string, Element | undefined>,
): Record<string, Element> {
  return Object.fromEntries(
    Object.entries(elementsById).filter((entry): entry is [string, Element] => !!entry[1]),
  );
}

function fromRoofOpeningDiagnostic(
  diagnostic: RoofOpeningRenderDiagnostic,
  viewId: string | null | undefined,
  evidence: RendererDiagnosticEvidence,
): RendererDiagnostic {
  const modelInvalidRules = new Set([
    'roof_opening_render_missing_host',
    'roof_opening_render_outside_host_footprint',
  ]);
  return createRendererDiagnostic({
    ruleId: diagnostic.ruleId,
    code: roofOpeningCode(diagnostic.ruleId),
    severity: diagnostic.severity,
    issueClass: modelInvalidRules.has(diagnostic.ruleId) ? 'model-invalid' : 'renderer-unsupported',
    rendererArea: 'boolean-cut',
    feature: 'roof-opening',
    message: diagnostic.message,
    elementIds: diagnostic.elementIds,
    viewId,
    evidence: { ...evidence, details: serializableDetails(diagnostic.details) },
    trackerItems: ['BIR-I02', 'BIR-I03', 'BIR-J02'],
  });
}

function fromWallHostedCutDiagnostic(
  diagnostic: WallHostedCutRenderDiagnostic,
  viewId: string | null | undefined,
  evidence: RendererDiagnosticEvidence,
): RendererDiagnostic {
  return createRendererDiagnostic({
    ruleId: `renderer_wall_cut_${diagnostic.code}`,
    code: wallHostedCutCode(diagnostic.code),
    severity: diagnostic.severity,
    issueClass: wallHostedCutIssueClass(diagnostic),
    rendererArea: 'boolean-cut',
    feature: 'wall-cut',
    message: diagnostic.message,
    elementIds: [
      diagnostic.elementId,
      diagnostic.hostWallId,
      ...(diagnostic.relatedElementIds ?? []),
    ].filter((id): id is string => typeof id === 'string' && id.length > 0),
    viewId,
    evidence: { ...evidence, details: serializableDetails(diagnostic.data ?? {}) },
    trackerItems:
      diagnostic.code === 'detached_or_proxy_render_risk'
        ? ['BIR-C08', 'BIR-I02', 'BIR-I03', 'BIR-J01']
        : ['BIR-I02', 'BIR-I03', 'BIR-J01'],
  });
}

function roofOpeningCode(ruleId: RoofOpeningRenderDiagnostic['ruleId']): string {
  const suffix = ruleId.replace(/^roof_opening_render_/, '').replaceAll('_', '.');
  return `renderer.roof_opening.${suffix}`;
}

function wallHostedCutCode(code: WallHostedCutRenderDiagnostic['code']): string {
  return code === 'detached_or_proxy_render_risk'
    ? 'renderer.wall_cut.detached_or_proxy_render_risk'
    : `renderer.wall_cut.${code.replaceAll('_', '.')}`;
}

function wallHostedCutIssueClass(
  diagnostic: WallHostedCutRenderDiagnostic,
): RendererDiagnostic['issueClass'] {
  if (diagnostic.code === 'detached_or_proxy_render_risk') return 'renderer-degraded';
  if (
    diagnostic.code === 'host_cut_disabled_by_element' ||
    diagnostic.code === 'wall_opening_csg_disabled' ||
    diagnostic.code === 'wall_opening_csg_skipped_by_curtain_wall' ||
    diagnostic.code.startsWith('unsupported_')
  ) {
    return 'renderer-unsupported';
  }
  if (diagnostic.severity === 'error') return 'model-invalid';
  return 'renderer-degraded';
}

function serializableDetails(
  details: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
      ) {
        return [key, value];
      }
      return [key, JSON.stringify(value)];
    }),
  );
}

function severityRank(severity: RendererDiagnostic['severity']): number {
  if (severity === 'error') return 0;
  if (severity === 'warning') return 1;
  return 2;
}
