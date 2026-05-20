import React, { useState, type ReactElement } from 'react';
import { searchHelpTopics, HelpTopic } from './helpTopics';

interface HelpSearchPanelProps {
  onClose: () => void;
}

export function HelpSearchPanel({ onClose }: HelpSearchPanelProps): ReactElement {
  const [query, setQuery] = useState('');
  const results = searchHelpTopics(query);

  return (
    <div
      data-testid="help-search-panel"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 480,
        maxHeight: 500,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10000,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Help Search</span>
        <button
          data-testid="help-search-close"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            color: 'inherit',
          }}
        >
          ✕
        </button>
      </div>
      {/* Search input */}
      <div style={{ padding: '8px 12px' }}>
        <input
          data-testid="help-search-input"
          autoFocus
          type="text"
          placeholder="Search help topics..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
          style={{
            width: '100%',
            fontSize: 13,
            padding: '6px 10px',
            borderRadius: 4,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-strong)',
            color: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>
      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {results.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--color-muted-foreground)', margin: 8 }}>
            No results for &quot;{query}&quot;
          </p>
        ) : (
          results.map((topic: HelpTopic) => (
            <div
              key={topic.id}
              data-testid={`help-topic-${topic.id}`}
              style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{topic.title}</span>
                {topic.shortcut && (
                  <kbd
                    style={{
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: 'var(--color-surface-strong)',
                      border: '1px solid var(--color-border-strong)',
                    }}
                  >
                    {topic.shortcut}
                  </kbd>
                )}
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: 'var(--color-muted-foreground)',
                  margin: '3px 0 0',
                  lineHeight: 1.4,
                }}
              >
                {topic.summary}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
