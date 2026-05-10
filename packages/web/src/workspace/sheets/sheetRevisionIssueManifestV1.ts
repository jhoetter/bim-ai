/** Deterministic revision/issue segments (parity with app/bim_ai/sheet_titleblock_revision_issue_v1.py). */

import { sha256Utf8 } from '../../plan/roomSchemeColor';

export const SHEET_TITLEBLOCK_REVISION_ISSUE_MANIFEST_V1 =
  'sheetTitleblockRevisionIssueManifest_v1';

function strParam(tp: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = tp[k];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

export type TitleblockRevisionIssueNormV1 = {
  revisionId: string;
  revisionCode: string;
  revisionDate: string;
  revisionDescription: string;
  issueStatus: string;
};

export function normalizeTitleblockRevisionIssueV1(
  tb: Record<string, string> | null | undefined,
): TitleblockRevisionIssueNormV1 {
  const raw = tb && typeof tb === 'object' ? tb : {};
  return {
    revisionId: strParam(raw, ['revisionId', 'revision_id']),
    revisionCode: strParam(raw, ['revisionCode', 'revision']),
    revisionDate: strParam(raw, ['revisionDate', 'revDate', 'revision_date']),
    revisionDescription: strParam(raw, [
      'revisionDescription',
      'revDescription',
      'revision_description',
    ]),
    issueStatus: strParam(raw, ['issueStatus', 'issue_status', 'sheetIssueStatus']),
  };
}

export function revisionDescriptionDigestPrefix8(description: string): string {
  const t = description.trim();
  if (!t) return '';
  return sha256Utf8(t).slice(0, 8);
}

function segmentTokenEsc(value: string): string {
  return value.split(/\s+/).join(' ').replace(/\]/g, '?').replace(/\[/g, '(');
}

function buildRevIssInnerTokenString(norm: TitleblockRevisionIssueNormV1): string {
  const parts: string[] = [];
  if (norm.revisionId) parts.push(`id=${segmentTokenEsc(norm.revisionId)}`);
  if (norm.revisionCode) parts.push(`code=${segmentTokenEsc(norm.revisionCode)}`);
  if (norm.revisionDate) parts.push(`dt=${segmentTokenEsc(norm.revisionDate)}`);
  if (norm.issueStatus) parts.push(`iss=${segmentTokenEsc(norm.issueStatus)}`);
  const d8 = revisionDescriptionDigestPrefix8(norm.revisionDescription);
  if (d8) parts.push(`d8=${d8}`);
  return parts.join(' ');
}

export function formatSheetRevIssTitleblockDisplaySegmentV1(
  norm: TitleblockRevisionIssueNormV1,
): string {
  const inner = buildRevIssInnerTokenString(norm);
  if (!inner) return '';
  return `sheetRevIssDoc[${inner}]`;
}

export function formatSheetRevIssExportListingSegmentV1(
  norm: TitleblockRevisionIssueNormV1,
): string {
  const inner = buildRevIssInnerTokenString(norm);
  if (!inner) return '';
  return `sheetRevIssList[${inner}]`;
}

export function sheetRevisionIssueMetadataPresent(norm: TitleblockRevisionIssueNormV1): boolean {
  return Boolean(norm.revisionId || norm.revisionCode);
}

export function buildSheetTitleblockRevisionIssueManifestV1FromNorm(
  norm: TitleblockRevisionIssueNormV1,
): Record<string, string> {
  const d8 = revisionDescriptionDigestPrefix8(norm.revisionDescription);
  return {
    format: SHEET_TITLEBLOCK_REVISION_ISSUE_MANIFEST_V1,
    revisionId: norm.revisionId,
    revisionCode: norm.revisionCode,
    revisionDate: norm.revisionDate,
    revisionDescription: norm.revisionDescription,
    issueStatus: norm.issueStatus,
    revisionDescriptionDigestPrefix8: d8,
    titleblockDisplaySegment: formatSheetRevIssTitleblockDisplaySegmentV1(norm),
    exportListingSegment: formatSheetRevIssExportListingSegmentV1(norm),
  };
}
