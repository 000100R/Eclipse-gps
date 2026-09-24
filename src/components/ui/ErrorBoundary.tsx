import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: any, errorInfo: any) {
    console.warn('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    (this as any).setState({ hasError: false, error: null });
  };

  public render(): ReactNode {
    const state = (this as any).state as State;
    const props = (this as any).props as Props;

    if (state.hasError) {
      if (props.fallback) {
        return props.fallback;
      }

      return (
        <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="w-14 h-14 rounded-2xl bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center mb-4 text-indigo-400 text-xl font-bold shadow-lg">
            ⚡
          </div>
          <h2 className="text-base font-bold text-neutral-100 uppercase tracking-wider mb-2">
            Eclipse GPS Recovered
          </h2>
          <p className="text-xs text-neutral-400 max-w-sm mb-6 leading-relaxed">
            The workspace encountered a temporary rendering interruption and restored safety defaults.
          </p>
          <button
            onClick={this.handleReload}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/30"
          >
            Resume Navigation
          </button>
        </div>
      );
    }

    return props.children;
  }
}
