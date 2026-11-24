import type { AudioNote } from '../midi/types'
import type { KeyGuess } from './key'
import type { Estimate } from './types'

export interface AnalyzeRequest {
  pcm: Float32Array
  sampleRate: number
  modelUrl: string
}

export type AnalyzeResponse =
  | { type: 'progress'; percent: number }
  | { type: 'stage'; stage: 'finish' }
  | {
      type: 'result'
      notes: AudioNote[]
      allNotes: AudioNote[]
      detectedCount: number
      /** 주파수 분석 보정으로 새로 넣은 음·뺀 음 수 */
      refinedAdded: number
      refinedRemoved: number
      bpm: Estimate<number>
      key: Estimate<KeyGuess>
      backend: string
      elapsedMs: number
    }
  /** noNotes: 음표를 못 찾음 / failed: 그 밖의 실패(메모리 부족 등) */
  | { type: 'error'; code: 'noNotes' | 'failed' }
