import { t } from '../text'
import { UserError } from '../utils/errors'
import { SEPARATION_RATE } from './separate'

/** Basic Pitch가 요구하는 입력 형식: 모노 22,050Hz (기획서 8.5장 1번) */
export const ANALYSIS_SAMPLE_RATE = 22050

/** 파일 길이만 빠르게 읽는다 (전체 디코딩 전에 상한을 검사하려고) */
export function probeDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    const done = () => {
      audio.removeAttribute('src')
      audio.load()
      URL.revokeObjectURL(url)
    }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const d = audio.duration
      done()
      if (Number.isFinite(d)) resolve(d)
      else reject(new UserError(t.errors.unreadable))
    }
    audio.onerror = () => {
      done()
      reject(new UserError(t.errors.unreadable))
    }
    audio.src = url
  })
}

/** 음원 전체를 디코딩한다 (브라우저 내장 Web Audio API). 모두 이 브라우저 안에서 처리한다. */
export async function decodeAudio(file: File): Promise<AudioBuffer> {
  const data = await file.arrayBuffer()
  const ctx = new AudioContext()
  try {
    return await ctx.decodeAudioData(data)
  } catch {
    throw new UserError(t.errors.unreadable)
  } finally {
    void ctx.close()
  }
}

/** 모노 22,050Hz로 바꾼다 (Basic Pitch 입력 형식). 소리가 거의 없으면 오류로 알린다. */
export async function toMono22k(decoded: AudioBuffer): Promise<Float32Array> {
  const length = Math.ceil(decoded.duration * ANALYSIS_SAMPLE_RATE)
  const offline = new OfflineAudioContext(1, length, ANALYSIS_SAMPLE_RATE)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination) // 다채널은 자동으로 모노 다운믹스된다
  src.start()
  const pcm = (await offline.startRendering()).getChannelData(0)

  let peak = 0
  for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]))
  if (peak < 1e-4) throw new UserError(t.errors.silent)
  return pcm
}

/** 목소리 분리에 넣을 44.1kHz 스테레오 (한 채널 음원은 양쪽에 같은 소리) */
export async function toStereo44k(decoded: AudioBuffer): Promise<[Float32Array, Float32Array]> {
  const offline = new OfflineAudioContext(2, Math.ceil(decoded.duration * SEPARATION_RATE), SEPARATION_RATE)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  const out = await offline.startRendering()
  return [out.getChannelData(0).slice(), out.getChannelData(1).slice()]
}

/** 분리한 목소리(모노 44.1kHz)를 toMono22k에 넣을 수 있는 버퍼로 */
export function monoBuffer(pcm: Float32Array): AudioBuffer {
  const buf = new AudioBuffer({ length: pcm.length, numberOfChannels: 1, sampleRate: SEPARATION_RATE })
  buf.getChannelData(0).set(pcm)
  return buf
}
