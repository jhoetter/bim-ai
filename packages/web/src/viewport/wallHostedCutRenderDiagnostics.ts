import type { Element } from '@bim-ai/core';

import { resolveDoorCutDimensions, resolveWindowCutDimensions } from './hostedOpeningDimensions';
import { shouldRunWallOpeningCsg } from './wallCsgEligibility';

type WallElem = Extract<Element, { kind: 'wall' }>;
type DoorElem = Extract<Element, { kind: 'door' }>;
type WindowElem = Extract<Element, { kind: 'window' }>;
type WallOpeningElem = Extract<Element, { kind: 'wall_opening' }>;
type HostedCutElem = DoorElem | WindowElem | WallOpeningElem;

export type WallHostedCutRenderDiagnosticCode =
  | 'missing_wall_host'
  | 'wall_host_not_found'
  | 'wall_host_wrong_kind'
  | 'host_wall_too_short'
  | 'hosted_cut_outside_wall_span'
  | 'hosted_cut_low_endpoint_clearance'
  | 'hosted_cut_vertical_extent_outside_host'
  | 'host_cut_disabled_by_element'
  | 'wall_opening_csg_disabled'
  | 'wall_opening_csg_skipped_by_curtain_wall'
  | 'unsupported_curved_host_geometry'
  | 'unsupported_non_rectangular_host_profile'
  | 'unsupported_non_prismatic_host_geometry'
  | 'overlapping_hosted_wall_cuts'
  | 'detached_or_proxy_render_risk';

export type WallHostedCutRenderDiagnosticSeverity = 'error' | 'warning';

export type WallHostedCutRenderDiagnostic = {
  code: WallHostedCutRenderDiagnosticCode;
  severity: WallHostedCutRenderDiagnosticSeverity;
  elementId: string;
  elementKind: HostedCutElem['kind'];
  hostWallId?: string;
  relatedElementIds?: string[];
  message: string;
  data?: Record<string, number | string | boolean | null>;
};

export type WallHostedCutRenderDiagnosticInput = {
  elements?: readonly Element[];
  elementsById?: Record<string, Element>;
  snapshot?: { elements?: readonly Element[] | Record<string, Element> | null } | null;
  csgEnabled?: boolean;
  minHostWallLengthMm?: number;
  endpointClearanceMm?: number;
};

type CutInterval = {
  startT: number;
  endT: number;
  sillMm: number;
  headMm: number;
  widthMm: number;
};

function elementsRecord(input: WallHostedCutRenderDiagnosticInput): Record<string, Element> {
  if (input.elementsById) return input.elementsById;
  if (input.elements) {
    return Object.fromEntries(input.elements.map((element) => [element.id, element]));
  }
  const rawSnapshot = input.snapshot?.elements;
  if (!rawSnapshot) return {};
  if (Array.isArray(rawSnapshot)) {
    return Object.fromEntries(
      (rawSnapshot as readonly Element[]).map((element) => [element.id, element]),
    );
  }
  return rawSnapshot as Record<string, Element>;
}

function hostedCuts(elementsById: Record<string, Element>): HostedCutElem[] {
  return Object.values(elementsById)
    .filter(
      (element): element is HostedCutElem =>
        element.kind === 'door' || element.kind === 'window' || element.kind === 'wall_opening',
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

function wallLengthMm(wall: WallElem): number {
  return Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm);
}

function hostWallId(opening: HostedCutElem): string | undefined {
  return opening.kind === 'wall_opening' ? opening.hostWallId : opening.wallId;
}

function kindLabel(opening: HostedCutElem): string {
  if (opening.kind === 'wall_opening') return 'wall opening';
  return opening.kind;
}

function readProps(opening: HostedCutElem): Record<string, unknown> {
  return ('props' in opening && opening.props ? opening.props : {}) as Record<string, unknown>;
}

function isTruthyFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  return false;
}

