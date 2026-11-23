import type { QNote } from '../midi/quantize'

export type Hand = 'R' | 'L'

/** 합치기 전 음표: 어느 트랙에서 왔는지 기억한다 */
export interface SourceNote extends QNote {
  track: number
}

/** 기획서 8.2의 기준값. 시험하며 조정한다. */
export interface ReduceOptions {
  /** 이 음 이상은 오른손 (가온 도 = 60) */
  splitMidi: number
  /** 한 손이 동시에 칠 수 있는 최대 음 수 */
  maxNotesPerHand: number
  /** 한 손의 최대 음 폭 (반음 수). 10도 = 16반음 */
  maxSpan: number
}

export const DEFAULT_REDUCE_OPTIONS: ReduceOptions = {
  splitMidi: 60,
  maxNotesPerHand: 5,
  maxSpan: 16,
}

export interface TrackInput {
  name: string
  notes: QNote[]
}

export interface ReduceReport {
  /** 합치기 전 전체 음표 수 */
  input: number
  /** 같은 시작·같은 높이라서 하나로 합친 음표 수 */
  duplicatesMerged: number
  /** 연주 가능성 정리로 제거한 음표 수 */
  removed: number
  removedByCount: number
  removedBySpan: number
  right: number
  left: number
  /** 트랙을 한 손에 고정했는지 (경계 부근 선율 보정) */
  pinnedTracks: { name: string; hand: Hand }[]
}

export interface ReduceResult {
  right: QNote[]
  left: QNote[]
  report: ReduceReport
}
