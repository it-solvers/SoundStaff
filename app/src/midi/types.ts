/** MIDI 파일에서 읽은 정보 (읽기 전용 원본값. 사용자가 고친 값은 별도 상태로 관리한다) */
export interface TempoChange {
  ticks: number
  bpm: number
}

export interface TimeSignatureChange {
  ticks: number
  numerator: number
  denominator: number
}

export interface KeySignatureChange {
  ticks: number
  /** 조표 수 (플랫 음수, 샵 양수). 장·단조 모두 같은 기준 */
  fifths: number
  /** 으뜸음 이름 (장조/단조 구분 반영. 예: 조표 ♭3 → 장조 "Eb", 단조 "C") */
  tonic: string
  scale: 'major' | 'minor'
}

/** 트랙의 음표 하나 (MIDI 틱 단위 원본값) */
export interface NoteEvent {
  ticks: number
  durationTicks: number
  midi: number
  velocity: number
  /** true면 "덜 주된 음"(작고 짧은 음). 악보에서 회색으로 흐리게 그린다 (음원 분석의 주된 음 돋보이기) */
  minor?: boolean
}

export type TrackKind = 'pitched' | 'drum' | 'empty'

export interface TrackInfo {
  index: number
  name: string
  instrumentName: string
  instrumentNumber: number
  /** 사람이 보는 채널 번호 (1~16). MIDI 10번 채널이 드럼 */
  channel: number
  noteCount: number
  kind: TrackKind
  lowestMidi?: number
  highestMidi?: number
  notes: NoteEvent[]
  /** 악보 음자리표를 정해 둔 경우 (음원 분석의 오른손·왼손). 없으면 음높이로 고른다 */
  clef?: 'G' | 'F'
  /** true면 같은 때 울리는 음을 화음으로 묶고 겹치지 않게 정리한다 (음원 분석의 들리는 대로 악보). 아니면 한 줄 선율 */
  chords?: boolean
}

/** 음원 분석으로 찾은 음표 (초 단위). 템포를 바꾸면 박 위치가 달라지므로 악보를 만들 때 환산한다. */
export interface AudioNote {
  startSec: number
  durationSec: number
  midi: number
  velocity: number
  /** true면 덜 주된 음 (악보에서 회색) */
  minor?: boolean
}

/** 음원 분석 결과에만 있는 정보. 값은 모두 "추정"이다. */
export interface AudioSourceInfo {
  /** 주 멜로디만 골라낸 한 줄 선율 */
  notes: AudioNote[]
  /** 거르기를 마친 AI가 찾은 모든 음표 (들리는 대로 악보의 재료) */
  allNotes: AudioNote[]
  /** 추적한 박의 시각(초). 있으면 연주의 느려짐·빨라짐을 따라 박 위치를 정한다 (일정한 템포면 없다) */
  beatTimes?: number[]
  /** 목소리만 분리해서 만들기를 골랐을 때: used 분리한 목소리를 분석함 / notFound 목소리가 거의 없어 원곡을 분석함 */
  vocals?: 'used' | 'notFound'
  /** 거르기 전에 AI가 찾은 음표 수 */
  detectedCount: number
  /** 주파수 분석 보정으로 새로 넣은 음·뺀 음 수 */
  refinedAdded?: number
  refinedRemoved?: number
  /** 추정 확신도 0~1 (확률이 아니라 상대적인 값) */
  bpmConfidence: number
  keyConfidence: number
  /** 연산 백엔드(webgl, cpu)와 걸린 시간 */
  backend: string
  elapsedMs: number
  /** 같은 높이로 이어진 음을 합쳐서 줄어든 음표 수 (악보를 만들 때 정해짐, 알림용) */
  mergedCount?: number
}

export interface MidiFileInfo {
  /** 음원에서 분석한 결과이면 'audio' (없으면 MIDI 파일) */
  source?: 'midi' | 'audio'
  audio?: AudioSourceInfo
  id: string
  fileName: string
  size: number
  ppq: number
  durationSec: number
  tempos: TempoChange[]
  timeSignatures: TimeSignatureChange[]
  keySignatures: KeySignatureChange[]
  tracks: TrackInfo[]
}

export type ReadResult = { ok: true; info: MidiFileInfo } | { ok: false; fileName: string; error: string }
