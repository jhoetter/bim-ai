import type { ApplyCommandResp } from '../lib/api';
import { useBimStore } from '../state/store';

import { parseLevelElevationPropagationEvidence } from './levelDatumPropagationReadout';

export function syncLastLevelElevationPropagationFromApplyResponse(
  r: ApplyCommandResp & Record<string, unknown>,
): void {
  const raw = r.levelElevationPropagationEvidence_v0;
  const parsed = parseLevelElevationPropagationEvidence(raw);
  useBimStore.setState({ lastLevelElevationPropagationEvidence: parsed });
}
