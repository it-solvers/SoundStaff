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
  /** 음표 정리 단계 시작·진행 (percent 0~100) */
  | { type: 'stage'; stage: 'finish'; percent: number }
  | {
      type: 'result'
      notes: AudioNote[]
      allNotes: AudioNote[]
      detectedCount: number
      /** 주파수 분석 보정으로 새로 넣은 음·뺀 음 수 */
      refinedAdded: number
      refinedRemoved: number
      bpm: Estimate<number>
      /** 연주의 느려짐·빨라짐을 따라간 박 시각(초). 템포가 일정하면 없다 */
      beatTimes?: number[]
      key: Estimate<KeyGuess>
      backend: string
      elapsedMs: number
    }
  /** noNotes: 음표를 못 찾음 / failed: 그 밖의 실패(메모리 부족 등) */
  | { type: 'error'; code: 'noNotes' | 'failed' }
