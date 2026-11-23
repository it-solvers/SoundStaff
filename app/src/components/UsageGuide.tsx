import { t } from '../text/ko'

/** 사용 방법 안내. current는 지금 해야 할 단계(1~5)이고 그 앞 단계는 완료로 표시한다. */
export default function UsageGuide({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <details open className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5" data-testid="usage-guide">
      <summary className="cursor-pointer text-base font-semibold">{t.guide.title}</summary>
      <ol className="mt-4 grid gap-3 sm:grid-cols-5">
        {t.guide.steps.map((s, i) => {
          const no = i + 1
          const done = no < current
          const active = no === current
          return (
            <li
              key={s.title}
              data-testid="usage-step"
              data-state={done ? 'done' : active ? 'active' : 'todo'}
              className={`rounded-lg border p-3 text-sm ${
                active
                  ? 'border-sky-500 bg-sky-950'
                  : done
                    ? 'border-emerald-900 bg-emerald-950/60'
                    : 'border-slate-800 bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    done
                      ? 'bg-emerald-700 text-white'
                      : active
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-700 text-slate-300'
                  }`}
                  aria-hidden="true"
                >
                  {done ? '✓' : no}
                </span>
                <span className="font-medium">{s.title}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">{s.desc}</p>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-xs text-slate-400">{t.guide.footer}</p>
    </details>
  )
}
