import type { SubdivisionDraft } from '../tools/toolPrefsStore';
import type { PlanTool } from '../state/store';
import { SubdivisionPalette, type SubdivisionCategory } from '../workspace/authoring';

type MmPoint = {
  xMm: number;
  yMm: number;
};

type TextAnnotationOverlay = {
  positionMm: MmPoint;
  screenX: number;
  screenY: number;
  draft: string;
};

type LeaderTextOverlay = {
  anchorMm: MmPoint;
  elbowMm: MmPoint;
  textMm: MmPoint;
  screenX: number;
  screenY: number;
  draft: string;
};

type PendingPlanRegion = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  lvlId: string;
  cutPlaneDraft: string;
};

type Props = {
  revealHiddenMode: boolean;
  activePlanViewId?: string | null;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  textAnnotOverlay: TextAnnotationOverlay | null;
  onTextAnnotationDraftChange: (draft: string) => void;
  onTextAnnotationDone: () => void;
  leaderTextOverlay: LeaderTextOverlay | null;
  onLeaderTextDraftChange: (draft: string) => void;
  onLeaderTextDone: () => void;
  pendingPlanRegion: PendingPlanRegion | null;
  onPlanRegionDraftChange: (draft: string) => void;
  onPlanRegionDone: () => void;
  planTool: PlanTool;
  subdivisionDraft: SubdivisionDraft | null;
  onSetSubdivisionDraft: (draft: SubdivisionDraft) => void;
  onUpdateCurrentSubdivisionDraftCategory: (category: SubdivisionCategory) => void;
  onCancelSubdivision: () => void;
};

function submitPlanRegion(
  pendingPlanRegion: PendingPlanRegion,
  onPlanRegionDone: () => void,
  onSemanticCommand: Props['onSemanticCommand'],
) {
  onPlanRegionDone();
  const offsetMm = parseFloat(pendingPlanRegion.cutPlaneDraft);
  void onSemanticCommand({
    type: 'createPlanRegion',
    levelId: pendingPlanRegion.lvlId,
    outlineMm: [
      { xMm: pendingPlanRegion.x0, yMm: pendingPlanRegion.y0 },
      { xMm: pendingPlanRegion.x1, yMm: pendingPlanRegion.y0 },
      { xMm: pendingPlanRegion.x1, yMm: pendingPlanRegion.y1 },
      { xMm: pendingPlanRegion.x0, yMm: pendingPlanRegion.y1 },
    ],
    cutPlaneOffsetMm: Number.isFinite(offsetMm) ? offsetMm : 900,
  });
}

function TextAnnotationEntry({
  activePlanViewId,
  onSemanticCommand,
  textAnnotOverlay,
  onTextAnnotationDraftChange,
  onTextAnnotationDone,
}: Pick<
  Props,
  | 'activePlanViewId'
  | 'onSemanticCommand'
  | 'textAnnotOverlay'
  | 'onTextAnnotationDraftChange'
  | 'onTextAnnotationDone'
>) {
  if (!textAnnotOverlay) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: textAnnotOverlay.screenX,
        top: textAnnotOverlay.screenY,
        pointerEvents: 'auto',
        zIndex: 30,
      }}
    >
      <input
        autoFocus
        type="text"
        value={textAnnotOverlay.draft}
        className="rounded border border-accent bg-surface px-1 py-0.5 text-xs shadow outline-none"
        placeholder="Type text…"
        onChange={(e) => onTextAnnotationDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const draft = textAnnotOverlay.draft.trim();
            if (draft && activePlanViewId) {
              void onSemanticCommand({
                type: 'createTextNote',
                hostViewId: activePlanViewId,
                positionMm: textAnnotOverlay.positionMm,
                text: draft,
                fontSizeMm: 200,
                anchor: 'tl',
              });
            }
            onTextAnnotationDone();
          } else if (e.key === 'Escape') {
            onTextAnnotationDone();
          }
        }}
      />
    </div>
  );
}

function LeaderTextEntry({
  activePlanViewId,
  onSemanticCommand,
  leaderTextOverlay,
  onLeaderTextDraftChange,
  onLeaderTextDone,
}: Pick<
  Props,
  | 'activePlanViewId'
  | 'onSemanticCommand'
  | 'leaderTextOverlay'
  | 'onLeaderTextDraftChange'
  | 'onLeaderTextDone'
>) {
  if (!leaderTextOverlay) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: leaderTextOverlay.screenX,
        top: leaderTextOverlay.screenY,
        pointerEvents: 'auto',
        zIndex: 30,
      }}
    >
      <input
        autoFocus
        type="text"
        value={leaderTextOverlay.draft}
        className="rounded border border-accent bg-surface px-1 py-0.5 text-xs shadow outline-none"
        placeholder="Leader text…"
        onChange={(e) => onLeaderTextDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const draft = leaderTextOverlay.draft.trim();
            if (draft && activePlanViewId) {
              void onSemanticCommand({
                type: 'createLeaderText',
                hostViewId: activePlanViewId,
                anchorMm: leaderTextOverlay.anchorMm,
                elbowMm: leaderTextOverlay.elbowMm,
                textMm: leaderTextOverlay.textMm,
                content: draft,
                arrowStyle: 'arrow',
              });
            }
            onLeaderTextDone();
          } else if (e.key === 'Escape') {
            onLeaderTextDone();
          }
        }}
      />
    </div>
  );
}

