import type { MidiFileInfo } from '../midi/types'
import { materializeAudio } from '../score/audioInfo'
import { applySettings, type SettingsOverride } from '../score/settings'
import { t } from '../text'
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
  /** 설정을 바꿔 악보를 다시 만드는 중 */
  busy?: boolean
  onChange: (patch: SettingsOverride | null) => void
}

/** 악보 하나를 만드는 단위: 설정 입력 칸 + 악기 설정 + 결과 요약 (악보는 자동으로 만들어진다) */
export default function OutputCard({ item, override, state, busy, onChange }: Props) {
  // 음원 분석 결과는 악보 방식(들리는 대로 / 멜로디만)에 따라 단이 달라지므로 지금 방식으로 만든 단을 보여 준다
  const shown = materializeAudio(item.info, applySettings(item.info, override))
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5" data-testid="output-card">
      <h3 className="break-all text-base font-semibold">{item.label}</h3>
      <SettingsForm info={item.info} override={override} onChange={onChange} />
      {busy && (
        <p className="mt-3 rounded-lg bg-sky-950 px-3 py-2 text-sm text-sky-100" role="status" data-testid="rebuilding">
          {t.result.rebuilding}
        </p>
      )}
      <TrackOrder
        info={shown}
        order={override.trackOrder}
        excluded={override.excludedTracks}
        muted={override.mutedTracks}
        onChange={onChange}
        reorder={!(item.info.source === 'audio' && (override.audioMode ?? 'full') === 'full')}
      />
      {state && <ScoreResult state={state} />}
    </section>
  )
}
