import { t } from '../text/ko'
import type { BuildResult } from '../score/types'

export type ScoreState = { status: 'ok'; result: BuildResult } | { status: 'error'; message: string }

export default function ScoreResult({ state }: { state: ScoreState }) {
  if (state.status === 'error') {
    return (
      <div
        className="mt-4 rounded-lg border border-rose-900 bg-rose-950/60 px-3 py-2 text-sm text-rose-200"
        role="alert"
        data-testid="score-error"
      >
        {t.result.error(state.message)}
      </div>
    )
  }
  const { report } = state.result
  const parts = t.result.partsSummary(
    report.parts.map((p) => t.result.partItem(p.name, p.noteCount)).join(', '),
    report.parts.length,
  )
  return (
    <div className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/60 p-4" data-testid="score-result">
      <p className="text-sm font-medium text-emerald-200" data-testid="score-summary">
        {t.result.done(report.measureCount, parts)}
      </p>
      {report.warnings.length > 0 && (
        // 알림이 많아도 화면을 차지하지 않게 기본은 접어 두고, 누르면 펼친다
        <details className="mt-2" data-testid="score-warnings-box">
          <summary
            className="inline-flex min-h-9 cursor-pointer items-center text-sm text-amber-200"
            data-testid="score-warnings-toggle"
          >
            ⚠ {t.result.warningsSummary(report.warnings.length)}
          </summary>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-200" data-testid="score-warnings">
            {report.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