function PlanRegionCutPlaneDialog({
  pendingPlanRegion,
  onPlanRegionDraftChange,
  onPlanRegionDone,
  onSemanticCommand,
}: Pick<
  Props,
  'pendingPlanRegion' | 'onPlanRegionDraftChange' | 'onPlanRegionDone' | 'onSemanticCommand'
>) {
  if (!pendingPlanRegion) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
        zIndex: 40,
      }}
      className="flex flex-col gap-2 rounded border border-border bg-surface p-3 shadow-lg"
      data-testid="cut-plane-dialog"
    >
      <label htmlFor="cut-plane-height" className="text-[11px] font-medium text-foreground">
        Cut-plane height (mm above level)
      </label>
      <input
        id="cut-plane-height"
        autoFocus
        type="number"
        value={pendingPlanRegion.cutPlaneDraft}
        onChange={(e) => onPlanRegionDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitPlanRegion(pendingPlanRegion, onPlanRegionDone, onSemanticCommand);
          } else if (e.key === 'Escape') {
            onPlanRegionDone();
          }
        }}
        className="rounded border border-border bg-background px-2 py-1 text-xs font-mono text-foreground"
        placeholder="900"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="rounded border border-border px-2 py-0.5 text-[11px] text-muted hover:text-foreground"
          onClick={onPlanRegionDone}
        >
          Cancel
        </button>
        <button
          type="button"
          className="rounded border border-accent bg-accent/20 px-2 py-0.5 text-[11px] text-foreground hover:bg-accent/40"
          onClick={() => submitPlanRegion(pendingPlanRegion, onPlanRegionDone, onSemanticCommand)}
        >
          Place Region
        </button>
      </div>
    </div>
  );
}

function SubdivisionPaletteOverlay({
  planTool,
  subdivisionDraft,
  onSetSubdivisionDraft,
  onUpdateCurrentSubdivisionDraftCategory,
  onCancelSubdivision,
}: Pick<
  Props,
  | 'planTool'
  | 'subdivisionDraft'
  | 'onSetSubdivisionDraft'
  | 'onUpdateCurrentSubdivisionDraftCategory'
  | 'onCancelSubdivision'
>) {
  if (planTool !== 'toposolid_subdivision') return null;

  const handleSelect = (category: SubdivisionCategory) => {
    if (subdivisionDraft) {
      onSetSubdivisionDraft({ ...subdivisionDraft, finishCategory: category });
    } else {
      onSetSubdivisionDraft({
        hostToposolidId: null,
        boundaryPts: [],
        finishCategory: category,
      });
    }
    onUpdateCurrentSubdivisionDraftCategory(category);
  };

  return (
    <div className="pointer-events-auto absolute top-3 left-1/2 z-20 -translate-x-1/2">
      <SubdivisionPalette
        activeCategory={subdivisionDraft?.finishCategory ?? 'paving'}
        onSelect={handleSelect}
        onCancel={onCancelSubdivision}
      />
    </div>
  );
}

export function PlanCanvasAuthoringOverlays({
  revealHiddenMode,
  activePlanViewId,
  onSemanticCommand,
  textAnnotOverlay,
  onTextAnnotationDraftChange,
  onTextAnnotationDone,
  leaderTextOverlay,
  onLeaderTextDraftChange,
  onLeaderTextDone,
  pendingPlanRegion,
  onPlanRegionDraftChange,
  onPlanRegionDone,
  planTool,
  subdivisionDraft,
  onSetSubdivisionDraft,
  onUpdateCurrentSubdivisionDraftCategory,
  onCancelSubdivision,
}: Props) {
  return (
    <>
      {revealHiddenMode ? (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#ff00ff',
            color: '#fff',
            padding: '2px 10px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: 'none',
            zIndex: 20,
          }}
          data-testid="reveal-hidden-chip"
        >
          Reveal Hidden Elements — hidden categories visible
        </div>
      ) : null}
      <TextAnnotationEntry
        activePlanViewId={activePlanViewId}
        onSemanticCommand={onSemanticCommand}
        textAnnotOverlay={textAnnotOverlay}
        onTextAnnotationDraftChange={onTextAnnotationDraftChange}
        onTextAnnotationDone={onTextAnnotationDone}
      />
      <LeaderTextEntry
        activePlanViewId={activePlanViewId}
        onSemanticCommand={onSemanticCommand}
        leaderTextOverlay={leaderTextOverlay}
        onLeaderTextDraftChange={onLeaderTextDraftChange}
        onLeaderTextDone={onLeaderTextDone}
      />
      <PlanRegionCutPlaneDialog
        pendingPlanRegion={pendingPlanRegion}
        onPlanRegionDraftChange={onPlanRegionDraftChange}
        onPlanRegionDone={onPlanRegionDone}
        onSemanticCommand={onSemanticCommand}
      />
      <SubdivisionPaletteOverlay
        planTool={planTool}
        subdivisionDraft={subdivisionDraft}
        onSetSubdivisionDraft={onSetSubdivisionDraft}
        onUpdateCurrentSubdivisionDraftCategory={onUpdateCurrentSubdivisionDraftCategory}
        onCancelSubdivision={onCancelSubdivision}
      />
    </>
  );
}
