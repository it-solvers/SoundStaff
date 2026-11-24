import type { VoiceMeasure } from '../midi/measures'
import type { MeasureSpec } from '../midi/quantize'
import type { TempoChange, TimeSignatureChange } from '../midi/types'

/** 악보를 만들 때 쓰는 설정. 기본값은 MIDI 파일에서 읽고, M5에서 사용자가 수정할 수 있게 된다. */
export interface ScoreSettings {
  tempos: TempoChange[]
  timeSignatures: TimeSignatureChange[]
  key: { fifths: number; mode: 'major' | 'minor' }
  /** 악보 제목 (PDF·MusicXML에 기록). 기본값은 파일 이름 */
  title: string
  /** 작곡자 (비어 있으면 기록하지 않는다) */
  composer: string
  /** 악기(트랙) 단을 쌓는 순서: 트랙 번호 목록. 없거나 비어 있으면 원래 순서 */
  trackOrder?: number[]
  /** 악보에서 뺄 트랙 번호 목록 (악보·재생·PDF·MusicXML에서 모두 빠진다) */
  excludedTracks?: number[]
  /** 재생할 때만 소리를 끌 트랙 번호 목록 (악보에는 그대로 있다) */
  mutedTracks?: number[]
}

/** 보표 하나. 피아노는 한 파트에 보표 2개(오른손 높은음자리표, 왼손 낮은음자리표) */
export interface StaffModel {
  clef: 'G' | 'F'
  layout: VoiceMeasure[][]
}

export interface PartModel {
  id: string
  name: string
  instrumentName: string
  /** 사람이 보는 채널 번호 (1~16) */
  channel: number
  /** MIDI 프로그램 번호 (0~127) */
  program: number
  staves: StaffModel[]
  /** true면 재생할 때 소리를 내지 않는다 (악보에는 그대로 있다) */
  muted?: boolean
}

export interface ScoreModel {
  title: string
  composer: string
  key: { fifths: number; mode: 'major' | 'minor' }
  grid: MeasureSpec[]
  /** 마디 번호(0부터) → 그 마디에서 시작하는 템포 */
  tempoByMeasure: Map<number, number>
  parts: PartModel[]
}

export interface PartReport {
  name: string
  noteCount: number
  maxVoices: number
}

/** merged: 첨부한 모든 파일을 악보 하나로 / separate: 파일별로 각각 악보 */
export type OutputUnit = 'merged' | 'separate'

export interface ScoreReport {
  measureCount: number
  parts: PartReport[]
  excludedDrums: string[]
  warnings: string[]
}

export interface BuildResult {
  xml: string
  model: ScoreModel
  report: ScoreReport
}
