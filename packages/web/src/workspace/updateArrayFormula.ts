import type { Element, Violation } from '@bim-ai/core';
import type {
  ExternalCatalogPlacement,
  FamilyLibraryArrayFormulaUpdate,
} from '../families/FamilyLibraryPanel';
import {
  findLoadedCatalogFamilyType,
  planCatalogFamilyLoad,
} from '../families/catalogFamilyReload';
import { applyCommandBundle } from '../lib/api';
import { log } from '../logger';

export interface UpdateArrayFormulaContext {
  modelId: string | undefined;
  elementsById: Record<string, Element>;
  onSemanticCommand: (cmd: { type: string; [k: string]: unknown }) => Promise<unknown> | void;
  hydrateFromSnapshot: (input: {
    modelId: string;
    revision: number;
    elements: Record<string, Element>;
    violations: Violation[];
  }) => void;
  setUndoDepth: (fn: (d: number) => number) => void;
  setRedoDepth: (value: number) => void;
  setSeedError: (msg: string) => void;
}

/**
 * SCH-V3-01 / catalog-array authoring: apply a formula update to either
 * a stored asset's `paramSchema` or to a loaded catalog family type.
 * Asset updates use the semantic command path; catalog-family updates
 * re-plan + apply a `loadCatalogFamilyType` command with the new
 * formula in the per-param Formula slot plus a `catalogArrayFormulaParams`
 * map so the placement renders the array correctly.
 */
export async function updateArrayFormula(
  ctx: UpdateArrayFormulaContext,
  update: FamilyLibraryArrayFormulaUpdate,
): Promise<void> {
  const {
    modelId,
    elementsById,
    onSemanticCommand,
    hydrateFromSnapshot,
    setUndoDepth,
    setRedoDepth,
    setSeedError,
  } = ctx;
  if (!modelId) return;
  if (update.target.kind === 'asset') {
    const asset = elementsById[update.target.assetId];
    if (asset?.kind !== 'asset_library_entry') return;
    const paramSchema = (asset.paramSchema ?? []).map((param) =>
      param.key === update.paramKey
        ? {
            ...param,
            constraints: {
              ...((param.constraints && typeof param.constraints === 'object'
                ? param.constraints
                : {}) as Record<string, unknown>),
              formula: update.formula,
            },
          }
        : param,
    );
    await onSemanticCommand({
      type: 'updateElementProperty',
      elementId: asset.id,
      key: 'paramSchema',
      value: paramSchema,
    });
    return;
  }

  const placement = update.target.placement;
  const updatedPlacement: ExternalCatalogPlacement = {
    ...placement,
    family: {
      ...placement.family,
      params: (placement.family.params ?? []).map((param) =>
        param.key === update.paramKey ? { ...param, formula: update.formula } : param,
      ),
    },
  };
  const loaded = findLoadedCatalogFamilyType(elementsById, placement);
  const plan = planCatalogFamilyLoad(updatedPlacement, elementsById, {
    overwriteOption: loaded ? 'keep-existing-values' : 'overwrite-parameter-values',
  });
  const catalogArrayFormulaParams = {
    ...((loaded?.parameters.catalogArrayFormulaParams &&
    typeof loaded.parameters.catalogArrayFormulaParams === 'object'
      ? loaded.parameters.catalogArrayFormulaParams
      : {}) as Record<string, unknown>),
    [update.paramKey]: update.formula,
  };
  const command = {
    ...plan.command,
    parameters: {
      ...plan.command.parameters,
      [`${update.paramKey}Formula`]: update.formula,
      catalogArrayFormulaParams,
    },
  };
  try {
    const r = await applyCommandBundle(modelId, [command], { userId: 'component-tool' });
    if (r.revision !== undefined) {
      hydrateFromSnapshot({
        modelId,
        revision: r.revision,
        elements: (r.elements ?? {}) as Record<string, Element>,
        violations: (r.violations ?? []) as Violation[],
      });
      setUndoDepth((d) => d + 1);
      setRedoDepth(0);
    }
  } catch (err) {
    log.error('component-tool', 'array formula update failed', err);
    setSeedError(err instanceof Error ? err.message : 'Array formula update failed');
  }
}
