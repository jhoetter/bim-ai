#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const TRACKER_PATH = path.join(
  REPO_ROOT,
  'spec',
  'bim-integrity-rendering-sketch-methodology-tracker.md',
);
const DEFAULT_OUT_PATH = path.join(
  REPO_ROOT,
  'spec',
  'generated',
  'bim-integrity-tracker-status.md',
);

const VALID_STATUSES = new Set(['Done', 'Partial', 'Not started', 'Blocked']);
const VALID_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const ITEM_ID_RE = /BIR-([A-Z])(\d{2})/g;
const WAVE7_ACCOUNTING_SECTIONS = new Set(['T', 'U', 'V', 'W']);
const REQUIRED_DONE_EVIDENCE_FIELDS = [
  ['codePaths', 'code paths'],
  ['tests', 'tests'],
  ['evidenceArtifacts', 'evidence artifacts'],
  ['commit', 'commit/wave reference'],
  ['limitations', 'limitations'],
];
const REQUIRED_WAVE_CLOSEOUTS = [
  {
    wave: 'W24-E',
    path: 'seed-artifacts/target-house-1/evidence/phase-p1-p7-all/wave-closeout.json',
    trackerItems: [
      'BIR-F03',
      'BIR-F04',
      'BIR-F06',
      'BIR-M07',
      'BIR-M08',
      'BIR-M09',
      'BIR-M10',
      'BIR-N10',
      'BIR-O04',
      'BIR-T01',
      'BIR-T04',
      'BIR-T05',
      'BIR-W04',
    ],
  },
];

