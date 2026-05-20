import { useMemo } from 'react';
import type { Element } from '@bim-ai/core';

import { gripsFor } from './grip-providers';
import type { GripDescriptor } from './gripProtocol';
import { tempDimensionsFor, type TempDimTarget } from './tempDimensions';

type Input = {
  selectedId?: string | null;
  elementsById: Record<string, Element>;
};

export function usePlanCanvasSelectionState({ selectedId, elementsById }: Input): {
  selectedWall: Extract<Element, { kind: 'wall' }> | undefined;
  selectedElement: Element | undefined;
  gripDescriptors: GripDescriptor[];
  tempDimTargets: TempDimTarget[];
} {
  const selectedWall = useMemo(() => {
    if (!selectedId) return undefined;
    const el = elementsById[selectedId];
    return el && el.kind === 'wall' ? el : undefined;
  }, [selectedId, elementsById]);

  const selectedElement = useMemo(
    () => (selectedId ? elementsById[selectedId] : undefined),
    [selectedId, elementsById],
  );

  const gripDescriptors = useMemo<GripDescriptor[]>(
    () => (selectedElement ? gripsFor(selectedElement, { elementsById }) : []),
    [selectedElement, elementsById],
  );

  const tempDimTargets = useMemo<TempDimTarget[]>(
    () => (selectedWall ? tempDimensionsFor(selectedWall, elementsById) : []),
    [selectedWall, elementsById],
  );

  return { selectedWall, selectedElement, gripDescriptors, tempDimTargets };
}
