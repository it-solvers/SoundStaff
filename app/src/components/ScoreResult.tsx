import type { BuildResult } from '../score/types'

export type ScoreState = { status: 'ok'; result: BuildResult } | { status: 'error'; message: string }

export default function ScoreResult({ state }: { state: ScoreState }) {
  if (state.status === 'error') {
    return (
      <div className="mt-4 rounded-lg border border-rose-900 bg-rose-950/60 px-3 py-2 text-sm text-rose-200" role="alert" data-testid="score-error">
        악보를 만들지 못했습니다: {state.message}
      </div>
    )
  }
  const { report } = state.result
  return (
    <div className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/60 p-4" data-testid="score-result">
      <p className="text-sm font-medium text-emerald-200" data-testid="score-summary">
        악보 생성 완료 · {report.measureCount}마디 · 파트 {report.parts.length}개 ({report.parts.map((p) => `${p.name} ${p.noteCount}음`).join(', ')})
      </p>
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
