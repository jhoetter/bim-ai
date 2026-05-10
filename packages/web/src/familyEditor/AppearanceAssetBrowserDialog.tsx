import type { JSX } from 'react';

import { MaterialBrowserDialog } from './MaterialBrowserDialog';

export type AppearanceAssetBrowserDialogProps = {
  currentKey?: string | null;
  onReplace: (materialKey: string) => void;
  onClose: () => void;
};

export function AppearanceAssetBrowserDialog({
  currentKey,
  onReplace,
  onClose,
}: AppearanceAssetBrowserDialogProps): JSX.Element {
  return (
    <MaterialBrowserDialog
      title="Appearance Asset Browser"
      actionLabel="Replace"
      currentKey={currentKey}
      onAssign={onReplace}
      onClose={onClose}
    />
  );
}
