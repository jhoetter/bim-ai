import { useState } from 'react';

import { Btn } from '@bim-ai/ui';

/** Lightweight ergonomics pane for agent-style review workflows */
export function AgentReviewPane() {
  const [schemaTxt, setSchemaTxt] = useState<string | null>(null);

  return (
    <div className="space-y-2 text-[11px]">
      <div className="font-semibold text-muted">Agent checklist</div>
      <ol className="list-decimal space-y-1 ps-5 text-muted">
        <li>bim-ai schema &amp; presets</li>
        <li>bim-ai validate / summary</li>
        <li>bim-ai apply-bundle --dry-run</li>
      </ol>
      <Btn
        type="button"
        variant="quiet"
        className="text-[11px]"
        onClick={() =>
          void (async () => {
            try {
              const res = await fetch('/api/schema');
              const body = JSON.parse(await res.text()) as unknown;
              if (!res.ok) throw new Error(String(body));
              setSchemaTxt(JSON.stringify(body, null, 2));
            } catch {
              setSchemaTxt('failed to fetch /api/schema');
            }
          })()
        }
      >
        Load /api/schema
      </Btn>
      {schemaTxt ? (
        <pre className="max-h-48 overflow-auto rounded border bg-background p-2 text-[10px]">
          {schemaTxt}
        </pre>
      ) : null}
    </div>
  );
}
