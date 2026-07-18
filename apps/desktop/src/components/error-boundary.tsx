import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-bg-base">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-text-primary mb-4">
              Something went wrong
            </h1>
            <button
              onClick={() => window.location.reload()}
              className="bg-accent text-bg-deep px-4 py-2 rounded-md font-semibold text-sm hover:bg-accent-hover transition-all"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
