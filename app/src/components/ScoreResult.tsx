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
  const rd = report.reduction
  const parts = t.result.partsSummary(
    report.parts.map((p) => t.result.partItem(p.name, p.noteCount)).join(', '),
    report.parts.length,
  )
  return (
    <div className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/60 p-4" data-testid="score-result">
      <p className="text-sm font-medium text-emerald-200" data-testid="score-summary">
        {t.result.done(report.measureCount, parts)}
      </p>
      {rd && (
        <div
          className="mt-3 rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-sm"
          data-testid="reduction-stats"
        >
          <p className="font-medium text-slate-100">{t.result.reduction.heading}</p>
          <p className="mt-1 text-slate-200">
            {t.result.reduction.flow(rd.input, rd.duplicatesMerged, rd.right, rd.left).before}
            <b data-testid="removed-count">{rd.removed}</b>
            {t.result.reduction.flow(rd.input, rd.duplicatesMerged, rd.right, rd.left).after}
          </p>
          {rd.removed > 0 && (
            <p className="mt-1 text-amber-200" data-testid="removed-detail">
              {t.result.reduction.removedDetail(
                rd.removed,
                Math.round((rd.removed / Math.max(1, rd.input - rd.duplicatesMerged)) * 100),
                rd.removedByCount,
                rd.removedBySpan,
              )}
            </p>
          )}
          {rd.pinnedTracks.length > 0 && (
            <p className="mt-1 text-slate-300">
              {t.result.reduction.pinned(
                rd.pinnedTracks
                  .map((p) => `${p.name} → ${p.hand === 'R' ? t.result.reduction.right : t.result.reduction.left}`)
                  .join(', '),
              )}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-400">{t.result.reduction.caveat}</p>
        </div>
      )}
      {report.warnings.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-200" data-testid="score-warnings">
          {report.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
