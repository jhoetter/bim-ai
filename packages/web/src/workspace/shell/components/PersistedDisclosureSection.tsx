import type { JSX, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

const SECONDARY_DISCLOSURE_STORAGE_PREFIX = 'bim.secondary.disclosure.v1';

function readPersistedOpenState(storageKey: string, defaultOpen: boolean): boolean {
  if (typeof window === 'undefined') return defaultOpen;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === 'open') return true;
    if (raw === 'closed') return false;
  } catch {
    // noop
  }
  return defaultOpen;
}

function writePersistedOpenState(storageKey: string, isOpen: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, isOpen ? 'open' : 'closed');
  } catch {
    // noop
  }
}

export type SecondarySectionScope = 'view-summary' | 'view-state' | 'advanced';

export function disclosureStorageKey(disclosureId: string): string {
  return `${SECONDARY_DISCLOSURE_STORAGE_PREFIX}:${disclosureId}`;
}

export function PersistedDisclosureSection({
  title,
  disclosureId,
  defaultOpen = true,
  children,
  testId,
  scope = 'advanced',
}: {
  title: string;
  disclosureId: string;
  defaultOpen?: boolean;
  children: ReactNode;
  testId?: string;
  scope?: SecondarySectionScope;
}): JSX.Element {
  const storageKey = useMemo(() => disclosureStorageKey(disclosureId), [disclosureId]);
  const [isOpen, setIsOpen] = useState<boolean>(() =>
    readPersistedOpenState(storageKey, defaultOpen),
  );

  useEffect(() => {
    setIsOpen(readPersistedOpenState(storageKey, defaultOpen));
  }, [defaultOpen, storageKey]);

  useEffect(() => {
    writePersistedOpenState(storageKey, isOpen);
  }, [isOpen, storageKey]);

  const bodyId = useMemo(
    () => `secondary-disclosure-body-${disclosureId.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
    [disclosureId],
  );

  function toggle(): void {
    setIsOpen((prev) => !prev);
  }

  return (
    <section
      className="border-b border-border px-3 py-3"
      data-testid={testId}
      data-secondary-scope={scope}
      data-secondary-disclosure="true"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        }}
        data-testid={testId ? `${testId}-toggle` : undefined}
      >
        <span
          className="text-[10px] font-semibold uppercase text-muted"
          style={{ letterSpacing: '0.08em', opacity: 0.7 }}
        >
          {title}
        </span>
        <span className="shrink-0 text-[10px] text-muted">{isOpen ? 'Hide' : 'Show'}</span>
      </button>
      <div id={bodyId} hidden={!isOpen} className="mt-2 min-w-0">
        {children}
      </div>
    </section>
  );
}
