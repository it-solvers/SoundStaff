import { t } from '../text/ko'
import { APP_VERSION } from '../version'

/**
 * 화면 위쪽에 고정되는 얇은 단계 막대. 스크롤을 내려도 지금 어느 단계인지 보인다.
 */
export default function StepBar({ current, showTitle }: { current: 1 | 2 | 3 | 4; showTitle: boolean }) {
  const steps = t.guide.steps
  return (
    <nav
      aria-label={t.guide.title}
      data-testid="step-bar"
      className="sticky top-0 z-30 -mx-4 border-b border-slate-800 bg-slate-950/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {/* 맨 위에서는 큰 제목이 이미 보이므로 두 번 표시하지 않고, 큰 제목이 가려진 뒤에만 이름·버전을 보여 준다 */}
        {showTitle && (
          <p
            className="w-full text-[21px] leading-tight font-semibold text-slate-100 sm:w-auto"
            data-testid="step-bar-title"
          >
            {t.appName} <span className="font-normal text-slate-400">({APP_VERSION})</span>
          </p>
        )}
        <ol className="flex min-w-0 flex-1 items-center gap-1 text-xs sm:gap-2 sm:text-sm">
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
      </div>
      <p className="mt-1 truncate text-xs text-slate-300 sm:text-sm" data-testid="step-bar-desc">
        {t.guide.barLabel(current, steps.length, steps[current - 1].title, steps[current - 1].desc)}
      </p>
    </nav>
  )
}
