import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 应用级错误兜底：任何页面渲染期异常不再导致整树白屏，
 * 显示品牌一致的错误页并提供「重新加载」出口，错误输出到控制台便于排查。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-bg">
          <TriangleAlert className="h-7 w-7 text-danger" />
        </div>
        <h1 className="mt-5 text-h2 text-neutral-950">页面出现异常</h1>
        <p className="mt-2 max-w-md text-body-sm text-neutral-500">
          当前页面遇到意外错误，你的数据未受影响。请尝试重新加载；若问题持续出现，请联系管理员。
        </p>
        <p className="mt-3 max-w-md truncate rounded-md bg-neutral-100 px-3 py-1.5 font-mono text-caption text-neutral-400">
          {this.state.error.message}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-700"
        >
          <RotateCcw className="h-4 w-4" />
          重新加载
        </button>
      </div>
    )
  }
}
