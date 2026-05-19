// §1.8.3: pure dispatch logic for the double-click-to-edit feature.
// Extracted from PlanCanvas's onDblClick handler so it can be unit-tested.

import type { Element } from '@bim-ai/core';

import type { GroupInstance } from '../groups/groupTypes';
import type { PlanTool } from '../state/store';

export interface DblClickHandlers {
  selectEl: (id: string) => void;
  setActiveLevelId: (id: string) => void;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
}

/**
 * Dispatch the correct edit action for a double-clicked element.
 * Returns true when an action was taken (caller should `return`), false otherwise.
 */
export function handleDblClickDispatch(
  id: string,
  el: Element | undefined,
  groupInst: GroupInstance | undefined,
  planTool: PlanTool,
  handlers: DblClickHandlers,
): boolean {
  if (planTool !== 'select') return false;

  if (groupInst) {
    void handlers.onSemanticCommand({
      type: 'editGroup',
      groupDefinitionId: groupInst.groupDefinitionId,
    });
    return true;
  }

  if (!el) return false;

  if (el.kind === 'floor' || el.kind === 'ceiling') {
    handlers.selectEl(el.id);
    const levelId = (el as Extract<Element, { kind: 'floor' | 'ceiling' }>).levelId;
    if (levelId) handlers.setActiveLevelId(levelId);
    return true;
  }
  if (el.kind === 'roof') {
    handlers.selectEl(el.id);
    if (el.referenceLevelId) handlers.setActiveLevelId(el.referenceLevelId);
    return true;
  }
  if (el.kind === 'room') {
    handlers.selectEl(el.id);
    return true;
  }
  if (el.kind === 'wall') {
    handlers.selectEl(el.id);
    if (import.meta.env.MODE !== 'test') {
      console.info(
        'Double-clicked wall — use Edit Profile in the inspector to modify the cross-section shape',
      );
    }
    return true;
  }
  if (el.kind === 'dimension') {
    handlers.selectEl(el.id);
    return true;
  }

  return false;
}
