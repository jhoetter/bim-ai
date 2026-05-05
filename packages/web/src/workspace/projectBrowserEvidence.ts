import type { Element } from '@bim-ai/core';

import { sheetsReferencingSectionCut } from './sheetViewRef';

/** Monospace subtitle token for pinned plan_view level (no new kernel fields). */

export function planLevelEvidenceToken(
  elementsById: Record<string, Element>,
  levelId: string,
): string {
  const l = elementsById[levelId];
  if (l?.kind === 'level') return `level=${l.name}`;
  return `level=${levelId}`;
}

export function siteProjectBrowserEvidenceLine(
  elementsById: Record<string, Element>,
  site: Extract<Element, { kind: 'site' }>,
): string {
  const n = site.boundaryMm?.length ?? 0;
  const ctxCount = site.contextObjects?.length ?? 0;
  const lid = site.referenceLevelId;
  const l = elementsById[lid];
  const lvl = l?.kind === 'level' ? l.name : lid;
  return `boundaryVerts=${n} · context=${ctxCount} · refLevel=${lvl}`;
}

const TITLEBLOCK_PREVIEW_MAX = 24;

/** Titleblock slot: trimmed symbol/name or ∅ when blank. */

function titleblockToken(sheet: Extract<Element, { kind: 'sheet' }>): string {
  const raw = sheet.titleBlock?.trim();
  if (!raw) return '∅';
  return raw.length > TITLEBLOCK_PREVIEW_MAX ? `${raw.slice(0, TITLEBLOCK_PREVIEW_MAX - 1)}…` : raw;
}

export function sheetProjectBrowserEvidenceLine(
  sheet: Extract<Element, { kind: 'sheet' }>,
): string {
  const tb = titleblockToken(sheet);
  const vps = Array.isArray(sheet.viewportsMm) ? sheet.viewportsMm.length : 0;
  const pKeys = sheet.titleblockParameters ? Object.keys(sheet.titleblockParameters).length : 0;
  const pw = sheet.paperWidthMm;
  const ph = sheet.paperHeightMm;
  const paperOk =
    pw != null &&
    ph != null &&
    typeof pw === 'number' &&
    typeof ph === 'number' &&
    Number.isFinite(pw) &&
    Number.isFinite(ph);
  const paper = paperOk ? `${pw}×${ph}mm` : '';
  const parts = [`titleBlock=${tb}`, `viewports=${vps}`, `tbParams=${pKeys}`];
  if (paper) parts.push(`paper=${paper}`);
  return parts.join(' · ');
}

function recordKeyCount(rec?: Record<string, unknown>): number {
  return rec != null ? Object.keys(rec).length : 0;
}

export function scheduleProjectBrowserEvidenceLine(
  elementsById: Record<string, Element>,
  sch: Extract<Element, { kind: 'schedule' }>,
): string {
  const sid = sch.sheetId;
  let placement = 'sheet=∅';
  if (sid != null && sid !== '') {
    const sh = elementsById[sid];
    placement = sh?.kind === 'sheet' ? `sheet=${sh.name ?? sid}` : `sheetRef=${sid}`;
  }
  const fk = recordKeyCount(sch.filters);
  const gk = recordKeyCount(sch.grouping);
  return `${placement} · filterKeys=${fk} · groupKeys=${gk}`;
}

const SECTION_SHEET_HINT_MAX = 120;

export function sectionCutProjectBrowserEvidenceLine(
  elementsById: Record<string, Element>,
  sc: Extract<Element, { kind: 'section_cut' }>,
): string {
  const depth =
    sc.cropDepthMm != null && typeof sc.cropDepthMm === 'number' && Number.isFinite(sc.cropDepthMm)
      ? `cropDepthMm=${sc.cropDepthMm}`
      : null;
  const pathN = sc.segmentedPathMm?.length ?? 0;
  const pathTok = pathN > 0 ? `pathVerts=${pathN}` : null;

  const sheetRows = sheetsReferencingSectionCut(elementsById, sc.id);
  let sheetsTok: string;
  if (sheetRows.length === 0) sheetsTok = 'sheetHosts=0';
  else {
    const labels = sheetRows.slice(0, 2).map((r) => `${r.sheetName}(${r.viewRefNormalized})`);
    let inner = labels.join('; ');
    if (sheetRows.length > 2) inner += `; +${sheetRows.length - 2}`;
    sheetsTok = `sheetHosts=${inner}`;
    if (sheetsTok.length > SECTION_SHEET_HINT_MAX) {
      const first = sheetRows[0];
      sheetsTok = `sheetHosts=${sheetRows.length}·first=${first!.sheetName}(${first!.viewRefNormalized})`;
      if (sheetsTok.length > SECTION_SHEET_HINT_MAX) {
        sheetsTok = `${sheetsTok.slice(0, SECTION_SHEET_HINT_MAX - 1)}…`;
      }
    }
  }

  const parts = [depth, pathTok, sheetsTok].filter((x): x is string => x != null && x !== '');
  return parts.join(' · ');
}

export function sectionCutBrowserTooltipTitle(
  elementsById: Record<string, Element>,
  sc: Extract<Element, { kind: 'section_cut' }>,
): string {
  const base = `section_cut · ${sc.name}`;
  const line = sectionCutProjectBrowserEvidenceLine(elementsById, sc);
  return `${base} · ${line}`;
}
