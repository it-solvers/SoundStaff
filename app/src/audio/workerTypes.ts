import type { AudioNote } from '../midi/types'
import type { KeyGuess } from './key'
import type { Estimate } from './types'

export interface SeparateRequest {
  /** 44.1kHz 스테레오 */
  left: Float32Array
  right: Float32Array
  modelUrl: string
}

export type SeparateResponse =
  { type: 'progress'; percent: number } | { type: 'result'; vocals: Float32Array; ratio: number } | { type: 'error' }

export interface AnalyzeRequest {
  pcm: Float32Array
  /** 빠르기·박을 읽을 소리 (목소리만 분석할 때는 반주가 있는 원곡). 없으면 pcm */
  tempoPcm?: Float32Array
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
