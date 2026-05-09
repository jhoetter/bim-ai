import { Component, type ErrorInfo, type ReactNode } from 'react';

import { log } from './logger';

type Props = {
  children: ReactNode;
  label?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    log.error('ErrorBoundary', this.props.label ?? 'unknown', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '2rem',
            color: 'var(--color-muted-foreground)',
            fontSize: '0.85rem',
          }}
        >
          <p style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
            Something went wrong in {this.props.label ?? 'this panel'}.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              maxWidth: 480,
              textAlign: 'center',
            }}
          >
            {this.state.error.message}
          </p>
          <button
            type="button"
            style={{ marginTop: '1rem', cursor: 'pointer' }}
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
