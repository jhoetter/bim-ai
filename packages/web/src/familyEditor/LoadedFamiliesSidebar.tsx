/**
 * FAM-01 — Loaded Families sidebar.
 *
 * Lists families that the host family can nest. Drag a row onto the
 * editing canvas to place a `family_instance_ref` node at the drop
 * point; clicking the inline "Add" button is the keyboard-friendly
 * fallback.
 *
 * The sidebar is intentionally dumb: filtering by discipline + usage
 * count is done by the caller via the `families` and `instances` props
 * so this stays agnostic to the workbench's host-family state shape.
 */
import { useState, type DragEvent, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import type { FamilyDefinition } from '../families/types';

export interface LoadedFamiliesSidebarProps {
  families: FamilyDefinition[];
  /** Map of familyId → number of times it's already nested in the host. */
  usageCounts: Record<string, number>;
  /** Optional thumbnail URL for each family (rendered as a small avatar). */
  thumbnails?: Record<string, string>;
  /** Click-to-add fallback — same payload as drag-drop. */
  onAddInstance: (familyId: string) => void;
}

/** MIME-style payload key for HTML5 drag-and-drop. The PlanCanvas /
 *  workbench drop target reads this off the DataTransfer to learn
 *  which family the user is placing. */
export const NESTED_FAMILY_DRAG_TYPE = 'application/x-bim-ai-family-id';

export function LoadedFamiliesSidebar({
  families,
  usageCounts,
  thumbnails,
  onAddInstance,
}: LoadedFamiliesSidebarProps): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  function onDragStart(event: DragEvent<HTMLLIElement>, familyId: string) {
    event.dataTransfer.setData(NESTED_FAMILY_DRAG_TYPE, familyId);
    event.dataTransfer.setData('text/plain', familyId);
    event.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <section
      className="border rounded p-3 space-y-2"
      aria-label={t('familyEditor.loadedFamiliesAriaLabel')}
    >
      <button
        type="button"
        className="flex items-center gap-2 font-semibold w-full text-left"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        {t('familyEditor.loadedFamiliesHeading')}
        <span className="text-xs text-muted ml-auto">
          {t('familyEditor.loadedFamiliesCount', { count: families.length })}
        </span>
      </button>
      {open && (
        <ul className="space-y-1" data-testid="loaded-families-list">
          {families.length === 0 ? (
            <li className="text-xs text-muted">{t('familyEditor.loadedFamiliesEmpty')}</li>
          ) : (
            families.map((fam) => {
              const count = usageCounts[fam.id] ?? 0;
              const thumbUrl = thumbnails?.[fam.id];
              return (
                <li
                  key={fam.id}
                  className="flex items-center gap-2 text-sm border rounded px-2 py-1"
                  draggable
                  onDragStart={(e) => onDragStart(e, fam.id)}
                  data-testid={`loaded-family-${fam.id}`}
                  data-family-id={fam.id}
                >
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt=""
                      className="w-6 h-6 rounded border"
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className="w-6 h-6 rounded border bg-muted/20 inline-block"
                      aria-hidden="true"
                    />
                  )}
                  <span className="flex-1 truncate">{fam.name}</span>
                  <span
                    className="text-xs text-muted"
                    data-testid={`loaded-family-count-${fam.id}`}
                  >
                    {t('familyEditor.loadedFamilyUsageCount', { count })}
                  </span>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => onAddInstance(fam.id)}
                    aria-label={t('familyEditor.loadedFamilyAdd', { name: fam.name })}
                  >
                    {t('familyEditor.loadedFamilyAddShort')}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </section>
  );
}
