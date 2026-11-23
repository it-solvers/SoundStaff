import { CHANGELOG } from '../changelog'
import { t } from '../text/ko'

export default function ChangeLog() {
  return (
    <details className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm" data-testid="changelog">
      <summary className="cursor-pointer font-medium text-slate-300">{t.changelog.title}</summary>
      <div className="mt-3 space-y-4">
        {CHANGELOG.map((c) => (
          <section key={c.version}>
            <h3 className="font-semibold">
              {c.version} <span className="font-normal text-slate-400">({c.date})</span>
            </h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-300">
              {c.changes.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  )
}
