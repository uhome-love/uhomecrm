import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Module name for structured logging (e.g. "pipeline", "ceo-dashboard") */
  module?: string;
  onError?: (error: Error, info: string) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const module = this.props.module || "unknown";
    const stack = errorInfo.componentStack || "";

    // Structured log
    console.error(JSON.stringify({
      type: "error_boundary",
      module,
      error: error.message,
      name: error.name,
      componentStack: stack.split("\n").slice(0, 8).join("\n"),
      timestamp: new Date().toISOString(),
    }));

    this.props.onError?.(error, stack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      const module = this.props.module;
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <span className="text-destructive font-semibold">Erro inesperado</span>
          <span className="text-sm text-muted-foreground max-w-md text-center">
            {this.state.error?.message || "Erro desconhecido"}
          </span>
          {module && (
            <span className="text-[10px] text-muted-foreground/60 font-mono">
              módulo: {module}
            </span>
          )}
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
