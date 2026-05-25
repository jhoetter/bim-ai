import {
  type AppWsCloseInput,
  type AppWsEndpoint,
  classifyAppWsClose,
  classifyViteProxySocketError,
} from './wsStability';

export const LIVE_RESPONSIVENESS_SCHEMA_VERSION = 'live-responsiveness.v1';

export type LiveInteractionId =
  | 'orbit'
  | 'select'
  | 'lens-switch'
  | 'advisor-open'
  | 'advisor-close';

export type LiveResponsivenessStatus = 'pass' | 'fail' | 'missing';
export type LiveResponsivenessChurnClassification = 'benign' | 'actionable';

export interface LiveInteractionBudget {
  maxLatencyMs: number;
  p95LatencyMs: number;
  maxLongTaskMs: number;
  maxDroppedFramePercent: number;
}

export interface LiveInteractionContract {
  id: LiveInteractionId;
  trackerRefs: readonly ('BIR-L02' | 'BIR-N11')[];
  description: string;
  budget: LiveInteractionBudget;
}

export interface LiveInteractionMetrics {
  id: string;
  completed?: unknown;
  samplesMs?: readonly unknown[];
  maxLatencyMs?: unknown;
  p95LatencyMs?: unknown;
  maxLongTaskMs?: unknown;
  droppedFramePercent?: unknown;
}

export interface LiveResponsivenessViteProxyChurnEvent {
  kind: 'vite-proxy-error';
  code?: unknown;
  message?: unknown;
  count?: unknown;
}

export interface LiveResponsivenessAppWsCloseChurnEvent extends Omit<
  AppWsCloseInput,
  'endpoint' | 'nextAttempt'
> {
  kind: 'app-ws-close';
  endpoint?: AppWsEndpoint;
  nextAttempt?: unknown;
  count?: unknown;
}

export interface LiveResponsivenessUnknownChurnEvent {
  kind?: unknown;
  count?: unknown;
  [key: string]: unknown;
}

export type LiveResponsivenessChurnEvent =
  | LiveResponsivenessViteProxyChurnEvent
  | LiveResponsivenessAppWsCloseChurnEvent
  | LiveResponsivenessUnknownChurnEvent;

export interface LiveResponsivenessEvidenceInput {
  targetId?: unknown;
  interactions?: readonly LiveInteractionMetrics[];
  websocketChurn?: readonly LiveResponsivenessChurnEvent[];
}

export interface LiveInteractionAcceptanceRow {
  trackerRefs: readonly ('BIR-L02' | 'BIR-N11')[];
  interaction: LiveInteractionId;
  status: LiveResponsivenessStatus;
  issues: string[];
  budget: LiveInteractionBudget;
  observed: {
    sampleCount: number;
    completed: boolean;
    maxLatencyMs: number | null;
    p95LatencyMs: number | null;
    maxLongTaskMs: number | null;
    droppedFramePercent: number | null;
  };
}

export interface LiveResponsivenessChurnRow {
  trackerRefs: readonly ('BIR-L03' | 'BIR-N11')[];
  classification: LiveResponsivenessChurnClassification;
  kind: string;
  count: number;
  code: string | null;
  closeCode: number | null;
  action: string | null;
  shouldLog: boolean;
  reason: string;
}

export interface LiveResponsivenessReport {
  schemaVersion: typeof LIVE_RESPONSIVENESS_SCHEMA_VERSION;
  targetId: string;
  ok: boolean;
  summary: {
    requiredInteractionCount: number;
    interactionPassCount: number;
    interactionFailCount: number;
    actionableChurnCount: number;
    benignChurnCount: number;
    interactionOk: boolean;
    websocketChurnOk: boolean;
  };
  contract: {
    interactions: readonly LiveInteractionContract[];
    websocketChurnPolicy: {
      benignViteProxySocketCodes: readonly ['EPIPE', 'ECONNRESET'];
      actionableAppCloseCodes: readonly [4403, 4404];
      exhaustedReconnectBudget: 'actionable';
      unknownChurn: 'actionable';
    };
  };
  interactionRows: LiveInteractionAcceptanceRow[];
  websocketChurnRows: LiveResponsivenessChurnRow[];
}