function parseArgs(argv) {
  const args = {
    trackerPath: TRACKER_PATH,
    outPath: DEFAULT_OUT_PATH,
    check: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--tracker') args.trackerPath = path.resolve(argv[++index]);
    else if (arg === '--out') args.outPath = path.resolve(argv[++index]);
    else if (arg === '--check') args.check = true;
    else if (arg === '--json') args.json = true;
    else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function makeEmptyStatusCounts() {
  return Object.fromEntries([...VALID_STATUSES].map((status) => [status, 0]));
}

function makeEmptyPriorityCounts() {
  return Object.fromEntries([...VALID_PRIORITIES].map((priority) => [priority, 0]));
}

function percent(done, total) {
  if (!total) return '0.0%';
  return `${((done / total) * 100).toFixed(1)}%`;
}

function escapeCell(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .trim();
}

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

function parseMarkdownTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  if (/^\|\s*-+\s*\|/.test(trimmed)) return null;
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function expandRange(fromId, toId) {
  const from = /^BIR-([A-Z])(\d{2})$/.exec(fromId);
  const to = /^BIR-([A-Z])(\d{2})$/.exec(toId);
  if (!from || !to || from[1] !== to[1]) return [fromId, toId];
  const ids = [];
  const start = Number(from[2]);
  const end = Number(to[2]);
  const step = start <= end ? 1 : -1;
  for (let value = start; step > 0 ? value <= end : value >= end; value += step) {
    ids.push(`BIR-${from[1]}${String(value).padStart(2, '0')}`);
  }
  return ids;
}

function extractItemIds(text) {
  const ids = [];
  const rangeRe = /`(BIR-[A-Z]\d{2})`\s+through\s+`(BIR-[A-Z]\d{2})`/g;
  let rangeMatch;
  const consumedRanges = [];
  while ((rangeMatch = rangeRe.exec(text))) {
    ids.push(...expandRange(rangeMatch[1], rangeMatch[2]));
    consumedRanges.push([rangeMatch.index, rangeMatch.index + rangeMatch[0].length]);
  }

  const isConsumed = (index) =>
    consumedRanges.some(([start, end]) => index >= start && index < end);
  let match;
  ITEM_ID_RE.lastIndex = 0;
  while ((match = ITEM_ID_RE.exec(text))) {
    const id = `BIR-${match[1]}${match[2]}`;
    if (!isConsumed(match.index)) ids.push(id);
  }
  return [...new Set(ids)];
}

function parseTracker(markdown) {
  const lines = markdown.split(/\r?\n/);
  const items = [];
  const evidenceRows = [];
  const milestones = [];
  const duplicateIds = [];
  const invalidRows = [];
  const seen = new Set();
  const waves = [];
  let section = null;
  let currentWave = null;
  let implementationEvidenceTable = false;

  for (let lineNumber = 1; lineNumber <= lines.length; lineNumber += 1) {
    const line = lines[lineNumber - 1];
    if (/^##\s+Implementation Evidence Rows\s*$/.test(line)) {
      implementationEvidenceTable = true;
      section = null;
      currentWave = null;
      continue;
    }
    if (implementationEvidenceTable && /^##\s+/.test(line)) {
      implementationEvidenceTable = false;
    }

    const itemSection = /^###\s+([A-Z])\.\s+(.+)$/.exec(line);
    if (itemSection) {
      section = {
        key: itemSection[1],
        title: itemSection[2].trim(),
      };
      currentWave = null;
      continue;
    }

    const waveSection = /^###\s+Wave\s+(\d+):\s+(.+)$/.exec(line);
    if (waveSection) {
      currentWave = {
        wave: `Wave ${waveSection[1]}`,
        number: Number(waveSection[1]),
        title: waveSection[2].trim(),
        milestone: null,
        ids: new Set(),
      };
      waves.push(currentWave);
      section = null;
      continue;
    }

    if (currentWave) {
      const goalMatch = /Goal:\s+close\s+`(M\d+)`/.exec(line);
      if (goalMatch) currentWave.milestone = goalMatch[1];
    }

    const cells = parseMarkdownTableRow(line);
    if (!cells) continue;

    if (implementationEvidenceTable && /^`BIR-[A-Z]\d{2}`$/.test(cells[0] ?? '')) {
      evidenceRows.push({
        id: cells[0].replaceAll('`', ''),
        codePaths: cells[1] ?? '',
        tests: cells[2] ?? '',
        evidenceArtifacts: cells[3] ?? '',
        commit: cells[4] ?? '',
        limitations: cells[5] ?? '',
        lineNumber,
      });
      continue;
    }

    if (/^`BIR-[A-Z]\d{2}`$/.test(cells[0] ?? '')) {
      const id = cells[0].replaceAll('`', '');
      const priority = cells[1] ?? '';
      const status = cells[2] ?? '';
      const row = {
        id,
        priority,
        status,
        item: cells[3] ?? '',
        acceptance: cells[4] ?? '',
        sectionKey: section?.key ?? 'unknown',
        sectionTitle: section?.title ?? 'Unknown',
        lineNumber,
      };
      if (seen.has(id)) duplicateIds.push(row);
      seen.add(id);
      if (!VALID_PRIORITIES.has(priority)) {
        invalidRows.push(`${id} line ${lineNumber}: invalid priority ${priority}`);
      }
      if (!VALID_STATUSES.has(status)) {
        invalidRows.push(`${id} line ${lineNumber}: invalid status ${status}`);
      }
      items.push(row);
      continue;
    }

    if (/^`M\d+`/.test(cells[0] ?? '')) {
      const first = cells[0].replaceAll('`', '');
      const milestoneMatch = /^(M\d+)\s*(.*)$/.exec(first);
      const id = milestoneMatch?.[1];
      const title = (milestoneMatch?.[2] ?? '').trim();
      const status = cells[1] ?? '';
      if (id) {
        if (!VALID_STATUSES.has(status)) {
          invalidRows.push(`${id} line ${lineNumber}: invalid milestone status ${status}`);
        }
        milestones.push({
          id,
          title,
          status,
          exitCriteria: cells[2] ?? '',
          lineNumber,
        });
      }
      continue;
    }

    if (currentWave && cells.length >= 3 && /^\w/.test(cells[0] ?? '')) {
      for (const id of extractItemIds(cells.join(' | '))) currentWave.ids.add(id);
    }
  }

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const unknownWaveRefs = [];
  const milestoneByItem = new Map();
  for (const wave of waves) {
    for (const id of wave.ids) {
      if (!itemsById.has(id)) unknownWaveRefs.push(`${wave.wave} references missing ${id}`);
      if (wave.milestone && !milestoneByItem.has(id)) milestoneByItem.set(id, wave.milestone);
    }
  }

  return {
    items,
    evidenceRows,
    milestones,
    waves: waves.map((wave) => ({ ...wave, ids: [...wave.ids].sort() })),
    duplicateIds,
    invalidRows,
    unknownWaveRefs,
    milestoneByItem,
  };
}

function countItems(items) {
  const statusCounts = makeEmptyStatusCounts();
  const priorityCounts = makeEmptyPriorityCounts();
  const statusByPriority = {};
  const statusBySection = {};

  for (const item of items) {
    increment(statusCounts, item.status);
    increment(priorityCounts, item.priority);
    statusByPriority[item.priority] ??= makeEmptyStatusCounts();
    increment(statusByPriority[item.priority], item.status);

    const sectionId = `${item.sectionKey}. ${item.sectionTitle}`;
    statusBySection[sectionId] ??= makeEmptyStatusCounts();
    increment(statusBySection[sectionId], item.status);
  }

  return {
    statusCounts,
    priorityCounts,
    statusByPriority,
    statusBySection,
    total: items.length,
    done: statusCounts.Done,
  };
}

function buildMilestoneRollups(parsed) {
  const rollups = {};
  for (const milestone of parsed.milestones) {
    rollups[milestone.id] = {
      ...makeEmptyStatusCounts(),
      id: milestone.id,
      title: milestone.title,
      milestoneStatus: milestone.status,
      total: 0,
      donePercent: '0.0%',
      unmapped: true,
    };
  }
  for (const item of parsed.items) {
    const milestoneId = parsed.milestoneByItem.get(item.id);
    if (!milestoneId) continue;
    rollups[milestoneId] ??= {
      ...makeEmptyStatusCounts(),
      id: milestoneId,
      title: '',
      milestoneStatus: 'Not started',
      total: 0,
      donePercent: '0.0%',
      unmapped: false,
    };
    const rollup = rollups[milestoneId];
    rollup.unmapped = false;
    rollup.total += 1;
    increment(rollup, item.status);
  }
  for (const rollup of Object.values(rollups)) {
    rollup.donePercent = percent(rollup.Done, rollup.total);
  }
  return rollups;
}

function hasMeaningfulCell(value) {
  const normalized = String(value ?? '').trim();
  return Boolean(normalized) && normalized !== '-' && normalized.toLowerCase() !== 'n/a';
}

function buildEvidenceAccounting(parsed) {
  const evidenceById = new Map();
  const duplicateEvidenceRows = [];
  for (const row of parsed.evidenceRows) {
    if (evidenceById.has(row.id)) duplicateEvidenceRows.push(row);
    evidenceById.set(row.id, row);
  }

  const missingDoneEvidence = [];
  for (const item of parsed.items) {
    if (item.status !== 'Done') continue;
    const evidence = evidenceById.get(item.id);
    const missingFields = [];
    if (!evidence) {
      missingFields.push(...REQUIRED_DONE_EVIDENCE_FIELDS.map(([, label]) => label));
    } else {
      for (const [field, label] of REQUIRED_DONE_EVIDENCE_FIELDS) {
        if (!hasMeaningfulCell(evidence[field])) missingFields.push(label);
      }
    }
    if (missingFields.length) {
      missingDoneEvidence.push({ ...item, missingFields });
    }
  }

  return {
    rows: parsed.evidenceRows,
    evidenceById,
    duplicateEvidenceRows,
    missingDoneEvidence,
  };
}

function buildWave7DashboardRows(parsed, evidenceAccounting) {
  return parsed.items
    .filter((item) => WAVE7_ACCOUNTING_SECTIONS.has(item.sectionKey))
    .map((item) => {
      const evidence = evidenceAccounting.evidenceById.get(item.id);
      return {
        id: item.id,
        section: `${item.sectionKey}. ${item.sectionTitle}`,
        priority: item.priority,
        status: item.status,
        item: item.item,
        acceptance: item.acceptance,
        evidenceState: evidence
          ? hasMeaningfulCell(evidence.tests)
            ? 'linked'
            : 'missing tests'
          : 'missing',
        tests: evidence?.tests ?? '',
      };
    });
}

function buildWaveCloseoutAccounting() {
  const rows = [];
  const validationErrors = [];
  for (const requirement of REQUIRED_WAVE_CLOSEOUTS) {
    const absPath = path.join(REPO_ROOT, requirement.path);
    if (!fs.existsSync(absPath)) {
      rows.push({ ...requirement, status: 'missing', blocker: 'missing_wave_closeout_artifact' });
      validationErrors.push(`${requirement.wave}: missing generated closeout artifact ${requirement.path}`);
      continue;
    }
    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    } catch {
      rows.push({ ...requirement, status: 'invalid', blocker: 'invalid_json' });
      validationErrors.push(`${requirement.wave}: closeout artifact is not valid JSON`);
      continue;
    }
    const artifactItems = Array.isArray(payload.trackerItems) ? payload.trackerItems : [];
    const missingTrackerItems = requirement.trackerItems.filter((id) => !artifactItems.includes(id));
    const schemaOk = payload.schemaVersion === 'target-house-wave-closeout.v1';
    const waveOk = payload.wave === requirement.wave;
    const ok = schemaOk && waveOk && missingTrackerItems.length === 0;
    if (!ok) {
      validationErrors.push(
        `${requirement.wave}: closeout artifact incomplete (${[
          schemaOk ? '' : 'schema',
          waveOk ? '' : 'wave',
          missingTrackerItems.length ? `missing ${missingTrackerItems.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('; ')})`,
      );
    }
    rows.push({
      ...requirement,
      status: ok ? 'attached' : 'invalid',
      blocker: ok ? '' : 'invalid_wave_closeout_artifact',
      missingTrackerItems,
    });
  }
  return { rows, validationErrors };
}

function buildReport(parsed, trackerPath) {
  const counts = countItems(parsed.items);
  const milestoneRollups = buildMilestoneRollups(parsed);
  const evidenceAccounting = buildEvidenceAccounting(parsed);
  const waveCloseoutAccounting = buildWaveCloseoutAccounting();
  const validationErrors = [
    ...parsed.invalidRows,
    ...parsed.duplicateIds.map((row) => `${row.id} line ${row.lineNumber}: duplicate id`),
    ...evidenceAccounting.duplicateEvidenceRows.map(
      (row) => `${row.id} line ${row.lineNumber}: duplicate implementation evidence row`,
    ),
    ...evidenceAccounting.missingDoneEvidence.map(
      (row) =>
        `${row.id} line ${row.lineNumber}: Done item lacks complete implementation evidence row (${row.missingFields.join(
          ', ',
        )})`,
    ),
    ...parsed.unknownWaveRefs,
    ...waveCloseoutAccounting.validationErrors,
  ];
  const unmappedItems = parsed.items.filter((item) => !parsed.milestoneByItem.has(item.id));
  const wave7DashboardRows = buildWave7DashboardRows(parsed, evidenceAccounting);

  return {
    trackerPath,
    sourceDigest: createHash('sha256')
      .update(fs.readFileSync(trackerPath, 'utf8'))
      .digest('hex')
      .slice(0, 16),
    sourceLastUpdated:
      /^Last updated:\s*(.+)$/m.exec(fs.readFileSync(trackerPath, 'utf8'))?.[1]?.trim() ??
      'unknown',
    counts,
    milestones: milestoneRollups,
    sections: counts.statusBySection,
    priorities: counts.statusByPriority,
    unmappedItems,
    validationErrors,
    evidenceAccounting: {
      totalRows: evidenceAccounting.rows.length,
      doneItemsWithEvidence:
        parsed.items.filter((item) => item.status === 'Done').length -
        evidenceAccounting.missingDoneEvidence.length,
      missingDoneEvidence: evidenceAccounting.missingDoneEvidence.map((row) => ({
        id: row.id,
        missingFields: row.missingFields,
      })),
      duplicateEvidenceRows: evidenceAccounting.duplicateEvidenceRows.map((row) => row.id),
    },
    waveCloseoutAccounting,
    wave7DashboardRows,
  };
}

function renderCountRow(label, counts) {
  const total =
    (counts.Done ?? 0) +
    (counts.Partial ?? 0) +
    (counts['Not started'] ?? 0) +
    (counts.Blocked ?? 0);
  return `| ${escapeCell(label)} | ${total} | ${counts.Done ?? 0} | ${counts.Partial ?? 0} | ${counts['Not started'] ?? 0} | ${counts.Blocked ?? 0} | ${percent(counts.Done ?? 0, total)} |`;
}

function renderMarkdown(report) {
  const relTracker = path.relative(REPO_ROOT, report.trackerPath);
  const lines = [
    '# BIM Integrity Tracker Status',
    '',
    '<!-- generated by scripts/audit-bim-integrity-tracker.mjs; do not edit by hand -->',
    '',
    `Source last updated: ${report.sourceLastUpdated}`,
    `Source digest: \`${report.sourceDigest}\``,
    `Source: \`${relTracker}\``,
    '',
    '## Overall',
    '',
    '| Items | Done | Partial | Not started | Blocked | Complete |',
    '| ----- | ---- | ------- | ----------- | ------- | -------- |',
    `| ${report.counts.total} | ${report.counts.statusCounts.Done} | ${report.counts.statusCounts.Partial} | ${report.counts.statusCounts['Not started']} | ${report.counts.statusCounts.Blocked} | ${percent(report.counts.done, report.counts.total)} |`,
    '',
    '## By Priority',
    '',
    '| Priority | Items | Done | Partial | Not started | Blocked | Complete |',
    '| -------- | ----- | ---- | ------- | ----------- | ------- | -------- |',
  ];

  for (const priority of [...VALID_PRIORITIES]) {
    lines.push(renderCountRow(priority, report.priorities[priority] ?? makeEmptyStatusCounts()));
  }

  lines.push(
    '',
    '## By Tracker Section',
    '',
    '| Section | Items | Done | Partial | Not started | Blocked | Complete |',
    '| ------- | ----- | ---- | ------- | ----------- | ------- | -------- |',
  );
  for (const [section, counts] of Object.entries(report.sections)) {
    lines.push(renderCountRow(section, counts));
  }

  lines.push(
    '',
    '## By Milestone / Wave Mapping',
    '',
    '| Milestone | Milestone status | Mapped items | Done | Partial | Not started | Blocked | Item complete |',
    '| --------- | ---------------- | ------------ | ---- | ------- | ----------- | ------- | ------------- |',
  );
  for (const milestoneId of Object.keys(report.milestones).sort((a, b) => {
    return Number(a.slice(1)) - Number(b.slice(1));
  })) {
    const row = report.milestones[milestoneId];
    lines.push(
      `| \`${milestoneId}\` ${escapeCell(row.title)} | ${row.milestoneStatus} | ${row.total} | ${row.Done} | ${row.Partial} | ${row['Not started']} | ${row.Blocked} | ${row.donePercent} |`,
    );
  }

  const wave7Counts = countItems(report.wave7DashboardRows);
  lines.push(
    '',
    '## Wave 7 Feature Coverage Dashboard Data',
    '',
    'Rows in this section are generated from tracker sections T-W so agents can see provenance, UX/noise, family/content, fixture, and completion-accounting coverage without hand-counting the tracker.',
    '',
    '| Scope | Items | Done | Partial | Not started | Blocked | Complete |',
    '| ----- | ----- | ---- | ------- | ----------- | ------- | -------- |',
    renderCountRow('BIR-T through BIR-W', wave7Counts.statusCounts),
    '',
    '| ID | Priority | Status | Evidence | Tests / proof hook | Item |',
    '| -- | -------- | ------ | -------- | ------------------ | ---- |',
  );
  for (const row of report.wave7DashboardRows) {
    lines.push(
      `| \`${row.id}\` | ${row.priority} | ${row.status} | ${row.evidenceState} | ${escapeCell(row.tests || 'None linked')} | ${escapeCell(row.item)} |`,
    );
  }

  lines.push(
    '',
    '## Wave Closeout Automation',
    '',
    'Generated closeout artifacts are required for parent-wave rows before the wave can be called closed.',
    '',
    '| Wave | Status | Artifact | Required tracker items |',
    '| ---- | ------ | -------- | ---------------------- |',
  );
  for (const row of report.waveCloseoutAccounting.rows) {
    lines.push(
      `| ${row.wave} | ${row.status} | \`${escapeCell(row.path)}\` | ${row.trackerItems.length} |`,
    );
  }

  lines.push(
    '',
    '## Implementation Evidence Accounting',
    '',
    `Evidence rows: ${report.evidenceAccounting.totalRows}`,
    `Done items with required evidence/tests: ${report.evidenceAccounting.doneItemsWithEvidence}`,
    `Done items missing required evidence/tests: ${report.evidenceAccounting.missingDoneEvidence.length}`,
    '',
  );
  if (report.evidenceAccounting.missingDoneEvidence.length) {
    for (const row of report.evidenceAccounting.missingDoneEvidence) {
      lines.push(`- \`${row.id}\` is Done but lacks: ${escapeCell(row.missingFields.join(', '))}.`);
    }
  } else {
    lines.push(
      '- Done quality gate passed: every Done item has complete implementation evidence columns.',
    );
  }

  lines.push(
    '',
    '## Validation',
    '',
    `Duplicate ids: ${report.validationErrors.filter((e) => e.includes('duplicate id')).length}`,
    `Invalid rows / missing wave references: ${report.validationErrors.length}`,
    '',
  );
  if (report.validationErrors.length) {
    for (const error of report.validationErrors) lines.push(`- ${error}`);
  } else {
    lines.push(
      '- No duplicate ids, invalid statuses, invalid priorities, or missing wave references found.',
    );
  }

  lines.push(
    '',
    '## Unmapped Items',
    '',
    'Items listed here are valid tracker rows but are not currently assigned to a proposed milestone wave.',
    '',
  );
  if (report.unmappedItems.length) {
    for (const item of report.unmappedItems) {
      lines.push(`- \`${item.id}\` ${item.priority} ${item.status}: ${item.item}`);
    }
  } else {
    lines.push('- None.');
  }

  lines.push('');
  return `${lines.join('\n')}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const markdown = fs.readFileSync(args.trackerPath, 'utf8');
  const parsed = parseTracker(markdown);
  const report = buildReport(parsed, args.trackerPath);
  const rendered = renderMarkdown(report);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  }

  if (args.check) {
    const existing = fs.existsSync(args.outPath) ? fs.readFileSync(args.outPath, 'utf8') : '';
    if (existing !== rendered) {
      console.error(
        `${path.relative(REPO_ROOT, args.outPath)} is stale. Run this script without --check.`,
      );
      process.exit(1);
    }
  } else {
    fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
    fs.writeFileSync(args.outPath, rendered);
  }

  if (report.validationErrors.length) {
    for (const error of report.validationErrors) console.error(`- ${error}`);
    console.error(`Tracker audit found ${report.validationErrors.length} validation issue(s).`);
    process.exit(1);
  }

  console.log(
    `BIM integrity tracker: ${report.counts.done}/${report.counts.total} done (${percent(
      report.counts.done,
      report.counts.total,
    )}).`,
  );
}

main();
