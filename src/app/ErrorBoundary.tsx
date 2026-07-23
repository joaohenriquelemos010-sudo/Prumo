import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/Button'
import { Blob } from '@/components/Blob'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Route-level error boundary. Never shows a white screen or a stack trace —
 * only a warm fallback and a way forward. The real error is logged (and, in
 * production, would go to the audit / observability sink), not shown.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="relative grid min-h-[70vh] place-items-center px-md py-2xl text-center">
        <Blob variant="c" intensity={0.4} className="left-1/2 top-10 size-80 -translate-x-1/2" />
        <div className="flex max-w-md flex-col items-center gap-md">
          <h1 className="text-3xl">Algo não funcionou aqui</h1>
          <p className="text-ink-soft">
            Já estamos vendo isso. Nada do seu caminho se perdeu — é só recarregar
            esta parte e seguir.
          </p>
          <Button onClick={this.handleReset}>Tentar de novo</Button>
        </div>
      </div>
    )
  }
}
