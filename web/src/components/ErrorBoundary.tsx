import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
          <div className="text-4xl">Something went wrong</div>
          <p className="text-sm text-taupe max-w-md text-center">
            An unexpected error occurred. Try going back or refreshing the page.
          </p>
          {this.state.error && (
            <pre className="text-xs text-red-600 bg-red-50 rounded-lg p-3 max-w-lg overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-taupe text-espresso hover:bg-cream"
            >
              Go Back
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-gold text-white hover:bg-yellow-600"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
