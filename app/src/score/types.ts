import type { VoiceMeasure } from '../midi/measures'
import type { MeasureSpec } from '../midi/quantize'
import type { ReduceReport } from '../piano/types'
import type { TempoChange, TimeSignatureChange } from '../midi/types'

/** 악보를 만들 때 쓰는 설정. 기본값은 MIDI 파일에서 읽고, M5에서 사용자가 수정할 수 있게 된다. */
export interface ScoreSettings {
  tempos: TempoChange[]
  timeSignatures: TimeSignatureChange[]
  key: { fifths: number; mode: 'major' | 'minor' }
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
}

export interface ScoreModel {
  title: string
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

export type ConvertMode = 'instrument' | 'piano'

export interface ScoreReport {
  mode: ConvertMode
  /** 피아노로 합친 경우에만 있음: 중복·제거된 음 수 등 */
  reduction?: ReduceReport
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
