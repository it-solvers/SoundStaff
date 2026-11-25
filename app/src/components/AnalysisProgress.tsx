import type { AnalysisStage } from '../audio/analyze'
import { t } from '../text'

export interface AnalysisState {
  fileName: string
  stage: AnalysisStage
  /** AI 단계와 음표 정리 단계에서 알 수 있는 실제 진행률 (0~100). 다른 단계는 임의의 숫자를 보이지 않고 단계 이름만 보인다. */
  percent?: number
  /** 목소리 분리 단계를 거치는 분석 */
  vocalsOnly?: boolean
}

const ORDER: AnalysisStage[] = ['decode', 'resample', 'separate', 'ai', 'finish']

export default function AnalysisProgress({ state, onCancel }: { state: AnalysisState; onCancel: () => void }) {
  const stages = ORDER.filter((s) => s !== 'separate' || state.vocalsOnly)
  const current = stages.indexOf(state.stage)
  const measured = state.stage === 'separate' || state.stage === 'ai' || state.stage === 'finish'
  return (
    <section
      className="rounded-xl border border-sky-800 bg-sky-950 p-4 sm:p-5"
      role="status"
      aria-live="polite"
      data-testid="analysis-progress"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-sky-100 break-all">{t.audio.analyzing(state.fileName)}</p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          data-testid="analysis-cancel"
        >
          {t.audio.cancel}
        </button>
      </div>
      <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {stages.map((s, i) => (
          <li
            key={s}
            data-testid="analysis-stage"
            data-state={i < current ? 'done' : i === current ? 'active' : 'todo'}
            className={i < current ? 'text-emerald-300' : i === current ? 'font-medium text-sky-100' : 'text-slate-500'}
          >
            {i < current ? '✓ ' : i === current ? '▶ ' : '· '}
            {t.audio.stages[s]}
            {measured && i === current && state.percent !== undefined ? ` ${state.percent}%` : ''}
          </li>
        ))}
      </ol>
      {measured && (
        <progress className="mt-3 h-2 w-full" max={100} value={state.percent ?? 0} data-testid="analysis-bar" />
      )}
    </section>
  )
}
