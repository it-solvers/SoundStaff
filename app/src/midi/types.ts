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
}

/** 음원 분석으로 찾은 음표 (초 단위). 템포를 바꾸면 박 위치가 달라지므로 악보를 만들 때 환산한다. */
export interface AudioNote {
  startSec: number
  durationSec: number
  midi: number
  velocity: number
}

/** 음원 분석 결과에만 있는 정보. 값은 모두 "추정"이다. */
export interface AudioSourceInfo {
  notes: AudioNote[]
  /** 거르기 전에 AI가 찾은 음표 수 */
  detectedCount: number
  /** 추정 확신도 0~1 (확률이 아니라 상대적인 값) */
  bpmConfidence: number
  keyConfidence: number
  /** 연산 백엔드(webgl, cpu)와 걸린 시간 */
  backend: string
  elapsedMs: number
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
