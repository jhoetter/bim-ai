import type { Element } from '@bim-ai/core';

export interface CoordinationLensReadoutIssue {
  id: string;
  title: string;
  status: string;
  severity: string;
  responsibleDiscipline: string;
}

export interface CoordinationLensReadout {
  modelHealthWarningCount: number;
  clashCount: number;
  openIssueCount: number;
  linkedModelCount: number;
  reviewArtifactCount: number;
  requiredSchedules: string[];
  issues: CoordinationLensReadoutIssue[];
}

const CLOSED_STATUSES = new Set(['done', 'resolved', 'closed', 'not_an_issue']);

const REQUIRED_COORDINATION_SCHEDULES = [
  'Clash report',
  'Issue list',
  'Opening requests',
  'Model health report',
  'Change impact report',
  'Linked model drift report',
] as const;

const CLASH_RULE_HINTS = ['clash', 'clearance', 'penetration', 'duplicate', 'opening'];

export function buildCoordinationLensReadout(
  elementsById: Record<string, Element>,
): CoordinationLensReadout {
  const elements = Object.values(elementsById);
  const issues = elements.flatMap(coordinationIssueRow).sort((a, b) => a.id.localeCompare(b.id));
  const linkRows = elements.filter((element) =>
    ['link_model', 'link_external', 'link_dxf'].includes(element.kind),
  );
  const staleLinkCount = linkRows.filter((element) => {
    const reloadStatus = stringProp(element, 'reloadStatus');
    return reloadStatus === 'source_missing' || reloadStatus === 'parse_error';
  }).length;
  const missingReferenceCount = elements.reduce(
    (count, element) => count + missingLocalReferenceCount(element, elementsById),
    0,
  );

  return {
    modelHealthWarningCount: staleLinkCount + missingReferenceCount,
    clashCount: elements.reduce((count, element) => count + clashCountForElement(element), 0),
    openIssueCount: issues.filter((issue) => !CLOSED_STATUSES.has(issue.status)).length,
    linkedModelCount: linkRows.length,
    reviewArtifactCount: elements.filter((element) => element.kind === 'bcf').length,
    requiredSchedules: [...REQUIRED_COORDINATION_SCHEDULES],
    issues,
  };
}

function coordinationIssueRow(element: Element): CoordinationLensReadoutIssue[] {
  const kind = kindOf(element);
  if (kind === 'issue') {
    return [
      {
        id: stringProp(element, 'id'),
        title: stringProp(element, 'title') || 'Issue',
        status: stringProp(element, 'status') || 'open',
        severity: stringProp(element, 'severity') || 'warning',
        responsibleDiscipline: stringProp(element, 'responsibleDiscipline') || 'coordination',
      },
    ];
  }
  if (kind === 'constructability_issue') {
    return [
      {
        id: stringProp(element, 'id'),
        title: stringProp(element, 'message') || stringProp(element, 'ruleId') || 'Issue',
        status: stringProp(element, 'status') || 'new',
        severity: stringProp(element, 'severity') || 'warning',
        responsibleDiscipline: stringProp(element, 'discipline') || 'coordination',
      },
    ];
  }
  return [];
}

function clashCountForElement(element: Element): number {
  const kind = kindOf(element);
  if (kind === 'clash_test') {
    const results = unknownProp(element, 'results');
    return Array.isArray(results) ? results.length : 0;
  }
  if (kind === 'constructability_issue') {
    const ruleId = stringProp(element, 'ruleId').toLowerCase();
    return CLASH_RULE_HINTS.some((hint) => ruleId.includes(hint)) ? 1 : 0;
  }
  return 0;
}

function missingLocalReferenceCount(
  element: Element,
  elementsById: Record<string, Element>,
): number {
  const data = element as unknown as Record<string, unknown>;
  let count = 0;
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id' || key === 'sourceModelId' || key === 'bundleId') continue;
    if (key.endsWith('Id') && typeof value === 'string' && value && !elementsById[value]) {
      count += 1;
    } else if (key.endsWith('Ids') && Array.isArray(value)) {
      count += value.filter(
        (item) => typeof item === 'string' && item && !elementsById[item],
      ).length;
    }
  }
  return count;
}

function stringProp(element: Element, key: string): string {
  const value = unknownProp(element, key);
  return typeof value === 'string' ? value : '';
}

function unknownProp(element: Element, key: string): unknown {
  return (element as unknown as Record<string, unknown>)[key];
}

function kindOf(element: Element): string {
  return stringProp(element, 'kind');
}
