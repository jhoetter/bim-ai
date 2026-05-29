/**
 * REF-CQ-01 — material-browser state extracted from Workspace.tsx.
 *
 * Owns the open/closed flags for the material + appearance-asset
 * browsers, the "active target" selection (which slot/element the next
 * material assignment goes to), and the dispatchers that the inspector
 * + ribbon + command-palette call into.
 *
 * Shape is callable from any consumer that can provide
 * `selectedElement`, the live `elementsById` map, and an
 * `onSemanticCommand` dispatcher — so `WorkspaceRightRail.tsx` can
 * adopt the same hook for its inspector material rows (FE-CQ-01
 * follow-up).
 */
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { Element } from '@bim-ai/core';

import { materialTargetLayerIndex } from '../viewport/hostMaterialLayerTargets';
import type { MaterialBrowserTargetRequest } from './inspector';
import {
  materialEditableTargetLabel,
  materialKeyForInstanceTarget,
  materialSlotTargetLabel,
  resolveMaterialEditableTarget,
  type ActiveMaterialBrowserTarget,
  type MaterialEditableTarget,
} from './materialTargets';

export interface UseMaterialBrowserStateArgs {
  selectedId: string | undefined;
  elementsById: Record<string, Element>;
  onSemanticCommand: (cmd: Record<string, unknown>) => Promise<void> | void;
}

export interface MaterialBrowserState {
  // Resolved targets / labels for the overlay surface.
  selectedElement: Element | undefined;
  materialEditableTarget: MaterialEditableTarget | null;
  selectedMaterialKey: string | null;
  activeMaterialKey: string | null;
  activeMaterialTargetLabel: string | null;
  activeMaterialBrowserTarget: ActiveMaterialBrowserTarget | null;

  // Browser open/close state.
  materialBrowserOpen: boolean;
  setMaterialBrowserOpen: Dispatch<SetStateAction<boolean>>;
  appearanceAssetBrowserOpen: boolean;
  setAppearanceAssetBrowserOpen: Dispatch<SetStateAction<boolean>>;

  // Dispatchers consumers (ribbon, inspector, command palette) call.
  openMaterialBrowser: (target?: MaterialBrowserTargetRequest) => void;
  openAppearanceAssetBrowser: (target?: MaterialBrowserTargetRequest) => void;
  assignMaterialToTarget: (materialKey: string) => void;
  clearActiveMaterialBrowserTarget: () => void;
}

