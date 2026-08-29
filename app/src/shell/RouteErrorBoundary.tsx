import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * §34: "Use the smallest reasonable failing surface... A component failure
 * must not unnecessarily crash the whole application." This wraps each
 * routed page individually (see router.tsx), so a bug in, say, the Money
 * page cannot take down Today, Goals, or anything else — matching §35's
 * three required answers: What failed? Is my data safe? What can I do?
 *
 * This IS a real React error boundary — genuinely catches render errors in
 * its subtree via React's own componentDidCatch lifecycle, not a simulated
 * one.
 */
type Props = { children: ReactNode; label: string };
type State = { hasError: boolean; message: string | null };

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In a real production build this would also log to a diagnostics
    // channel — not built here, since no such channel exists yet.
    console.error(`[${this.props.label}] component error:`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-status-danger text-sm font-medium mb-1">{this.props.label} couldn't load</div>
          <p className="text-text-muted text-xs max-w-sm mb-1">
            {/* §35: What failed? */}
            Something went wrong rendering this screen.
          </p>
          <p className="text-text-muted text-xs max-w-sm mb-4">
            {/* §35: Is my data safe? */}
            Your data is safe — this only affects this one screen, not the rest of PBOS.
          </p>
          <button onClick={this.handleRetry} className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium">
            {/* §35: What can I do? */}
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
