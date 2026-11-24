import type { MidiFileInfo } from '../midi/types'
import { resolveEditTuning } from '../audio/editTuning'
import { MERGE_GAP_SECONDS, mergeRepeatedNotes } from '../audio/notes'
import { audioTracks } from '../audio/toInfo'
import type { ScoreSettings } from './types'

/** 고치기 쉽게(편집용) 방식인가: 들리는 대로 + 읽기 쉽게 정리하기가 켜져 있고 편집용도 켠 경우 */
export const isEditMode = (s: ScoreSettings) => (s.audioMode ?? 'full') === 'full' && !!s.audioSimplify && !!s.audioEdit

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
  const edit = isEditMode(settings)
  // 사용자가 템포를 직접 고치지 않았으면(설정의 템포가 분석한 템포와 같으면) 박 지도로 연주의 느려짐·빨라짐을 따라간다
  const beatTimes =
    info.audio.beatTimes && JSON.stringify(settings.tempos) === JSON.stringify(info.tempos)
      ? info.audio.beatTimes
      : undefined
  // 들리는 대로에서 같은 높이로 이어진 음을 합쳐 줄어든 개수 (알림용)
  const mergedCount =
    mode === 'full' && merge
      ? info.audio.allNotes.length -
        mergeRepeatedNotes(
          info.audio.allNotes,
          edit ? resolveEditTuning(settings.editTuning).mergeGapSec : MERGE_GAP_SECONDS,
        ).length
      : 0
  return {
    ...info,
    tempos: beatTimes ? info.tempos : [{ ticks: 0, bpm }],
    // 악보 방식(들리는 대로 / 멜로디만)에 맞는 단을 지금 템포로 만든다
    tracks: audioTracks({ ...info.audio, beatTimes }, mode, bpm, merge, emphasis, edit, settings.editTuning),
    audio: { ...info.audio, mergedCount },
  }
}
