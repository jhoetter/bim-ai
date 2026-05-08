/**
 * EDT-V3-06 — Helper dimension layer.
 *
 * Renders HelperDimChips above selection handles when exactly one element
 * is selected. Invisible when nothing is selected (A9 antidote).
 */
import type { Element } from '@bim-ai/core';

import { HelperDimChip, type PlanToScreen } from './HelperDimChip';
import { getHelperDimensions } from './helperDimensions';

interface HelperDimsLayerProps {
  selectedElemId: string | null;
  elementsById: Record<string, Element>;
  planToScreen: PlanToScreen;
  onDispatch: (cmd: Record<string, unknown>) => void;
}

export function HelperDimsLayer({
  selectedElemId,
  elementsById,
  planToScreen,
  onDispatch,
}: HelperDimsLayerProps) {
  if (!selectedElemId) return null;
  const elem = elementsById[selectedElemId];
  if (!elem) return null;
  const dims = getHelperDimensions(elem, elementsById);
  if (dims.length === 0) return null;

  return (
    <div
      data-testid="helper-dims-layer"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {dims.map((d) => (
        <HelperDimChip
          key={d.id}
          descriptor={d}
          planToScreen={planToScreen}
          onDispatch={onDispatch}
        />
      ))}
    </div>
  );
}
