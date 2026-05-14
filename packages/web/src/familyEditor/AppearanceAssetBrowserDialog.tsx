import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { MaterialBrowserDialog } from './MaterialBrowserDialog';

export type AppearanceAssetBrowserDialogProps = {
  currentKey?: string | null;
  elementsById?: Record<string, Element>;
  onReplace: (materialKey: string) => void;
  onClose: () => void;
};

export function AppearanceAssetBrowserDialog({
  currentKey,
  elementsById,
  onReplace,
  onClose,
}: AppearanceAssetBrowserDialogProps): JSX.Element {
  return (
    <MaterialBrowserDialog
      title="Appearance Asset Browser"
      actionLabel="Replace"
      mode="appearanceAsset"
      currentKey={currentKey}
      elementsById={elementsById}
      onAssign={onReplace}
      onClose={onClose}
    />
  );
}
