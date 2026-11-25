import { assetUrl } from '../utils/assetUrl'
import type { MidiFileInfo } from '../midi/types'
import { t } from '../text'
import { UserError } from '../utils/errors'
import { ANALYSIS_SAMPLE_RATE, decodeAudio, monoBuffer, probeDuration, toMono22k, toStereo44k } from './decode'
import { MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS } from './format'
import { audioToInfo } from './toInfo'
import type { AnalyzeRequest, AnalyzeResponse, SeparateRequest, SeparateResponse } from './workerTypes'

export type AnalysisStage = 'decode' | 'resample' | 'separate' | 'ai' | 'finish'

/** 분리한 소리의 크기가 원곡의 이 비율보다 작으면 노래가 아닌 것으로 보고 원곡을 분석한다 */
export const MIN_VOCAL_RATIO = 0.2

/** 사용자가 분석을 취소했을 때 던지는 오류 (오류 안내를 띄우지 않는다) */
export class AnalysisCancelled extends Error {}

/** 분석에 필요한 대략의 메모리: 디코딩 버퍼(스테레오 44.1k float) + 22.05k PCM + AI 출력(프레임 × 음 높이·온셋) */
function memoryNeed(sec: number): number {
  return sec * 44100 * 2 * 4 + sec * ANALYSIS_SAMPLE_RATE * 4 + sec * 86 * 440 * 8
}

/** 분석 전 필수 검사: 파일 크기, 길이, 브라우저 메모리 여유 (기획서 8.5장, 11.3장) */
async function preflight(file: File): Promise<number> {
  if (file.size > MAX_AUDIO_BYTES) {
    throw new UserError(t.errors.audioTooBig((file.size / 1024 / 1024).toFixed(1), MAX_AUDIO_BYTES / 1024 / 1024))
  }
  const sec = await probeDuration(file)
  if (sec > MAX_AUDIO_SECONDS) throw new UserError(t.errors.audioTooLong(MAX_AUDIO_SECONDS / 60))
  const mem = (performance as unknown as { memory?: { jsHeapSizeLimit: number; usedJSHeapSize: number } }).memory
  if (mem && memoryNeed(sec) > (mem.jsHeapSizeLimit - mem.usedJSHeapSize) * 0.9) throw new UserError(t.errors.noMemory)
  return sec
}

/** 목소리 분리 (모델은 이때 처음 내려받는다) */
function runSeparation(
  [left, right]: [Float32Array, Float32Array],
  onProgress: (percent: number) => void,
  signal: AbortSignal,
): Promise<Extract<SeparateResponse, { type: 'result' }>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/separate.worker.ts', import.meta.url), { type: 'module' })
    const end = () => {
      signal.removeEventListener('abort', onAbort)
      worker.terminate()
    }
    const onAbort = () => {
      end()
      reject(new AnalysisCancelled())
    }
    const fail = () => {
      end()
      reject(new UserError(t.errors.separationFailed))
    }
    signal.addEventListener('abort', onAbort)
    worker.onmessage = (e: MessageEvent<SeparateResponse>) => {
      const m = e.data
      if (m.type === 'progress') onProgress(m.percent)
      else if (m.type === 'result') {
        end()
        resolve(m)
      } else fail()
    }
    worker.onerror = fail
    const modelUrl = new URL(assetUrl('umx/vocals.onnx'), window.location.href).href
    const req: SeparateRequest = { left, right, modelUrl }
    worker.postMessage(req, [left.buffer, right.buffer])
  })
}

function runWorker(
  pcm: Float32Array,
  tempoPcm: Float32Array | undefined,
  onProgress: (percent: number) => void,
  onFinish: (percent: number) => void,
  signal: AbortSignal,
): Promise<Extract<AnalyzeResponse, { type: 'result' }>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/analyze.worker.ts', import.meta.url), { type: 'module' })
    const end = () => {
      signal.removeEventListener('abort', onAbort)
      worker.terminate() // 취소하거나 끝나면 작업 스레드를 종료해 메모리를 돌려준다
    }
    const onAbort = () => {
      end()
      reject(new AnalysisCancelled())
    }
    signal.addEventListener('abort', onAbort)
    worker.onmessage = (e: MessageEvent<AnalyzeResponse>) => {
      const m = e.data
      if (m.type === 'progress') onProgress(m.percent)
      else if (m.type === 'stage') onFinish(m.percent)
      else if (m.type === 'result') {
        end()
        resolve(m)
      } else {
        end()
        reject(new UserError(m.code === 'noNotes' ? t.errors.noDetected : t.errors.analysisFailed))
      }
    }
    worker.onerror = () => {
      end()
      reject(new UserError(t.errors.analysisFailed))
    }
    const modelUrl = new URL(assetUrl('basic-pitch-model/model.json'), window.location.href).href
    const req: AnalyzeRequest = { pcm, tempoPcm, sampleRate: ANALYSIS_SAMPLE_RATE, modelUrl }
    worker.postMessage(req, tempoPcm ? [pcm.buffer, tempoPcm.buffer] : [pcm.buffer]) // 복사하지 않고 넘긴다
  })
}

/**
 * 음원 파일을 분석해 MIDI 파일과 같은 모양의 정보로 돌려준다 (기획서 8.5장).
 * 모든 처리는 이 브라우저 안에서만 하고 음원은 어디로도 보내지 않는다.
 */
export async function analyzeAudioFile(
  file: File,
  onStage: (stage: AnalysisStage, percent?: number) => void,
  signal: AbortSignal,
  options: { vocalsOnly?: boolean } = {},
): Promise<MidiFileInfo> {
  const check = () => {
    if (signal.aborted) throw new AnalysisCancelled()
  }
  const durationSec = await preflight(file)
  check()
  onStage('decode')
  const decoded = await decodeAudio(file)
  check()
  onStage('resample')
  let pcm = await toMono22k(decoded)
  check()
  let tempoPcm: Float32Array | undefined
  let vocals: 'used' | 'notFound' | undefined
  if (options.vocalsOnly) {
    onStage('separate', 0)
    const separated = await runSeparation(await toStereo44k(decoded), (p) => onStage('separate', p), signal)
    check()
    if (separated.ratio >= MIN_VOCAL_RATIO) {
      tempoPcm = pcm
      pcm = await toMono22k(monoBuffer(separated.vocals))
      vocals = 'used'
    } else vocals = 'notFound'
    check()
  }
  onStage('ai', 0)
  const r = await runWorker(
    pcm,
    tempoPcm,
    (p) => onStage('ai', p),
    (p) => onStage('finish', p),
    signal,
  )
  return audioToInfo({
    fileName: file.name,
    size: file.size,
    vocals,
    durationSec,
    notes: r.notes,
    allNotes: r.allNotes,
    detectedCount: r.detectedCount,
    refinedAdded: r.refinedAdded,
    refinedRemoved: r.refinedRemoved,
    bpm: r.bpm,
    beatTimes: r.beatTimes,
    key: r.key,
    backend: r.backend,
    elapsedMs: r.elapsedMs,
  })
}
