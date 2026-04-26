import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("ErrorBoundary caught:", error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center gap-4 py-24 text-center px-4">
            <p className="text-lg font-semibold text-destructive">Une erreur est survenue.</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              {this.state.error.message}
            </p>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => this.setState({ error: null })}
            >
              Réessayer
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
