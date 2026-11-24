import { t } from '../text'
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
      className={`sticky top-0 z-30 -mx-4 border-b border-slate-800 bg-slate-950/90 px-4 py-2 backdrop-blur transition-shadow duration-300 motion-reduce:transition-none sm:-mx-6 sm:px-6 ${
        showTitle ? 'shadow-lg shadow-black/20' : 'shadow-none'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {/*
          맨 위에서는 큰 제목이 이미 보이므로 두 번 표시하지 않고, 큰 제목이 가려지면 이름·버전을 보여 준다.
          제목을 넣고 빼는 대신 항상 두고, 폭·높이·투명도·위치를 천천히 바꿔서 툭 나타나거나 내용이 밀리지 않게 한다.
          (제목이 차지하던 줄 간격·옆 간격도 같이 줄여 감춰진 동안에는 자리를 전혀 차지하지 않는다.)
        */}
        <div
          className={`grid w-full transition-[grid-template-columns,grid-template-rows,opacity,transform,margin] duration-[350ms] ease-in-out motion-reduce:transition-none sm:w-auto ${
            showTitle
              ? 'mb-0 grid-rows-[1fr] opacity-100 sm:mr-0 sm:grid-cols-[1fr]'
              : '-mb-1 grid-rows-[0fr] -translate-y-1 opacity-0 sm:mb-0 sm:-mr-4 sm:grid-cols-[0fr] sm:grid-rows-[1fr] sm:translate-y-0'
          }`}
          aria-hidden={!showTitle}
          data-testid="step-bar-title-wrap"
          data-visible={showTitle ? 'true' : 'false'}
        >
          {/* 안쪽 상자가 실제 내용 크기만큼만 펼쳐지게 한다 (폭은 PC, 높이는 폰) */}
          <div className="min-h-0 min-w-0 overflow-hidden whitespace-nowrap">
            <p className="text-[21px] leading-tight font-semibold text-slate-100" data-testid="step-bar-title">
              {t.appName} <span className="font-normal text-slate-400">({APP_VERSION})</span>
            </p>
          </div>
        </div>
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
