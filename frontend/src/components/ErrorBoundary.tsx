import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCcw } from "lucide-react";

type Props = { children: ReactNode; /** Shown above the retry button. */ label?: string };
type State = { error: Error | null };

/**
 * Catches rendering errors in part of the UI so one broken panel can't blank the whole app.
 * Shows a friendly message with "Try again" (re-mounts the section) and "Reload app".
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  /** Switches to the fallback UI after an error. */
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  /** Logs the error for diagnostics (no personal data is included). */
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI section crashed:", error.message, info.componentStack?.split("\n").slice(0, 3).join(" "));
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-boundary card" role="alert">
        <b>{this.props.label || "Something went wrong in this section."}</b>
        <p className="muted">Your data is safe. Try again, or reload the app if it keeps happening.</p>
        <div className="error-boundary-actions">
          <button type="button" className="btn soft" onClick={() => this.setState({ error: null })}>
            <RefreshCcw size={16} aria-hidden="true" /> Try again
          </button>
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
