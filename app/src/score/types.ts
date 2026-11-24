import type { VoiceMeasure } from '../midi/measures'
import type { MeasureSpec } from '../midi/quantize'
import type { TempoChange, TimeSignatureChange } from '../midi/types'

/** 음원 분석 결과를 악보로 옮기는 방식: full 들리는 대로(모든 음, 높은 음·낮은 음 두 단) / melody 주 멜로디 한 줄 */
export type AudioMode = 'full' | 'melody'

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
  /** 음원 분석 결과의 악보 방식 (없으면 들리는 대로) */
  audioMode?: AudioMode
  /** 들리는 대로 악보에서 읽기 쉽게 정리할지 (같은 때 4음 넘는 음 등 일부를 뺀다). 기본은 켬: 피아노 대보표(한 파트, 한 보표에 한 성부)로 읽기 쉽게 만든다. 끄면 찾은 음을 모두 적는다 */
  audioSimplify?: boolean
  /** 같은 높이로 이어진 음을 하나로 합칠지 (기본 켬). 끄면 AI가 나눈 그대로 적는다 */
  audioMerge?: boolean
  /** 주된 음이 돋보이게 작고 짧은 음을 회색으로 표시할지 (기본 켬). 음은 지우지 않는다 */
  audioEmphasis?: boolean
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
  /** true면 재생할 때 이 보표의 소리를 내지 않는다 (피아노 대보표에서 오른손·왼손을 따로 끌 때) */
  muted?: boolean
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
