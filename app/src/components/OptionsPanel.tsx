import type { ConvertMode } from '../score/types'

const OPTIONS: { value: ConvertMode; label: string; desc: string }[] = [
  { value: 'piano', label: '피아노로 합치기', desc: '모든 악기를 오른손·왼손 두 줄로 합칩니다. 한 손으로 칠 수 있게 일부 음은 빠집니다.' },
  { value: 'instrument', label: '악기별 악보', desc: '악기(트랙)마다 한 줄씩 악보를 만듭니다. 음은 빠지지 않습니다.' },
]

export default function OptionsPanel({ mode, onChange }: { mode: ConvertMode; onChange: (m: ConvertMode) => void }) {
  return (
    <fieldset className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5" data-testid="options-panel">
      <legend className="px-1 text-base font-semibold">변환 방식</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${mode === o.value ? 'border-sky-500 bg-sky-950' : 'border-slate-700 bg-slate-800/60'}`}
          >
            <input type="radio" name="convert-mode" value={o.value} checked={mode === o.value} onChange={() => onChange(o.value)} className="mt-1" data-testid={`mode-${o.value}`} />
            <span>
              <span className="block font-medium">{o.label}</span>
              <span className="mt-0.5 block text-xs text-slate-300">{o.desc}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
