import type { View } from '@bim-ai/core';

export function useCutProfile(
  view: View,
  categoryOrId: string,
): 'singleLine' | 'outline' | string | null {
  return (
    view.elementOverrides?.find((o) => o.categoryOrId === categoryOrId)?.alternateRender ?? null
  );
}
