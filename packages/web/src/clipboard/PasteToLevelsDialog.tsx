import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Element } from '@bim-ai/core';

import { readClipboardSync } from './clipboardStore';
import { buildCopyToLevelsCommands } from './copyToLevels';

type LevelEl = Extract<Element, { kind: 'level' }>;
type CommandDispatcher = (cmd: Record<string, unknown>) => void | Promise<void>;

export function PasteToLevelsDialog({
  open,
  onClose,
  elementsById,
  activeLevelId,
  selectedElementIds,
  onSemanticCommand,
}: {
  open: boolean;
  onClose: () => void;
  elementsById: Record<string, Element>;
  activeLevelId: string | null | undefined;
  selectedElementIds: string[];
  onSemanticCommand: CommandDispatcher;
}): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [checkedLevelIds, setCheckedLevelIds] = useState<Set<string>>(new Set());

  const levels = useMemo(() => {
    return (Object.values(elementsById) as Element[])
      .filter((e): e is LevelEl => e.kind === 'level')
      .filter((l) => l.id !== activeLevelId)
      .sort((a, b) => a.elevationMm - b.elevationMm);
  }, [elementsById, activeLevelId]);

  useEffect(() => {
    if (open) setCheckedLevelIds(new Set());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const toggleLevel = useCallback((id: string) => {
    setCheckedLevelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handlePaste = useCallback(async () => {
    const payload = readClipboardSync();
    const elementIds =
      selectedElementIds.length > 0
        ? selectedElementIds
        : (payload?.elements.map((e) => e.id) ?? []);
    const sourceLevelId =
      activeLevelId ??
      (payload?.elements.find((e) => (e as Record<string, unknown>)['levelId'])?.[
        'levelId' as never
      ] as string | undefined) ??
      '';

    const cmds = buildCopyToLevelsCommands(elementIds, sourceLevelId, Array.from(checkedLevelIds));
    for (const cmd of cmds) {
      await onSemanticCommand(cmd as unknown as Record<string, unknown>);
    }
    onClose();
  }, [selectedElementIds, activeLevelId, checkedLevelIds, onSemanticCommand, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      data-testid="paste-to-levels-overlay"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Paste Aligned to Selected Levels"
        className="w-full max-w-sm rounded border border-border bg-surface p-4 shadow-elev-2"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-sm font-semibold text-foreground">Paste Aligned to Levels</h2>
        {levels.length === 0 ? (
          <p className="text-sm text-muted" data-testid="paste-to-levels-no-levels">
            No other levels available.
          </p>
        ) : (
          <ul className="max-h-60 space-y-1 overflow-y-auto" data-testid="paste-to-levels-list">
            {levels.map((level) => (
              <li key={level.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface-strong">
                  <input
                    type="checkbox"
                    checked={checkedLevelIds.has(level.id)}
                    onChange={() => toggleLevel(level.id)}
                    data-testid={`paste-to-levels-check-${level.id}`}
                  />
                  <span>{level.name}</span>
                  <span className="ml-auto text-xs text-muted">
                    {(level.elevationMm / 1000).toFixed(2)}m
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border px-3 py-1 text-sm hover:bg-surface-strong"
            data-testid="paste-to-levels-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handlePaste()}
            disabled={checkedLevelIds.size === 0}
            className="rounded bg-accent px-3 py-1 text-sm text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="paste-to-levels-confirm"
          >
            Paste to {checkedLevelIds.size || ''} Level{checkedLevelIds.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
