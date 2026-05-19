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

  return [
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
  ].sort((a, b) => {
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
    const feature = code.startsWith('renderer.material')
      ? 'material-resolution'
      : code.startsWith('renderer.asset_instance')
        ? 'asset-instance'
        : 'family-instance';
    const unsupported = code.endsWith('.unsupported') || code.endsWith('.unresolved');
    const fallback = code.endsWith('.fallback') || code.endsWith('_fallback');
    return createRendererDiagnostic({
      ruleId: code.replaceAll('.', '_'),
      code,
      severity: unsupported ? 'error' : 'warning',
      issueClass: unsupported ? 'renderer-unsupported' : 'renderer-degraded',
      rendererArea: feature === 'material-resolution' ? 'materials' : 'viewport-3d',
      feature,
      message: elementRenderStatusMessage(status, code),
      elementIds: [status.elementId],
      viewId,
      evidence: {
        ...evidence,
        details: {
          kind: status.kind,
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
  if (code.startsWith('renderer.material')) return ['BIR-I02', 'BIR-I03', 'BIR-I05', 'BIR-J07'];
  if (code.startsWith('renderer.asset_instance')) {
    return ['BIR-I02', 'BIR-I03', 'BIR-I05', 'BIR-J05'];
  }
  return ['BIR-I02', 'BIR-I03', 'BIR-I05', 'BIR-J05'];
}

export function collectRendererDiagnosticPacket(
  input: CollectRendererDiagnosticsPacketInput,
): RendererDiagnosticPacket {
  return createRendererDiagnosticPacket({
    diagnostics: collectRendererDiagnostics(input),
    generatedAtIso: input.generatedAtIso,
    modelRevision: input.modelRevision,
    viewId: input.viewId,
    gitHead: input.gitHead,
    rendererBuild: input.rendererBuild,
    supportMatrixDigest: input.supportMatrixDigest,
  });
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
