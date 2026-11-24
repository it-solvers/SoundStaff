import type { MidiFileInfo } from '../midi/types'
import { mergeRepeatedNotes } from '../audio/notes'
import { audioTracks } from '../audio/toInfo'
import type { ScoreSettings } from './types'

/**
 * 음원 분석 결과는 음표를 초 단위로 갖고 있다. 악보를 만들 때 지금 템포(사용자가 고친 값 포함)에 맞춰 박 위치(틱)로 환산한다.
 * 그래야 템포를 바꾸면 박자 구조가 그에 맞게 다시 만들어진다. MIDI 파일은 그대로 돌려준다.
 */
export function materializeAudio(info: MidiFileInfo, settings: ScoreSettings): MidiFileInfo {
  if (info.source !== 'audio' || !info.audio) return info
  const bpm = settings.tempos[0]?.bpm ?? info.tempos[0].bpm
  const mode = settings.audioMode ?? 'full'
  const merge = settings.audioMerge ?? true
  const emphasis = settings.audioEmphasis ?? true
  // 들리는 대로에서 같은 높이로 이어진 음을 합쳐 줄어든 개수 (알림용)
  const mergedCount =
    mode === 'full' && merge ? info.audio.allNotes.length - mergeRepeatedNotes(info.audio.allNotes).length : 0
  return {
    ...info,
    tempos: [{ ticks: 0, bpm }],
    // 악보 방식(들리는 대로 / 멜로디만)에 맞는 단을 지금 템포로 만든다
    tracks: audioTracks(info.audio, mode, bpm, merge, emphasis),
    audio: { ...info.audio, mergedCount },
  }
}
