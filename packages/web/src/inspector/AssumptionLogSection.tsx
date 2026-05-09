import type { AgentTrace, AssumptionEntry } from '@bim-ai/core';

interface Props {
  agentTrace: AgentTrace | null | undefined;
  assumptions?: AssumptionEntry[];
}

export function AssumptionLogSection({ agentTrace, assumptions }: Props) {
  if (!agentTrace) return null;

  return (
    <section
      style={{
        borderTop: '1px solid var(--color-border)',
        paddingTop: 'var(--space-3)',
        marginTop: 'var(--space-3)',
      }}
    >
      <p
        style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 500,
          color: 'var(--color-muted-foreground)',
          marginBottom: 'var(--space-2)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Agent provenance
      </p>

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 'var(--space-1) var(--space-3)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-foreground)',
        }}
      >
        <dt style={{ color: 'var(--color-muted-foreground)' }}>Bundle</dt>
        <dd
          style={{
            fontFamily: 'var(--font-mono)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={agentTrace.bundleId}
        >
          {agentTrace.bundleId.slice(0, 8)}
        </dd>

        <dt style={{ color: 'var(--color-muted-foreground)' }}>Applied</dt>
        <dd>{new Date(agentTrace.appliedAt).toLocaleString()}</dd>
      </dl>

      {agentTrace.assumptionKeys.length > 0 && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-muted-foreground)',
              marginBottom: 'var(--space-1)',
            }}
          >
            Assumptions ({agentTrace.assumptionKeys.length})
          </p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-1)',
            }}
          >
            {agentTrace.assumptionKeys.map((key) => {
              const entry = assumptions?.find((a) => a.key === key);
              return (
                <li
                  key={key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-foreground)',
                    }}
                  >
                    {key}
                  </span>
                  {entry && (
                    <span
                      style={{
                        color: 'var(--color-muted-foreground)',
                        flexShrink: 0,
                      }}
                    >
                      {Math.round(entry.confidence * 100)}%
                      {entry.contestable === false ? ' (locked)' : ''}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