function hasDisabledHostCut(opening: HostedCutElem): boolean {
  const props = readProps(opening);
  const hostCutMode = String(props.hostCut ?? '').toLowerCase();
  if (isTruthyFlag(props.disableHostCut) || hostCutMode === 'none') return true;
  if (
    (opening.kind === 'door' || opening.kind === 'window') &&
    Number.isFinite(opening.hostCutDepthMm) &&
    Number(opening.hostCutDepthMm) <= 0
  ) {
    return true;
  }
  return false;
}

function intervalForOpening(
  opening: HostedCutElem,
  wall: WallElem,
  elementsById: Record<string, Element>,
): CutInterval {
  const lengthMm = Math.max(1, wallLengthMm(wall));
  if (opening.kind === 'wall_opening') {
    return {
      startT: opening.alongTStart,
      endT: opening.alongTEnd,
      sillMm: opening.sillHeightMm,
      headMm: opening.headHeightMm,
      widthMm: Math.abs(opening.alongTEnd - opening.alongTStart) * lengthMm,
    };
  }

  if (opening.kind === 'door') {
    const dimensions = resolveDoorCutDimensions(opening, elementsById, wall.heightMm);
    const halfT = dimensions.widthMm / 2 / lengthMm;
    return {
      startT: opening.alongT - halfT,
      endT: opening.alongT + halfT,
      sillMm: 0,
      headMm: dimensions.heightMm,
      widthMm: dimensions.widthMm,
    };
  }

  const dimensions = resolveWindowCutDimensions(opening, elementsById);
  const halfT = dimensions.widthMm / 2 / lengthMm;
  return {
    startT: opening.alongT - halfT,
    endT: opening.alongT + halfT,
    sillMm: dimensions.sillHeightMm,
    headMm: dimensions.sillHeightMm + dimensions.heightMm,
    widthMm: dimensions.widthMm,
  };
}

function pushDiagnostic(
  diagnostics: WallHostedCutRenderDiagnostic[],
  diagnostic: WallHostedCutRenderDiagnostic,
) {
  diagnostics.push(diagnostic);
}

function pushProxyRisk(
  diagnostics: WallHostedCutRenderDiagnostic[],
  opening: HostedCutElem,
  hostId: string | undefined,
  reason: WallHostedCutRenderDiagnosticCode,
) {
  pushDiagnostic(diagnostics, {
    code: 'detached_or_proxy_render_risk',
    severity: 'warning',
    elementId: opening.id,
    elementKind: opening.kind,
    hostWallId: hostId,
    relatedElementIds: hostId ? [hostId] : undefined,
    message: `${kindLabel(opening)} '${opening.id}' may render as a detached/proxy element instead of a cut because ${reason}.`,
    data: { reason },
  });
}

function addHostGeometryDiagnostics(
  diagnostics: WallHostedCutRenderDiagnostic[],
  opening: HostedCutElem,
  wall: WallElem,
) {
  if (wall.wallCurve) {
    pushDiagnostic(diagnostics, {
      code: 'unsupported_curved_host_geometry',
      severity: 'warning',
      elementId: opening.id,
      elementKind: opening.kind,
      hostWallId: wall.id,
      relatedElementIds: [wall.id],
      message: `${kindLabel(opening)} '${opening.id}' is hosted by curved wall '${wall.id}', whose hosted wall-cut rendering is not guaranteed.`,
    });
    pushProxyRisk(diagnostics, opening, wall.id, 'unsupported_curved_host_geometry');
  }

  if (wall.profilePoints && wall.profilePoints.length > 0) {
    pushDiagnostic(diagnostics, {
      code: 'unsupported_non_rectangular_host_profile',
      severity: 'warning',
      elementId: opening.id,
      elementKind: opening.kind,
      hostWallId: wall.id,
      relatedElementIds: [wall.id],
      message: `${kindLabel(opening)} '${opening.id}' is hosted by profiled wall '${wall.id}', so the rectangular host cut may not match the visible wall face.`,
    });
    pushProxyRisk(diagnostics, opening, wall.id, 'unsupported_non_rectangular_host_profile');
  }

  const hasNonPrismaticHost =
    Boolean(wall.leanMm) ||
    (Number.isFinite(wall.slopeAngleDeg) && Number(wall.slopeAngleDeg) !== 0) ||
    (Number.isFinite(wall.taperRatio) && Number(wall.taperRatio) !== 1) ||
    (Number.isFinite(wall.topThicknessMm) && Number(wall.topThicknessMm) > 0);
  if (hasNonPrismaticHost) {
    pushDiagnostic(diagnostics, {
      code: 'unsupported_non_prismatic_host_geometry',
      severity: 'warning',
      elementId: opening.id,
      elementKind: opening.kind,
      hostWallId: wall.id,
      relatedElementIds: [wall.id],
      message: `${kindLabel(opening)} '${opening.id}' is hosted by non-prismatic wall '${wall.id}', so the wall-cut renderer may show a proxy or incomplete cut.`,
    });
    pushProxyRisk(diagnostics, opening, wall.id, 'unsupported_non_prismatic_host_geometry');
  }
}

