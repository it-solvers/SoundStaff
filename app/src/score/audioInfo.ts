import type { MidiFileInfo } from '../midi/types'
import { toNoteEvents } from '../audio/toInfo'
import type { ScoreSettings } from './types'

/**
 * 음원 분석 결과는 음표를 초 단위로 갖고 있다. 악보를 만들 때 지금 템포(사용자가 고친 값 포함)에 맞춰 박 위치(틱)로 환산한다.
 * 그래야 템포를 바꾸면 박자 구조가 그에 맞게 다시 만들어진다. MIDI 파일은 그대로 돌려준다.
 */
export function materializeAudio(info: MidiFileInfo, settings: ScoreSettings): MidiFileInfo {
  if (info.source !== 'audio' || !info.audio) return info
  const bpm = settings.tempos[0]?.bpm ?? info.tempos[0].bpm
  return {
    ...info,
    tempos: [{ ticks: 0, bpm }],
    tracks: info.tracks.map((tr) => ({ ...tr, notes: toNoteEvents(info.audio!.notes, bpm) })),
  }
}
