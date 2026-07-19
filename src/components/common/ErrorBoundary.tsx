import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) {
      console.error(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold">Something went wrong.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                An unexpected error occurred. Please restart the app.
              </p>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