function addOverlapDiagnostics(
  diagnostics: WallHostedCutRenderDiagnostic[],
  rows: Array<{ opening: HostedCutElem; hostWallId: string; interval: CutInterval }>,
) {
  const byHost = new Map<string, Array<{ opening: HostedCutElem; interval: CutInterval }>>();
  for (const row of rows) {
    const list = byHost.get(row.hostWallId) ?? [];
    list.push({ opening: row.opening, interval: row.interval });
    byHost.set(row.hostWallId, list);
  }

  for (const [wallId, list] of byHost) {
    const ordered = list.sort((a, b) => a.interval.startT - b.interval.startT);
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const first = ordered[i];
        const second = ordered[j];
        if (second.interval.startT >= first.interval.endT) break;
        pushDiagnostic(diagnostics, {
          code: 'overlapping_hosted_wall_cuts',
          severity: 'error',
          elementId: first.opening.id,
          elementKind: first.opening.kind,
          hostWallId: wallId,
          relatedElementIds: [wallId, second.opening.id],
          message: `${kindLabel(first.opening)} '${first.opening.id}' overlaps hosted cut '${second.opening.id}' on wall '${wallId}'.`,
          data: {
            firstStartT: first.interval.startT,
            firstEndT: first.interval.endT,
            secondStartT: second.interval.startT,
            secondEndT: second.interval.endT,
          },
        });
        pushProxyRisk(diagnostics, first.opening, wallId, 'overlapping_hosted_wall_cuts');
        pushProxyRisk(diagnostics, second.opening, wallId, 'overlapping_hosted_wall_cuts');
      }
    }
  }
}

