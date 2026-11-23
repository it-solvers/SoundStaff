import { t } from '../text/ko'
import type { ConvertMode, OutputUnit } from '../score/types'

interface Props {
  /** 음원 분석 결과가 있으면 합치지 않는다는 안내를 보여 준다 */
  hasAudio?: boolean
  unit: OutputUnit
  mode: ConvertMode
  onUnit: (u: OutputUnit) => void
  onMode: (m: ConvertMode) => void
}

function Choice<T extends string>(props: {
  legend: string
  name: string
  value: T
  options: { value: T; label: string; desc: string }[]
  onChange: (v: T) => void
}) {
  return (
    <fieldset className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <legend className="px-1 text-base font-semibold">{props.legend}</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {props.options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${
              props.value === o.value ? 'border-sky-500 bg-sky-950' : 'border-slate-700 bg-slate-800/60'
            }`}
          >
            <input
              type="radio"
              name={props.name}
              value={o.value}
              checked={props.value === o.value}
              onChange={() => props.onChange(o.value)}
              className="mt-1"
              data-testid={`${props.name}-${o.value}`}
            />
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

/** 출력 단위(합쳐서 하나 / 파일별)와 변환 방식(피아노 / 악기별) 선택 */
export default function OptionsPanel({ unit, mode, hasAudio, onUnit, onMode }: Props) {
  return (
    <div className="grid gap-4" data-testid="options-panel">
      <Choice
        legend={t.options.unitLegend}
        name="unit"
        value={unit}
        onChange={onUnit}
        options={[
          { value: 'merged', ...t.options.unit.merged },
          { value: 'separate', ...t.options.unit.separate },
        ]}
      />
      {hasAudio && (
        <p className="-mt-2 text-xs text-slate-400" data-testid="audio-separate-note">
          {t.audio.separateNote}
        </p>
      )}
      <Choice
        legend={t.options.modeLegend}
        name="mode"
        value={mode}
        onChange={onMode}
        options={[
          { value: 'piano', ...t.options.mode.piano },
          { value: 'instrument', ...t.options.mode.instrument },
        ]}
      />
    </div>
  )
}
