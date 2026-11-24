import type { MidiFileInfo } from '../midi/types'
import type { SettingsOverride } from '../score/settings'
import ScoreResult, { type ScoreState } from './ScoreResult'
import SettingsForm from './SettingsForm'
import TrackOrder from './TrackOrder'

export interface OutputItem {
  id: string
  /** 화면에 보이는 이름 (파일 이름, 합친 경우 "첫 파일 외 N개") */
  label: string
  info: MidiFileInfo
  /** 합치면서 생긴 경고 (템포·박자·조성 불일치) */
  warnings: string[]
}

interface Props {
  item: OutputItem
  override: SettingsOverride
  state?: ScoreState
  onChange: (patch: SettingsOverride | null) => void
}

/** 악보 하나를 만드는 단위: 설정 입력 칸 + 악기 설정 + 결과 요약 (악보는 자동으로 만들어진다) */
export default function OutputCard({ item, override, state, onChange }: Props) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5" data-testid="output-card">
      <h3 className="break-all text-base font-semibold">{item.label}</h3>
      <SettingsForm info={item.info} override={override} onChange={onChange} />
      <TrackOrder
        info={item.info}
        order={override.trackOrder}
        excluded={override.excludedTracks}
        muted={override.mutedTracks}
        onChange={onChange}
      />
      {state && <ScoreResult state={state} />}
    </section>
  )
}