export function diagnoseWallHostedCutRenderRisks(
  input: WallHostedCutRenderDiagnosticInput,
): WallHostedCutRenderDiagnostic[] {
  const elementsById = elementsRecord(input);
  const csgEnabled = input.csgEnabled ?? true;
  const minHostWallLengthMm = input.minHostWallLengthMm ?? 10;
  const endpointClearanceMm = input.endpointClearanceMm ?? 25;
  const diagnostics: WallHostedCutRenderDiagnostic[] = [];
  const validRows: Array<{ opening: HostedCutElem; hostWallId: string; interval: CutInterval }> =
    [];

  for (const opening of hostedCuts(elementsById)) {
    const hostId = hostWallId(opening);
    if (!hostId) {
      pushDiagnostic(diagnostics, {
        code: 'missing_wall_host',
        severity: 'error',
        elementId: opening.id,
        elementKind: opening.kind,
        message: `${kindLabel(opening)} '${opening.id}' has no wall host, so the renderer cannot cut a wall.`,
      });
      pushProxyRisk(diagnostics, opening, hostId, 'missing_wall_host');
      continue;
    }

    const host = elementsById[hostId];
    if (!host) {
      pushDiagnostic(diagnostics, {
        code: 'wall_host_not_found',
        severity: 'error',
        elementId: opening.id,
        elementKind: opening.kind,
        hostWallId: hostId,
        message: `${kindLabel(opening)} '${opening.id}' references missing wall host '${hostId}'.`,
      });
      pushProxyRisk(diagnostics, opening, hostId, 'wall_host_not_found');
      continue;
    }
    if (host.kind !== 'wall') {
      pushDiagnostic(diagnostics, {
        code: 'wall_host_wrong_kind',
        severity: 'error',
        elementId: opening.id,
        elementKind: opening.kind,
        hostWallId: hostId,
        relatedElementIds: [hostId],
        message: `${kindLabel(opening)} '${opening.id}' references '${hostId}', but that element is '${host.kind}' instead of a wall.`,
        data: { hostKind: host.kind },
      });
      pushProxyRisk(diagnostics, opening, hostId, 'wall_host_wrong_kind');
      continue;
    }

    const lengthMm = wallLengthMm(host);
    if (lengthMm < minHostWallLengthMm) {
      pushDiagnostic(diagnostics, {
        code: 'host_wall_too_short',
        severity: 'error',
        elementId: opening.id,
        elementKind: opening.kind,
        hostWallId: host.id,
        relatedElementIds: [host.id],
        message: `Host wall '${host.id}' is too short (${lengthMm.toFixed(1)} mm) for ${kindLabel(opening)} '${opening.id}'.`,
        data: { wallLengthMm: lengthMm, minHostWallLengthMm },
      });
      pushProxyRisk(diagnostics, opening, host.id, 'host_wall_too_short');
      continue;
    }

    const interval = intervalForOpening(opening, host, elementsById);
    if (
      !Number.isFinite(interval.startT) ||
      !Number.isFinite(interval.endT) ||
      interval.startT >= interval.endT ||
      interval.startT < 0 ||
      interval.endT > 1
    ) {
      pushDiagnostic(diagnostics, {
        code: 'hosted_cut_outside_wall_span',
        severity: 'error',
        elementId: opening.id,
        elementKind: opening.kind,
        hostWallId: host.id,
        relatedElementIds: [host.id],
        message: `${kindLabel(opening)} '${opening.id}' extends outside the wall span of host '${host.id}'.`,
        data: {
          startT: interval.startT,
          endT: interval.endT,
          widthMm: interval.widthMm,
          wallLengthMm: lengthMm,
        },
      });
      pushProxyRisk(diagnostics, opening, host.id, 'hosted_cut_outside_wall_span');
    } else {
      const clearanceStartMm = interval.startT * lengthMm;
      const clearanceEndMm = (1 - interval.endT) * lengthMm;
      const minClearanceMm = Math.min(clearanceStartMm, clearanceEndMm);
      if (minClearanceMm < endpointClearanceMm) {
        pushDiagnostic(diagnostics, {
          code: 'hosted_cut_low_endpoint_clearance',
          severity: 'warning',
          elementId: opening.id,
          elementKind: opening.kind,
          hostWallId: host.id,
          relatedElementIds: [host.id],
          message: `${kindLabel(opening)} '${opening.id}' leaves only ${minClearanceMm.toFixed(1)} mm endpoint clearance on host wall '${host.id}'.`,
          data: { minClearanceMm, endpointClearanceMm },
        });
      }
      validRows.push({ opening, hostWallId: host.id, interval });
    }

    // Issue #109 — Giebelverglasung: when the host wall is attached to a
    // non-flat roof, its addressable vertical extent reaches above the
    // rectangular ``host.heightMm`` into the upper gable triangle. We
    // can't recover the exact peak height from the wall alone here, so
    // we relax the upper bound for any roof-attached wall and let the
    // renderer's gable-aware CSG path (csgWorker + wallGableProfile)
    // host the opening. Plain rectangular walls keep the strict bound.
    const hasGableHost = Boolean(host.roofAttachmentId);
    const headExceedsHost = interval.headMm > host.heightMm;
    if (
      !Number.isFinite(interval.sillMm) ||
      !Number.isFinite(interval.headMm) ||
      interval.sillMm < 0 ||
      interval.headMm <= interval.sillMm ||
      (headExceedsHost && !hasGableHost)
    ) {
      pushDiagnostic(diagnostics, {
        code: 'hosted_cut_vertical_extent_outside_host',
        severity: 'error',
        elementId: opening.id,
        elementKind: opening.kind,
        hostWallId: host.id,
        relatedElementIds: [host.id],
        message: `${kindLabel(opening)} '${opening.id}' has vertical cut extent ${interval.sillMm.toFixed(1)}-${interval.headMm.toFixed(1)} mm outside host wall '${host.id}' height ${host.heightMm.toFixed(1)} mm.`,
        data: { sillMm: interval.sillMm, headMm: interval.headMm, wallHeightMm: host.heightMm },
      });
      pushProxyRisk(diagnostics, opening, host.id, 'hosted_cut_vertical_extent_outside_host');
    }

    if (hasDisabledHostCut(opening)) {
      pushDiagnostic(diagnostics, {
        code: 'host_cut_disabled_by_element',
        severity: 'error',
        elementId: opening.id,
        elementKind: opening.kind,
        hostWallId: host.id,
        relatedElementIds: [host.id],
        message: `${kindLabel(opening)} '${opening.id}' disables its semantic host cut, so the renderer cannot show a faithful wall aperture.`,
      });
      pushProxyRisk(diagnostics, opening, host.id, 'host_cut_disabled_by_element');
    }

    addHostGeometryDiagnostics(diagnostics, opening, host);
  }

  addOverlapDiagnostics(diagnostics, validRows);

  const byWall = new Map<string, { wall: WallElem; cuts: HostedCutElem[] }>();
  for (const row of validRows) {
    const wall = elementsById[row.hostWallId];
    if (!wall || wall.kind !== 'wall') continue;
    const entry = byWall.get(row.hostWallId) ?? { wall, cuts: [] };
    entry.cuts.push(row.opening);
    byWall.set(row.hostWallId, entry);
  }
  for (const { wall, cuts } of byWall.values()) {
    const doorCount = cuts.filter((cut) => cut.kind === 'door').length;
    const windowCount = cuts.filter((cut) => cut.kind === 'window').length;
    const wallOpeningCount = cuts.filter((cut) => cut.kind === 'wall_opening').length;
    const csgWillRun = shouldRunWallOpeningCsg({
      csgEnabled,
      hostedDoorCount: doorCount,
      hostedWindowCount: windowCount,
      hostedWallOpeningCount: wallOpeningCount,
      roofAttachmentId: wall.roofAttachmentId,
      isCurtainWall: wall.isCurtainWall,
    });
    if (csgWillRun) continue;

    const code = !csgEnabled
      ? 'wall_opening_csg_disabled'
      : 'wall_opening_csg_skipped_by_curtain_wall';
    for (const opening of cuts) {
      pushDiagnostic(diagnostics, {
        code,
        severity: code === 'wall_opening_csg_disabled' ? 'error' : 'warning',
        elementId: opening.id,
        elementKind: opening.kind,
        hostWallId: wall.id,
        relatedElementIds: [wall.id],
        message:
          code === 'wall_opening_csg_disabled'
            ? `${kindLabel(opening)} '${opening.id}' needs a wall cut, but wall-opening CSG is disabled.`
            : `${kindLabel(opening)} '${opening.id}' is hosted by curtain wall '${wall.id}', where the wall-opening CSG path is skipped.`,
      });
      pushProxyRisk(diagnostics, opening, wall.id, code);
    }
  }

  return diagnostics.sort((a, b) => {
    const severityOrder = a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1;
    if (severityOrder !== 0) return severityOrder;
    return `${a.elementId}:${a.code}`.localeCompare(`${b.elementId}:${b.code}`);
  });
}