export function useMaterialBrowserState({
  selectedId,
  elementsById,
  onSemanticCommand,
}: UseMaterialBrowserStateArgs): MaterialBrowserState {
  const [materialBrowserOpen, setMaterialBrowserOpen] = useState(false);
  const [appearanceAssetBrowserOpen, setAppearanceAssetBrowserOpen] = useState(false);
  const [activeMaterialBrowserTarget, setActiveMaterialBrowserTarget] =
    useState<ActiveMaterialBrowserTarget | null>(null);

  const selectedElement = useMemo(
    () => (selectedId ? (elementsById[selectedId] as Element | undefined) : undefined),
    [elementsById, selectedId],
  );

  const materialEditableTarget = useMemo(
    () => resolveMaterialEditableTarget(selectedElement, elementsById),
    [selectedElement, elementsById],
  );

  const selectedMaterialKey =
    materialEditableTarget?.kind === 'instance'
      ? materialKeyForInstanceTarget(materialEditableTarget)
      : materialEditableTarget
        ? (materialEditableTarget.element.layers[
            materialTargetLayerIndex(materialEditableTarget.element)
          ]?.materialKey ?? null)
        : null;

  const activeMaterialKey =
    activeMaterialBrowserTarget?.kind === 'material-slot'
      ? (activeMaterialBrowserTarget.currentKey ?? null)
      : (activeMaterialBrowserTarget?.currentKey ?? selectedMaterialKey);

  const activeMaterialTargetLabel =
    activeMaterialBrowserTarget?.kind === 'material-slot'
      ? materialSlotTargetLabel(activeMaterialBrowserTarget, elementsById)
      : (activeMaterialBrowserTarget?.label ??
        (materialEditableTarget ? materialEditableTargetLabel(materialEditableTarget) : null));

  const openMaterialBrowser = useCallback(
    (target?: MaterialBrowserTargetRequest) => {
      if (target) {
        setActiveMaterialBrowserTarget(target);
      } else if (materialEditableTarget) {
        setActiveMaterialBrowserTarget({
          kind: 'editable',
          target: materialEditableTarget,
          label: materialEditableTargetLabel(materialEditableTarget),
          currentKey: selectedMaterialKey,
        });
      } else {
        setActiveMaterialBrowserTarget(null);
      }
      setMaterialBrowserOpen(true);
    },
    [materialEditableTarget, selectedMaterialKey],
  );

  const openAppearanceAssetBrowser = useCallback(
    (target?: MaterialBrowserTargetRequest) => {
      if (target) {
        setActiveMaterialBrowserTarget(target);
      } else if (materialEditableTarget) {
        setActiveMaterialBrowserTarget({
          kind: 'editable',
          target: materialEditableTarget,
          label: materialEditableTargetLabel(materialEditableTarget),
          currentKey: selectedMaterialKey,
        });
      } else {
        setActiveMaterialBrowserTarget(null);
      }
      setAppearanceAssetBrowserOpen(true);
    },
    [materialEditableTarget, selectedMaterialKey],
  );

  const assignMaterialToTarget = useCallback(
    (materialKey: string) => {
      const target =
        activeMaterialBrowserTarget ??
        (materialEditableTarget
          ? ({
              kind: 'editable',
              target: materialEditableTarget,
              label: materialEditableTargetLabel(materialEditableTarget),
              currentKey: selectedMaterialKey,
            } satisfies ActiveMaterialBrowserTarget)
          : null);
      if (!target) return;
      if (target.kind === 'material-slot') {
        const element = elementsById[target.elementId];
        if (!element || !('materialSlots' in element)) return;
        const currentSlots =
          (element.materialSlots as Record<string, string | null> | null | undefined) ?? {};
        void onSemanticCommand({
          type: 'updateElementProperty',
          elementId: element.id,
          key: 'materialSlots',
          value: { ...currentSlots, [target.slot]: materialKey },
        });
        return;
      }
      if (target.target.kind === 'instance') {
        void onSemanticCommand({
          type: 'updateElementProperty',
          elementId: target.target.element.id,
          key: target.target.property,
          value: materialKey,
        });
        return;
      }
      const targetLayer = materialTargetLayerIndex(target.target.element);
      const nextLayers = target.target.element.layers.map((layer, index) =>
        index === targetLayer ? { ...layer, materialKey } : { ...layer },
      );
      if (!nextLayers.length) return;
      void onSemanticCommand({
        type: 'updateElementProperty',
        elementId: target.target.element.id,
        key: 'layers',
        value: nextLayers,
      });
    },
    [
      activeMaterialBrowserTarget,
      elementsById,
      materialEditableTarget,
      onSemanticCommand,
      selectedMaterialKey,
    ],
  );

  const clearActiveMaterialBrowserTarget = useCallback(
    () => setActiveMaterialBrowserTarget(null),
    [],
  );

  return {
    selectedElement,
    materialEditableTarget,
    selectedMaterialKey,
    activeMaterialKey,
    activeMaterialTargetLabel,
    activeMaterialBrowserTarget,
    materialBrowserOpen,
    setMaterialBrowserOpen,
    appearanceAssetBrowserOpen,
    setAppearanceAssetBrowserOpen,
    openMaterialBrowser,
    openAppearanceAssetBrowser,
    assignMaterialToTarget,
    clearActiveMaterialBrowserTarget,
  };
}
