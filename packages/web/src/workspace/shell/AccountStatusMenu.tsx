import { type JSX } from 'react';
import { Icons } from '@bim-ai/ui';

export interface AccountStatusInfo {
  displayName?: string | null;
  userId?: string | null;
  modelId?: string | null;
  revision?: number | null;
  wsConnected?: boolean;
  online?: boolean;
  pendingEdits?: number;
  appMode?: string;
  licenseLabel?: string;
  planLabel?: string;
}

export interface AccountStatusMenuProps {
  info?: AccountStatusInfo;
  onSettings?: () => void;
  onCommandPalette?: () => void;
}

export function AccountStatusMenu({
  info,
  onSettings,
  onCommandPalette,
}: AccountStatusMenuProps): JSX.Element {
  const displayName = clean(info?.displayName) ?? 'Local user';
  const userId = clean(info?.userId) ?? 'local session';
  const modelId = clean(info?.modelId) ?? 'No model loaded';
  const revision = typeof info?.revision === 'number' ? `r${info.revision}` : 'No revision';
  const licenseLabel = clean(info?.licenseLabel) ?? 'Local workspace';
  const planLabel = clean(info?.planLabel) ?? 'bim-ai equivalent';
  const online = info?.online ?? true;
  const wsConnected = info?.wsConnected ?? false;
  const pendingEdits = Math.max(0, info?.pendingEdits ?? 0);
  const appMode = clean(info?.appMode) ?? 'browser';

  return (
    <div data-testid="account-status-menu" className="w-72 text-xs text-foreground">
      <section className="border-b border-border px-3 py-3">
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
            {initials(displayName)}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold" data-testid="account-status-display-name">
              {displayName}
            </div>
            <div className="truncate font-mono text-[10px] text-muted">{userId}</div>
          </div>
        </div>
      </section>

      <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-border px-3 py-3">
        <AccountField label="Plan" value={planLabel} testId="account-status-plan" />
        <AccountField label="License" value={licenseLabel} testId="account-status-license" />
        <AccountField label="Model" value={modelId} testId="account-status-model" mono />
        <AccountField label="Revision" value={revision} testId="account-status-revision" mono />
      </dl>

      <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-border px-3 py-3">
        <AccountField
          label="Network"
          value={online ? 'Online' : 'Offline'}
          testId="account-status-network"
        />
        <AccountField
          label="Realtime"
          value={wsConnected ? 'Connected' : 'Disconnected'}
          testId="account-status-realtime"
        />
        <AccountField
          label="Pending"
          value={pendingEdits === 0 ? 'None' : String(pendingEdits)}
          testId="account-status-pending"
        />
        <AccountField label="Environment" value={appMode} testId="account-status-environment" />
      </dl>

      <section className="py-1" aria-label="Account actions">
        <button
          type="button"
          role="menuitem"
          data-testid="account-status-settings"
          onClick={onSettings}
          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-strong"
        >
          <Icons.settings size={13} aria-hidden="true" />
          Help / shortcuts
        </button>
        <button
          type="button"
          role="menuitem"
          data-testid="account-status-command-palette"
          onClick={onCommandPalette}
          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-strong"
        >
          <Icons.commandPalette size={13} aria-hidden="true" />
          Command palette
        </button>
      </section>
    </div>
  );
}

function AccountField({
  label,
  value,
  testId,
  mono,
}: {
  label: string;
  value: string;
  testId: string;
  mono?: boolean;
}): JSX.Element {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd
        data-testid={testId}
        className={['truncate', mono ? 'font-mono text-[10px]' : ''].join(' ').trim()}
        title={value}
      >
        {value}
      </dd>
    </>
  );
}

function clean(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .padEnd(2, '·');
}
