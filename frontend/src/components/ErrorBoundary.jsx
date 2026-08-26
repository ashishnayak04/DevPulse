import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'var(--bg-base, #0a0a0f)',
            color: 'var(--text-primary, #f1f5f9)',
            padding: 32,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 14, marginBottom: 20, maxWidth: 420 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: '1px solid var(--border, #1e293b)',
              background: 'var(--bg-surface, #111827)',
              color: 'var(--text-primary, #f1f5f9)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