export const LIVE_INTERACTION_CONTRACT: readonly LiveInteractionContract[] = [
  {
    id: 'orbit',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    description: 'Orbit the primary 3D view without visible main-thread stalls.',
    budget: {
      maxLatencyMs: 150,
      p95LatencyMs: 80,
      maxLongTaskMs: 80,
      maxDroppedFramePercent: 5,
    },
  },
  {
    id: 'select',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    description: 'Select a door/window or envelope element and render inspector state.',
    budget: {
      maxLatencyMs: 250,
      p95LatencyMs: 160,
      maxLongTaskMs: 80,
      maxDroppedFramePercent: 5,
    },
  },
  {
    id: 'lens-switch',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    description: 'Switch from architecture to coordination lens on the active model.',
    budget: {
      maxLatencyMs: 500,
      p95LatencyMs: 300,
      maxLongTaskMs: 120,
      maxDroppedFramePercent: 8,
    },
  },
  {
    id: 'advisor-open',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    description: 'Open Advisor with findings loaded.',
    budget: {
      maxLatencyMs: 500,
      p95LatencyMs: 300,
      maxLongTaskMs: 120,
      maxDroppedFramePercent: 8,
    },
  },
  {
    id: 'advisor-close',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    description: 'Close Advisor and return focus to the viewport.',
    budget: {
      maxLatencyMs: 350,
      p95LatencyMs: 220,
      maxLongTaskMs: 100,
      maxDroppedFramePercent: 6,
    },
  },
];

export function liveResponsivenessContract(): LiveResponsivenessReport['contract'] {
  return {
    interactions: LIVE_INTERACTION_CONTRACT,
    websocketChurnPolicy: {
      benignViteProxySocketCodes: ['EPIPE', 'ECONNRESET'],
      actionableAppCloseCodes: [4403, 4404],
      exhaustedReconnectBudget: 'actionable',
      unknownChurn: 'actionable',
    },
  };
}

export function classifyLiveResponsiveness(
  evidence: LiveResponsivenessEvidenceInput,
): LiveResponsivenessReport {
  const interactions = new Map(
    (Array.isArray(evidence.interactions) ? evidence.interactions : []).map((entry) => [
      entry.id,
      entry,
    ]),
  );
  const interactionRows = LIVE_INTERACTION_CONTRACT.map((contract) =>
    classifyInteraction(contract, interactions.get(contract.id)),
  );
  const websocketChurnRows = (
    Array.isArray(evidence.websocketChurn) ? evidence.websocketChurn : []
  ).map(classifyLiveResponsivenessChurnEvent);
  const interactionOk = interactionRows.every((row) => row.status === 'pass');
  const websocketChurnOk = websocketChurnRows.every((row) => row.classification === 'benign');

  return {
    schemaVersion: LIVE_RESPONSIVENESS_SCHEMA_VERSION,
    targetId:
      typeof evidence.targetId === 'string' && evidence.targetId ? evidence.targetId : 'sample-1',
    ok: interactionOk && websocketChurnOk,
    summary: {
      requiredInteractionCount: interactionRows.length,
      interactionPassCount: interactionRows.filter((row) => row.status === 'pass').length,
      interactionFailCount: interactionRows.filter((row) => row.status !== 'pass').length,
      actionableChurnCount: websocketChurnRows
        .filter((row) => row.classification === 'actionable')
        .reduce((sum, row) => sum + row.count, 0),
      benignChurnCount: websocketChurnRows
        .filter((row) => row.classification === 'benign')
        .reduce((sum, row) => sum + row.count, 0),
      interactionOk,
      websocketChurnOk,
    },
    contract: liveResponsivenessContract(),
    interactionRows,
    websocketChurnRows,
  };
}

