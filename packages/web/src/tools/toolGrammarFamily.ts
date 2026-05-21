export type FamilyBlendPhase = 'idle' | 'sketching-bottom' | 'sketching-top';

export interface FamilyBlendState {
  phase: FamilyBlendPhase;
  bottomPointsMm: { xMm: number; yMm: number }[];
  topPointsMm: { xMm: number; yMm: number }[];
}

export type FamilyBlendEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'confirm' }
  | { kind: 'cancel' };

export interface FamilyBlendEffect {
  stillActive: boolean;
  createFamilyBlend?: {
    bottomProfileMm: { xMm: number; yMm: number }[];
    topProfileMm: { xMm: number; yMm: number }[];
  };
}

export function initialFamilyBlendState(): FamilyBlendState {
  return { phase: 'idle', bottomPointsMm: [], topPointsMm: [] };
}

export function reduceFamilyBlend(
  state: FamilyBlendState,
  event: FamilyBlendEvent,
): { state: FamilyBlendState; effect: FamilyBlendEffect } {
  if (event.kind === 'deactivate') {
    return { state: initialFamilyBlendState(), effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    return { state: initialFamilyBlendState(), effect: { stillActive: true } };
  }
  if (event.kind === 'activate') {
    return {
      state: { phase: 'sketching-bottom', bottomPointsMm: [], topPointsMm: [] },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'click') {
    if (state.phase === 'idle') {
      return {
        state: { phase: 'sketching-bottom', bottomPointsMm: [event.pointMm], topPointsMm: [] },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'sketching-bottom') {
      return {
        state: { ...state, bottomPointsMm: [...state.bottomPointsMm, event.pointMm] },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'sketching-top') {
      return {
        state: { ...state, topPointsMm: [...state.topPointsMm, event.pointMm] },
        effect: { stillActive: true },
      };
    }
  }
  if (event.kind === 'confirm') {
    if (state.phase === 'sketching-bottom' && state.bottomPointsMm.length >= 3) {
      return {
        state: { ...state, phase: 'sketching-top', topPointsMm: [] },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'sketching-top' && state.topPointsMm.length >= 3) {
      const result: FamilyBlendEffect = {
        stillActive: true,
        createFamilyBlend: {
          bottomProfileMm: state.bottomPointsMm,
          topProfileMm: state.topPointsMm,
        },
      };
      return { state: initialFamilyBlendState(), effect: result };
    }
  }
  return { state, effect: { stillActive: true } };
}

export type FamilySweepPhase = 'idle' | 'sketching-profile' | 'sketching-path';

export interface FamilySweepState {
  phase: FamilySweepPhase;
  profilePointsMm: { xMm: number; yMm: number }[];
  pathPointsMm: { xMm: number; yMm: number; zMm: number }[];
}

export type FamilySweepEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'confirm' }
  | { kind: 'cancel' };

export interface FamilySweepEffect {
  stillActive: boolean;
  createFamilySweep?: {
    profileMm: { xMm: number; yMm: number }[];
    pathMm: { xMm: number; yMm: number; zMm: number }[];
  };
}

export function initialFamilySweepState(): FamilySweepState {
  return { phase: 'idle', profilePointsMm: [], pathPointsMm: [] };
}

export function reduceFamilySweep(
  state: FamilySweepState,
  event: FamilySweepEvent,
): { state: FamilySweepState; effect: FamilySweepEffect } {
  if (event.kind === 'deactivate') {
    return { state: initialFamilySweepState(), effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    return { state: initialFamilySweepState(), effect: { stillActive: true } };
  }
  if (event.kind === 'activate') {
    return {
      state: { phase: 'sketching-profile', profilePointsMm: [], pathPointsMm: [] },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'click') {
    if (state.phase === 'idle') {
      return {
        state: {
          phase: 'sketching-profile',
          profilePointsMm: [event.pointMm],
          pathPointsMm: [],
        },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'sketching-profile') {
      return {
        state: { ...state, profilePointsMm: [...state.profilePointsMm, event.pointMm] },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'sketching-path') {
      const pathPt = { xMm: event.pointMm.xMm, yMm: event.pointMm.yMm, zMm: 0 };
      return {
        state: { ...state, pathPointsMm: [...state.pathPointsMm, pathPt] },
        effect: { stillActive: true },
      };
    }
  }
  if (event.kind === 'confirm') {
    if (state.phase === 'sketching-profile' && state.profilePointsMm.length >= 3) {
      return {
        state: { ...state, phase: 'sketching-path', pathPointsMm: [] },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'sketching-path' && state.pathPointsMm.length >= 2) {
      const result: FamilySweepEffect = {
        stillActive: true,
        createFamilySweep: {
          profileMm: state.profilePointsMm,
          pathMm: state.pathPointsMm,
        },
      };
      return { state: initialFamilySweepState(), effect: result };
    }
  }
  return { state, effect: { stillActive: true } };
}
