import { t } from '../text/ko'
import { setThemeMode, useTheme, type ThemeMode } from '../theme/theme'

const MODES: ThemeMode[] = ['auto', 'light', 'dark']
const clock = (d: Date) => new Intl.DateTimeFormat('ko-KR', { timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(d)

/** 화면 색 선택: 자동(일출·일몰 기준) / 밝게 / 어둡게 */
export default function ThemeToggle() {
  const { mode, resolved, sun } = useTheme()
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end" data-testid="theme-toggle">
      <div
        role="group"
        aria-label={t.theme.label}
        className="inline-flex overflow-hidden rounded-lg border border-slate-700"
      >
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setThemeMode(m)}
            className={`px-3 py-1.5 text-xs font-medium ${
              mode === m ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
            data-testid={`theme-${m}`}
          >
            {t.theme[m]}
          </button>
        ))}
      </div>
      {sun && (
        <p className="text-xs text-slate-400" data-testid="theme-note">
          {t.theme.autoNote(clock(sun.sunrise), clock(sun.sunset), resolved === 'light' ? t.theme.light : t.theme.dark)}
        </p>
      )}
    </div>
  )
}
