import type { Element } from '@bim-ai/core';

import { getTypeById } from './familyCatalog';
import { familyTypeProjectCategoryKey } from './familyPlacementRuntime';

export type HostedFamilyTool = 'door' | 'window' | 'wall-opening';

export type HostedFamilyPlacementSpec = {
  familyTypeId?: string;
  widthMm: number;
  heightMm?: number;
  sillHeightMm?: number;
};

const DEFAULT_SPECS: Record<HostedFamilyTool, HostedFamilyPlacementSpec> = {
  door: { widthMm: 900, heightMm: 2100 },
  window: { widthMm: 1200, heightMm: 1500, sillHeightMm: 900 },
  'wall-opening': { widthMm: 1000, heightMm: 2200, sillHeightMm: 200 },
};

function readNumber(
  parameters: Record<string, unknown> | undefined,
  keys: string[],
): number | undefined {
  if (!parameters) return undefined;
  for (const key of keys) {
    const raw = parameters[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function selectedHostedParams(input: {
  tool: HostedFamilyTool;
  familyTypeId: string | null | undefined;
  elementsById: Record<string, Element>;
}): { id: string; parameters: Record<string, unknown> | undefined } | null {
  const id = input.familyTypeId?.trim();
  if (!id || input.tool === 'wall-opening') return null;

  const element = input.elementsById[id];
  if (element?.kind === 'family_type' && familyTypeProjectCategoryKey(element) === input.tool) {
    return { id, parameters: element.parameters };
  }

  const builtIn = getTypeById(id);
  if (builtIn?.discipline === input.tool) {
    return { id, parameters: builtIn.parameters };
  }

  return null;
}

export function resolveHostedFamilyPlacement(input: {
  tool: HostedFamilyTool;
  familyTypeId: string | null | undefined;
  elementsById: Record<string, Element>;
}): HostedFamilyPlacementSpec {
  const fallback = DEFAULT_SPECS[input.tool];
  const selected = selectedHostedParams(input);
  if (!selected) return { ...fallback };

  if (input.tool === 'door') {
    return {
      familyTypeId: selected.id,
      widthMm:
        readNumber(selected.parameters, ['leafWidthMm', 'widthMm', 'roughWidthMm']) ??
        fallback.widthMm,
      heightMm:
        readNumber(selected.parameters, ['leafHeightMm', 'heightMm', 'roughHeightMm']) ??
        fallback.heightMm,
    };
  }

  if (input.tool === 'window') {
    return {
      familyTypeId: selected.id,
      widthMm: readNumber(selected.parameters, ['widthMm', 'roughWidthMm']) ?? fallback.widthMm,
      heightMm: readNumber(selected.parameters, ['heightMm', 'roughHeightMm']) ?? fallback.heightMm,
      sillHeightMm:
        readNumber(selected.parameters, ['sillMm', 'sillHeightMm']) ?? fallback.sillHeightMm,
    };
  }

  return { ...fallback };
}
