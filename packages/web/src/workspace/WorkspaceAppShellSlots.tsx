import type { JSX } from 'react';
import type { Participant } from '@bim-ai/core';
import { WallHifi } from '@bim-ai/icons';
import { Icons } from '@bim-ai/ui';

import { getRegistry } from '../cmdPalette/registry';
import { canvasContainerStyle } from './viewport';
import type { PaneNode } from './paneLayout';
import { CompositionBar, type WorkspaceCompositionState } from './compositions';
import { EmptyStateHint, ParticipantStrip, StatusBar } from './shell';
import type { StatusBarProps } from './shell/StatusBar';
import { DegradedModeBadge } from './shell/DegradedModeBadge';
import { EmptyStateOverlay } from './WorkspaceHelpers';
import { QuickAccessToolbar } from './QuickAccessToolbar';

type CompositionHandlers = {
  onActivate: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onRename: (id: string, label: string) => void;
};

export interface WorkspaceHeaderSlotProps extends CompositionHandlers {
  compositionState: WorkspaceCompositionState;
  loadingCompositionId: string | null;
  activeSeedLabel: string | null | undefined;
  activePlanViewName: string | undefined;
  sheetPagesCount: number;
  presenceParticipants: Participant[];
  presenceLocalUserId: string | null | undefined;
  userId: string | null | undefined;
  onSharePresentation: () => void;
  onOpenCommandPalette: () => void;
  onToggleComments: () => void;
}

