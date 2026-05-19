import type { Element } from '@bim-ai/core';

import { collectRendererDiagnostics } from './collectRendererDiagnostics';
import { elementRenderFeatureStatus } from './elementRenderFeatureStatus';
import type { RendererDiagnostic } from './rendererDiagnostics';
import { summarizeRendererDiagnostics } from './rendererDiagnostics';

export function ElementRenderStatusPanel(props: {
  element: Element;
  elementsById: Record<string, Element | undefined>;
  viewId?: string | null;
}) {
  const elementsById = compactElementsById(props.elementsById);
  const status = elementRenderFeatureStatus(props.element, elementsById);
  const diagnostics = collectRendererDiagnostics({
    elementsById,
    viewId: props.viewId,
    evidence: { source: 'viewport' },
  }).filter((diagnostic) => diagnostic.elementIds.includes(props.element.id));
  const summary = summarizeRendererDiagnostics(diagnostics);
  const modelInvalid = diagnostics.filter((diagnostic) => diagnostic.issueClass === 'model-invalid');
  const rendererIssues = diagnostics.filter((diagnostic) => diagnostic.issueClass !== 'model-invalid');

  return (
    <div className="mt-3 rounded border border-border bg-surface p-2 text-[10px]">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-semibold text-foreground">Render status</span>
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted">
          {status.implementation.state}
        </span>
        {status.blocking ? (
          <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] text-red-700">
            blocking
          </span>
        ) : null}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-muted">
        <dt>Geometry</dt>
        <dd className="font-mono">
          {status.geometry.feature} · {status.geometry.state} · {status.geometry.implementation}
        </dd>
        <dt>Material</dt>
        <dd className="font-mono">{status.material.state}</dd>
        <dt>Export</dt>
        <dd className="font-mono">{status.exportSupport.state}</dd>
        <dt>Diagnostics</dt>
        <dd className="font-mono">
          {summary.total} total · {summary.modelInvalidIssues} model · {summary.rendererIssues}{' '}
          renderer
        </dd>
      </dl>

      {status.diagnosticCodes.length ? (
        <div className="mt-2 text-muted">
          <div className="font-semibold">Codes</div>
          <code className="block break-all">{status.diagnosticCodes.join(', ')}</code>
        </div>
      ) : null}

      {modelInvalid.length ? <DiagnosticList title="Model invalid" rows={modelInvalid} /> : null}
      {rendererIssues.length ? (
        <DiagnosticList title="Renderer unsupported or degraded" rows={rendererIssues} />
      ) : null}
    </div>
  );
}

function DiagnosticList(props: { title: string; rows: RendererDiagnostic[] }) {
  return (
    <div className="mt-2 text-muted">
      <div className="font-semibold">{props.title}</div>
      <ul className="mt-1 space-y-1">
        {props.rows.slice(0, 4).map((diagnostic) => (
          <li key={`${diagnostic.code}:${diagnostic.elementIds.join(',')}`}>
            <code className="break-all">{diagnostic.code}</code>
            <span> · {diagnostic.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function compactElementsById(
  elementsById: Record<string, Element | undefined>,
): Record<string, Element> {
  return Object.fromEntries(
    Object.entries(elementsById).filter((entry): entry is [string, Element] => !!entry[1]),
  );
}
