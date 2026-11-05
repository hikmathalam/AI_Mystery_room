import { Component, type ErrorInfo, type ReactNode } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";

type State = { failed: boolean };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("A page could not be rendered:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="error-boundary"><span><CircleAlert size={22}/></span><div className="section-kicker">INVESTIGATION INTERRUPTED</div><h1>This page could not be opened.</h1><p>Your case is still saved. Refresh the page to try again.</p><button type="button" className="button button-gold" onClick={() => window.location.reload()}><RotateCcw size={15}/> Refresh page</button></main>;
  }
}
