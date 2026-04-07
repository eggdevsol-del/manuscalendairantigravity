import { Component, type ReactNode } from "react";
import { reportError } from "@/lib/errorReporter";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  boundary?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches React render errors, reports to server, shows fallback.
 *
 * Inline styles are intentional: design tokens/CSS may be the thing that broke.
 * This is a documented exception to the design-tokens-only rule.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, {
      boundary: this.props.boundary || "unknown",
      componentStack: info.componentStack || undefined,
    });
  }

  handleRetry = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      // Inline styles: design tokens may not be available during error
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
            textAlign: "center",
            minHeight: "200px",
            gap: "16px",
          }}
        >
          <div style={{ fontSize: "32px" }}>😵</div>
          <h3
            style={{ fontSize: "16px", fontWeight: 700, color: "#e8e6f0" }}
          >
            Something went wrong
          </h3>
          <p
            style={{
              fontSize: "13px",
              color: "#9896a8",
              maxWidth: "320px",
            }}
          >
            This error has been logged automatically.
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              border: "1px solid rgba(120,100,255,0.3)",
              background: "rgba(124,106,255,0.15)",
              color: "#9b8aff",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
