import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-zinc-400">
          <h2 className="text-xl font-bold text-rose-400 mb-2">Something went wrong</h2>
          <pre className="text-sm whitespace-pre-wrap">{this.state.error?.message}</pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
