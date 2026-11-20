import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'An unexpected error occurred.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF8F3] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E8E8E8] rounded-xl p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#C6A15B] mb-2">
              Diamond Market Notice
            </p>
            <h1 className="text-xl font-bold text-[#111111] mb-3">
              Something went wrong
            </h1>
            <p className="text-sm text-[#6B7280] mb-6 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[#111111] text-white text-sm font-medium rounded-lg hover:bg-[#292929] transition-colors cursor-pointer"
            >
              Reload Storefront
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