export function WorkspaceHeaderSlot({
  compositionState,
  loadingCompositionId,
  activeSeedLabel,
  activePlanViewName,
  sheetPagesCount,
  presenceParticipants,
  presenceLocalUserId,
  userId,
  onSharePresentation,
  onOpenCommandPalette,
  onToggleComments,
  onActivate,
  onCreate,
  onClose,
  onReorder,
  onRename,
}: WorkspaceHeaderSlotProps): JSX.Element {
  return (
    <div
      data-testid="workspace-header"
      className="flex min-h-[44px] w-full min-w-0 items-center gap-2 bg-surface px-2"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <CompositionBar
          compositions={compositionState.compositions}
          activeId={compositionState.activeId}
          loadingId={loadingCompositionId}
          onActivate={onActivate}
          onCreate={onCreate}
          onClose={onClose}
          onReorder={onReorder}
          onRename={onRename}
        />
        {activePlanViewName && (
          <div
            data-testid="workspace-view-breadcrumb"
            style={{
              fontSize: 10,
              color: 'var(--text-muted, #888)',
              padding: '0 12px 2px',
              lineHeight: 1,
              userSelect: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeSeedLabel ?? 'bim-ai'} / {activePlanViewName}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          data-testid="workspace-header-share"
          onClick={onSharePresentation}
          disabled={sheetPagesCount === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-surface px-2 text-xs font-medium text-foreground hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45"
          title={
            sheetPagesCount > 0
              ? 'Share presentation'
              : 'Create a sheet before sharing a presentation'
          }
        >
          <Icons.externalLink size={14} aria-hidden="true" />
          <span>Share</span>
        </button>
        <button
          type="button"
          data-testid="workspace-header-cmdk"
          onClick={onOpenCommandPalette}
          className="inline-flex h-8 min-w-[150px] items-center gap-2 rounded border border-border bg-background px-2 text-left text-xs text-muted hover:bg-surface-2 hover:text-foreground"
          aria-label="Open command palette"
        >
          <Icons.commandPalette size={14} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Search or press</span>
          <kbd className="rounded border border-border bg-surface px-1 py-0.5 text-[10px]">⌘K</kbd>
        </button>
        {presenceParticipants.length > 0 ? (
          <ParticipantStrip
            participants={presenceParticipants}
            localUserId={presenceLocalUserId ?? userId ?? ''}
            maxVisible={3}
            avatarSize={20}
            onClick={onToggleComments}
            buttonLabel="Open collaboration comments"
            title="Open collaboration comments"
            testId="workspace-header-participants"
          />
        ) : (
          <button
            type="button"
            data-testid="workspace-header-participants"
            onClick={onToggleComments}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Open collaboration comments"
            title="Open collaboration comments"
          >
            <Icons.collaborators size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export interface WorkspaceCanvasSlotProps {
  activeViewKind: string | null | undefined;
  showEmptyStateOverlay: boolean;
  showCanvasHint: boolean;
  emptyHint: {
    headline: string;
    hint: string;
    cta?: { label?: string | null } | null;
  };
  seedLoading: boolean;
  seedError: string | null | undefined;
  /**
   * Issue #124 — MF-render-11. Set to `true` once the model snapshot has
   * streamed in and the viewport has geometry to render (or the model is
   * legitimately empty and the empty-state overlay is showing the CTA, not
   * the "Loading model…" overlay). Drives `data-bim-model-status`, which the
   * Playwright capture runner waits on before screenshotting an ortho view.
   */
  modelReady: boolean;
  onInsertSeedHouse: () => void | Promise<void>;
  paneRoot: PaneNode;
  renderPaneNode: (node: PaneNode) => JSX.Element;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
}

export function WorkspaceCanvasSlot({
  activeViewKind,
  showEmptyStateOverlay,
  showCanvasHint,
  emptyHint,
  seedLoading,
  seedError,
  modelReady,
  onInsertSeedHouse,
  paneRoot,
  renderPaneNode,
  onSemanticCommand,
}: WorkspaceCanvasSlotProps): JSX.Element {
  // Issue #124 — emit machine-readable status so the Playwright capture
  // runner can wait for geometry-stream completion before screenshotting.
  // `loading` covers both "seed fetch in flight" and "snapshot has not yet
  // hydrated any geometry"; `ready` is set as soon as the viewport has
  // something to render.
  const modelStatus = modelReady ? 'ready' : 'loading';
  return (
    <div
      style={{
        ...canvasContainerStyle,
        background: ['plan', 'section', 'elevation'].includes(activeViewKind ?? '')
          ? 'var(--color-canvas-paper)'
          : 'var(--color-background)',
        transition: 'background 120ms var(--ease-paper)',
      }}
      data-view-type={activeViewKind ?? 'none'}
      data-testid="redesign-canvas-root"
      data-evidence-capture-root="true"
      data-bim-model-status={modelStatus}
      data-bim-loading={modelReady ? undefined : 'true'}
    >
      {showEmptyStateOverlay ? (
        <EmptyStateOverlay
          headline={emptyHint.headline}
          hint={emptyHint.hint}
          ctaLabel={emptyHint.cta?.label ?? null}
          ctaPending={seedLoading}
          ctaError={seedError ?? null}
          onCta={() => void onInsertSeedHouse()}
          Icon={WallHifi}
        />
      ) : null}
      {showCanvasHint ? <EmptyStateHint /> : null}
      <QuickAccessToolbar
        onInvokeCommand={(commandId) => {
          const entry = getRegistry().find((e) => e.id === commandId);
          if (entry) {
            entry.invoke({
              selectedElementIds: [],
              activeViewId: null,
              dispatchCommand: (cmd) => void onSemanticCommand(cmd),
            });
          }
        }}
        onRemoveFromQAT={(commandId) => {
          void onSemanticCommand({ type: 'removeFromQuickAccess', commandId });
        }}
      />
      {renderPaneNode(paneRoot)}
    </div>
  );
}

export function WorkspaceFooterSlot(props: StatusBarProps): JSX.Element {
  return (
    <>
      <StatusBar {...props} />
      {/* PERF-L05: degraded-mode chip lights up when frame-time / rebuild
          budgets are sustained-over. Returns null when budgets are
          healthy, so this is safe to mount unconditionally. */}
      <DegradedModeBadge />
    </>
  );
}
