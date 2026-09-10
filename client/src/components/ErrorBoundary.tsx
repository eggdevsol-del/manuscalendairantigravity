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
            padding:
              "calc(var(--app-safe-top, 0px) + 32px) 24px calc(var(--app-safe-bottom, 0px) + 32px)",
            background: "var(--v3-paper, #faf9f6)",
            color: "var(--v3-ink, #242522)",
            textAlign: "center",
            minHeight: "200px",
            gap: "16px",
          }}
        >
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--v3-ink, #242522)",
            }}
          >
            Something went wrong
          </h3>
          <p
            style={{
              fontSize: "13px",
              color: "var(--v3-muted, #666860)",
              maxWidth: "320px",
            }}
          >
            This part of the page couldn’t load. Try again, or reload the app if
            the problem continues.
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: "12px 20px",
              minHeight: "44px",
              borderRadius: "8px",
              border: "1px solid var(--v3-line, #d9d8d1)",
              background: "var(--v3-gold, #cfb878)",
              color: "var(--v3-ink, #242522)",
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