export function classifyLiveResponsivenessChurnEvent(
  event: LiveResponsivenessChurnEvent,
): LiveResponsivenessChurnRow {
  const count = positiveInteger(event.count);

  if (event.kind === 'vite-proxy-error') {
    const classification = classifyViteProxySocketError({
      code: event.code,
      message: event.message,
    });
    return {
      trackerRefs: ['BIR-L03', 'BIR-N11'],
      classification: classification.classification,
      kind: event.kind,
      count,
      code: classification.code,
      closeCode: null,
      action: null,
      shouldLog: classification.shouldLog,
      reason: classification.reason,
    };
  }

  if (event.kind === 'app-ws-close') {
    const closeEvent = event as LiveResponsivenessAppWsCloseChurnEvent;
    const decision = classifyAppWsClose({
      endpoint: appWsEndpointOrWorkspace(closeEvent.endpoint),
      closeCode: numberOrUndefined(closeEvent.closeCode),
      intentional: booleanOrUndefined(closeEvent.intentional),
      nextAttempt: positiveInteger(closeEvent.nextAttempt),
      hidden: booleanOrUndefined(closeEvent.hidden),
      maxAttempts: numberOrUndefined(closeEvent.maxAttempts),
    });
    return {
      trackerRefs: ['BIR-L03', 'BIR-N11'],
      classification: decision.classification,
      kind: event.kind,
      count,
      code: null,
      closeCode: typeof closeEvent.closeCode === 'number' ? closeEvent.closeCode : null,
      action: decision.action,
      shouldLog: decision.classification === 'actionable',
      reason: decision.reason,
    };
  }

  return {
    trackerRefs: ['BIR-L03', 'BIR-N11'],
    classification: 'actionable',
    kind: typeof event.kind === 'string' && event.kind ? event.kind : 'unknown',
    count,
    code: null,
    closeCode: null,
    action: null,
    shouldLog: true,
    reason: 'unknown websocket/proxy churn must be reviewed before live responsiveness acceptance',
  };
}

function classifyInteraction(
  contract: LiveInteractionContract,
  metrics: LiveInteractionMetrics | undefined,
): LiveInteractionAcceptanceRow {
  const samples = Array.isArray(metrics?.samplesMs)
    ? metrics.samplesMs.map(numberOrNull).filter((value): value is number => value !== null)
    : [];
  const maxLatencyMs = numberOrNull(metrics?.maxLatencyMs) ?? maxOrNull(samples);
  const p95LatencyMs = numberOrNull(metrics?.p95LatencyMs) ?? percentileOrNull(samples, 0.95);
  const maxLongTaskMs = numberOrNull(metrics?.maxLongTaskMs);
  const droppedFramePercent = numberOrNull(metrics?.droppedFramePercent);
  const completed = metrics?.completed === true;
  const issues: string[] = [];

  if (!metrics) issues.push('missing_interaction_metrics');
  if (!completed) issues.push('interaction_not_completed');
  if (maxLatencyMs === null) issues.push('missing_max_latency_ms');
  else if (maxLatencyMs > contract.budget.maxLatencyMs) issues.push('max_latency_over_budget');
  if (p95LatencyMs === null) issues.push('missing_p95_latency_ms');
  else if (p95LatencyMs > contract.budget.p95LatencyMs) issues.push('p95_latency_over_budget');
  if (maxLongTaskMs === null) issues.push('missing_max_long_task_ms');
  else if (maxLongTaskMs > contract.budget.maxLongTaskMs) issues.push('long_task_over_budget');
  if (droppedFramePercent === null) issues.push('missing_dropped_frame_percent');
  else if (droppedFramePercent > contract.budget.maxDroppedFramePercent) {
    issues.push('dropped_frames_over_budget');
  }

  return {
    trackerRefs: contract.trackerRefs,
    interaction: contract.id,
    status: metrics ? (issues.length === 0 ? 'pass' : 'fail') : 'missing',
    issues,
    budget: contract.budget,
    observed: {
      sampleCount: samples.length,
      completed,
      maxLatencyMs,
      p95LatencyMs,
      maxLongTaskMs,
      droppedFramePercent,
    },
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function booleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function appWsEndpointOrWorkspace(value: unknown): AppWsEndpoint {
  if (value === 'workspace' || value === 'jobs' || value === 'presentation') return value;
  return 'workspace';
}

function positiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function maxOrNull(values: readonly number[]): number | null {
  return values.length > 0 ? Math.max(...values) : null;
}

function percentileOrNull(values: readonly number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(sorted.length * percentile) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
}
