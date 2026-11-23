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
        악보를 만들지 못했습니다: {state.message}
      </div>
    )
  }
  const { report } = state.result
  const rd = report.reduction
  return (
    <div className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/60 p-4" data-testid="score-result">
      <p className="text-sm font-medium text-emerald-200" data-testid="score-summary">
        악보 생성 완료 · {report.measureCount}마디 · 파트 {report.parts.length}개 (
        {report.parts.map((p) => `${p.name} ${p.noteCount}음`).join(', ')})
      </p>
      {rd && (
        <div
          className="mt-3 rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-sm"
          data-testid="reduction-stats"
        >
          <p className="font-medium text-slate-100">피아노로 합친 결과</p>
          <p className="mt-1 text-slate-200">
            원본 음표 {rd.input}개 → 중복 {rd.duplicatesMerged}개 합침 → 한 손으로 칠 수 있게{' '}
            <b data-testid="removed-count">{rd.removed}</b>개 제거 → 오른손 {rd.right}개 · 왼손 {rd.left}개
          </p>
          {rd.removed > 0 && (
            <p className="mt-1 text-amber-200" data-testid="removed-detail">
              제거한 음 {rd.removed}개 ({Math.round((rd.removed / Math.max(1, rd.input - rd.duplicatesMerged)) * 100)}
              %): 동시에 5개를 넘어서 {rd.removedByCount}개, 한 손 음 폭이 10도를 넘어서 {rd.removedBySpan}개
            </p>
          )}
          {rd.pinnedTracks.length > 0 && (
            <p className="mt-1 text-slate-300">
              경계(가온 도) 부근 선율이 끊기지 않게 한 손에 고정:{' '}
              {rd.pinnedTracks.map((t) => `${t.name} → ${t.hand === 'R' ? '오른손' : '왼손'}`).join(', ')}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-400">
            자동으로 합친 피아노 악보는 사람이 편곡한 것만큼 연주하기 좋지 않습니다. Finale에서 손봐 주세요.
          </p>
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
