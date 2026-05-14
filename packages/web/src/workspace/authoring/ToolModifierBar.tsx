/**
 * CHR-V3-08 — workspace-wired ToolModifierBar.
 *
 * Reads the active plan tool from the bim store, resolves the per-tool
 * descriptor list, and wires toggle / cycle state via the toolPrefs slice.
 *
 * EDT-V3-05: the `loop` modifier id is wired to `toolPrefs.loopMode` so the
 * modifier-bar chip and the L-key handler share a single source of truth.
 */

import type { JSX } from 'react';

import { ToolModifierBar as ToolModifierBarPure } from '../../tools/ToolModifierBar';
import { getToolModifierDescriptors } from '../../tools/modifierBar';
import type { CycleModifierDescriptor, ToggleModifierDescriptor } from '../../tools/modifierBar';
import { useToolPrefs } from '../../tools/toolPrefsStore';
import { useBimStore } from '../../state/store';
import type { ToolId } from '../../tools/toolRegistry';

export function ToolModifierBar({
  activeTool,
}: {
  activeTool?: ToolId | null;
} = {}): JSX.Element | null {
  const storePlanTool = useBimStore((s) => s.planTool) as ToolId | null;
  const planTool = activeTool ?? storePlanTool;
  const descriptors = getToolModifierDescriptors(planTool);

  const getToggle = useToolPrefs((s) => s.getToggle);
  const setToggle = useToolPrefs((s) => s.setToggle);
  const getCycle = useToolPrefs((s) => s.getCycle);
  const advanceCycle = useToolPrefs((s) => s.advanceCycle);
  // EDT-V3-05: loop modifier is backed by the dedicated loopMode field.
  const loopMode = useToolPrefs((s) => s.loopMode);
  const setLoopMode = useToolPrefs((s) => s.setLoopMode);

  if (!planTool || descriptors.length === 0) return null;

  function handleGetToggle(modifierId: string): boolean {
    // EDT-V3-05: the loop chip reads from the dedicated loopMode field.
    if (modifierId === 'loop') return loopMode;
    const desc = descriptors.find((d) => d.id === modifierId) as
      | ToggleModifierDescriptor
      | undefined;
    return getToggle(planTool!, modifierId, desc?.defaultOn ?? false);
  }

  function handleToggle(modifierId: string, value: boolean): void {
    // EDT-V3-05: the loop chip writes to the dedicated loopMode field.
    if (modifierId === 'loop') {
      setLoopMode(value);
      return;
    }
    setToggle(planTool!, modifierId, value);
  }

  function handleGetCycle(modifierId: string): string {
    const desc = descriptors.find((d) => d.id === modifierId) as
      | CycleModifierDescriptor
      | undefined;
    return getCycle(planTool!, modifierId, desc?.defaultValue ?? '');
  }

  function handleCycleAdvance(modifierId: string): void {
    const desc = descriptors.find((d) => d.id === modifierId) as
      | CycleModifierDescriptor
      | undefined;
    if (!desc) return;
    advanceCycle(planTool!, modifierId, desc.values, desc.defaultValue);
  }

  return (
    <ToolModifierBarPure
      activeTool={planTool}
      descriptors={descriptors}
      getToggle={handleGetToggle}
      onToggle={handleToggle}
      getCycle={handleGetCycle}
      onCycleAdvance={handleCycleAdvance}
    />
  );
}
