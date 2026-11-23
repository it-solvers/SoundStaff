import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../text/ko'

/** 화면을 그리다 예상 못 한 오류가 나도 빈 화면이 되지 않게 안내를 보여 준다 (기획서 11.3장). 상세 내용은 콘솔에만 남긴다. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="mx-auto max-w-xl p-6" role="alert" data-testid="fatal-error">
        <p className="rounded-xl border border-rose-900 bg-rose-950/60 p-4 text-rose-200">{t.errors.unexpected}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600"
        >
          {t.errors.reload}
        </button>
      </div>
    )
  }
}
