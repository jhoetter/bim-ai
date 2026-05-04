import { Panel } from '@bim-ai/ui';

/** Placeholder until live section cuts are modeled in-core */
export function SectionPlaceholderPane(props: { activeLevelLabel: string }) {
  return (
    <Panel title={`Section (${props.activeLevelLabel})`}>
      <p className="text-[11px] leading-snug text-muted">
        Future: synchronized section / elevation previews tied to active level and selection.
      </p>
    </Panel>
  );
}
