import type { Element } from '@bim-ai/core';

export type SheetIntentTag = 'documentation' | 'moodboard' | 'hybrid';

const SHEET_INTENT_SET = new Set<SheetIntentTag>(['documentation', 'moodboard', 'hybrid']);

export function normalizeSheetIntent(raw: unknown): SheetIntentTag | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (SHEET_INTENT_SET.has(value as SheetIntentTag)) return value as SheetIntentTag;
  if (value === 'doc' || value === 'docs') return 'documentation';
  if (value === 'mood-board' || value === 'mood board') return 'moodboard';
  return null;
}

export function readSheetIntent(sheet: Extract<Element, { kind: 'sheet' }>): SheetIntentTag {
  const tp = sheet.titleblockParameters ?? {};
  return (
    normalizeSheetIntent(tp.sheetIntent ?? tp.sheet_intent ?? tp.intent ?? null) ?? 'documentation'
  );
}

export function sheetIntentLabel(intent: SheetIntentTag): string {
  if (intent === 'moodboard') return 'Moodboard';
  if (intent === 'hybrid') return 'Hybrid';
  return 'Documentation';
}

export function sheetIntentPatchJson(intent: SheetIntentTag): string {
  return JSON.stringify({ sheetIntent: intent });
}
