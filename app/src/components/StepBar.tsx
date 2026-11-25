import { t } from '../text'

/**
 * 제목 아래의 얇은 단계 막대. 제목과 함께 화면 위에 붙어(App.tsx) 스크롤을 내려도 지금 어느 단계인지 보인다.
 */
export default function StepBar({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = t.guide.steps
  return (
    <nav aria-label={t.guide.title} data-testid="step-bar" className="mt-2">
      <ol className="flex min-w-0 items-center gap-1 text-xs sm:gap-2 sm:text-sm">
        {t.guide.short.map((label, i) => {
          const no = i + 1
          const state = no < current ? 'done' : no === current ? 'active' : 'todo'
          return (
            <li key={label} className="flex items-center gap-1 sm:gap-2" data-testid="step-chip" data-state={state}>
              {i > 0 && (
                <span aria-hidden="true" className="text-slate-500">
                  ›
                </span>
              )}
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  state === 'done'
                    ? 'bg-emerald-700 text-white'
                    : state === 'active'
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-700 text-white'
                }`}
                aria-hidden="true"
              >
                {state === 'done' ? '✓' : no}
              </span>
              {/* 좁은 화면에서는 지금 단계의 이름만 보여 준다 */}
              <span
                className={`${state === 'active' ? 'font-medium text-sky-100' : 'hidden text-slate-400 sm:inline'}`}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-1 truncate text-xs text-slate-300 sm:text-sm" data-testid="step-bar-desc">
        {t.guide.barLabel(current, steps.length, steps[current - 1].title, steps[current - 1].desc)}
      </p>
    </nav>
  )
}
