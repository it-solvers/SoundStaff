import { BasicPitch, noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch'
import * as tf from '@tensorflow/tfjs'
import type { AudioNote } from '../midi/types'

/** WebGL(그래픽 칩)을 우선 쓰고, 안 되면 CPU로 폴백한다. 작업 스레드(Web Worker) 안에서도 동작한다. */
async function pickBackend(): Promise<string> {
  for (const name of ['webgl', 'cpu']) {
    try {
      if (await tf.setBackend(name)) {
        await tf.ready()
        return tf.getBackend()
      }
    } catch {
      // 다음 백엔드를 시도한다
    }
  }
  return tf.getBackend()
}

/**
 * Basic Pitch로 음표를 찾는다 (기획서 8.5장 2번). 거르기 전의 원본 음표와 연산 백엔드를 돌려준다.
 * onProgress는 AI가 알려 주는 실제 진행률(0~100)이다.
 */
export interface Posteriors {
  /** 프레임별 음 활성도 [프레임][88음, A0=MIDI 21부터] */
  frames: number[][]
  /** 프레임별 음 시작 확률 */
  onsets: number[][]
  backend: string
}

/** AI가 알려 주는 프레임별 음 활성도·시작 확률 (프레임 간격 약 11.6ms = 22050/256Hz) */
export async function detectPosteriors(
  pcm: Float32Array,
  modelUrl: string,
  onProgress: (percent: number) => void,
): Promise<Posteriors> {
  const backend = await pickBackend()
  const basicPitch = new BasicPitch(modelUrl)
  const frames: number[][] = []
  const onsets: number[][] = []
  await basicPitch.evaluateModel(
    pcm,
    (f, o) => {
      frames.push(...f) // 음 높이 윤곽(contours)은 쓰지 않아 버려서 메모리를 아낀다
      onsets.push(...o)
    },
    (p) => onProgress(Math.round(p * 100)),
  )
  return { frames, onsets, backend }
}

export async function detectNotes(
  pcm: Float32Array,
  modelUrl: string,
  onProgress: (percent: number) => void,
): Promise<{ raw: AudioNote[]; backend: string }> {
  const { frames, onsets, backend } = await detectPosteriors(pcm, modelUrl, onProgress)
  const events = noteFramesToTime(outputToNotesPoly(frames, onsets, 0.5, 0.3, 5))
  return {
    backend,
    raw: events.map((e) => ({
      startSec: e.startTimeSeconds,
      durationSec: e.durationSeconds,
      midi: e.pitchMidi,
      velocity: e.amplitude,
    })),
  }
}
