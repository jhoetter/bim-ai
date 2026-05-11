import { useMemo } from 'react';
import type { Element } from '@bim-ai/core';
import { useBimStore } from '../../state/store';
import { LevelDatumStackWorkbench } from './LevelDatumStackWorkbench';
import { MaterialLayerStackWorkbench } from './MaterialLayerStackWorkbench';
import { RoofAuthoringWorkbench } from './RoofAuthoringWorkbench';
import { RoomColorSchemePanel } from './RoomColorSchemePanel';
import { RoomSeparationAuthoringWorkbench } from './RoomSeparationAuthoringWorkbench';
import { SiteAuthoringPanel } from './SiteAuthoringPanel';

type LevelRow = Extract<Element, { kind: 'level' }>;

type Props = {
  selected: Element | undefined;
  elementsById: Record<string, Element>;
  activeLevelId: string;
  onUpsertSemantic: (cmd: Record<string, unknown>) => void;
};

export function AuthoringWorkbenchesPanel({
  selected,
  elementsById,
  activeLevelId,
  onUpsertSemantic,
}: Props) {
  const revision = useBimStore((s) => s.revision);
  const violations = useBimStore((s) => s.violations);
  const wirePrimitives = useBimStore((s) => s.planProjectionPrimitives);
  const selectedIds = useBimStore((s) => s.selectedIds);

  const levels = useMemo(
    () =>
      (Object.values(elementsById) as Element[])
        .filter((e): e is LevelRow => e.kind === 'level')
        .sort((a, b) => a.elevationMm - b.elevationMm),
    [elementsById],
  );

  const defaultLevelId = activeLevelId || levels[0]?.id || '';

  return (
    <div className="space-y-0 p-3" data-testid="authoring-workbenches-panel">
      <RoomSeparationAuthoringWorkbench
        selected={selected}
        elementsById={elementsById}
        wirePrimitives={wirePrimitives}
        levels={levels}
        defaultLevelId={defaultLevelId}
        revision={revision}
        onUpsertSemantic={onUpsertSemantic}
      />
      <LevelDatumStackWorkbench
        selected={selected}
        elementsById={elementsById}
        violations={violations}
      />
      <RoofAuthoringWorkbench
        selected={selected}
        elementsById={elementsById}
        selectedIds={selectedIds}
        wirePrimitives={wirePrimitives}
        revision={revision}
        onUpsertSemantic={onUpsertSemantic}
        onPersistProperty={(key, value) => {
          const sid = selected?.id;
          if (!sid) return;
          onUpsertSemantic({ type: 'updateElementProperty', elementId: sid, key, value });
        }}
      />
      <MaterialLayerStackWorkbench
        selected={selected}
        elementsById={elementsById}
        revision={revision}
        onUpsertSemantic={onUpsertSemantic}
      />
      <SiteAuthoringPanel
        revision={revision}
        elementsById={elementsById}
        levels={levels}
        onUpsertSemantic={onUpsertSemantic}
      />
      <RoomColorSchemePanel onUpsertSemantic={onUpsertSemantic} />
    </div>
  );
}
