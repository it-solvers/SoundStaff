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

export interface MidiFileInfo {
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
