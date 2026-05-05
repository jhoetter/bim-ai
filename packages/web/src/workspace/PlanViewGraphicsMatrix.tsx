import type { PlanGraphicsMatrixRow } from '../plan/planProjection';

export function PlanViewGraphicsMatrix(props: {
  rows: PlanGraphicsMatrixRow[];
  /** Replaces default footnote (e.g. view_template authoring readout). */
  footnote?: string;
}) {
  if (!props.rows.length) return null;
  return (
    <div
      className="border-border mt-2 rounded border border-dashed border-border p-2 pt-2"
      data-bim-plan-graphics-matrix="1"
    >
      <div className="mb-1.5 font-semibold text-muted">Graphics and annotations matrix</div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-0.5 pr-2 font-normal">Setting</th>
              <th className="py-0.5 pr-2 font-mono font-normal">Template</th>
              <th className="py-0.5 pr-2 font-mono font-normal">Stored</th>
              <th className="py-0.5 font-mono font-normal">Effective</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((r) => (
              <tr key={r.label} className="border-b border-border/60 last:border-b-0">
                <td className="py-0.5 pr-2 text-muted">{r.label}</td>
                <td className="py-0.5 pr-2 font-mono">{r.template}</td>
                <td className="py-0.5 pr-2 font-mono">{r.stored}</td>
                <td className="py-0.5 font-mono font-medium text-foreground">{r.effective}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 leading-snug text-[9px] text-muted">
        {props.footnote ??
          'Effective column matches symbology inputs: resolvePlanGraphicHints, resolvePlanAnnotationHints, resolvePlanViewDisplay.'}
      </p>
    </div>
  );
}
