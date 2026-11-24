import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** 분석 입력과 같은 표본 추출 속도 (모노 22,050Hz) */
export const SR = 22050

export type Timbre = 'piano' | 'strings' | 'flute'

export interface RNote {
  midi: number
  /** 시작(초) */
  start: number
  /** 길이(초) */
  dur: number
  /** 세기 0~1 */
  vel: number
  timbre: Timbre
}

const PIANO_DIR = new URL('../../public/piano/', import.meta.url).pathname
const CACHE_DIR =
  process.env.TYPEBENCH_CACHE ?? new URL('../../node_modules/.cache/typebench/', import.meta.url).pathname

interface Sample {
  midi: number
  rate: number
  data: Float32Array
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** 16비트 WAV(모노)를 읽는다 */
export function readWav(path: string): { rate: number; data: Float32Array } {
  const b = readFileSync(path)
  let p = 12
  let rate = 44100
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4)
    const size = b.readUInt32LE(p + 4)
    if (id === 'fmt ') rate = b.readUInt32LE(p + 12)
    if (id === 'data') {
      const end = Math.min(b.length, p + 8 + size)
      const n = (end - (p + 8)) >> 1
      const data = new Float32Array(n)
      for (let i = 0; i < n; i++) data[i] = b.readInt16LE(p + 8 + i * 2) / 32768
      return { rate, data }
    }
    p += 8 + size + (size & 1)
  }
  throw new Error(`WAV에서 데이터를 찾지 못함: ${path}`)
}

let pianoCache: Sample[] | null = null

/** 앱에 들어 있는 피아노 샘플(mp3)을 macOS afconvert로 WAV로 바꿔 읽는다 (한 번만 변환해 캐시) */
export function loadPiano(): Sample[] {
  if (pianoCache) return pianoCache
  mkdirSync(CACHE_DIR, { recursive: true })
  const out: Sample[] = []
  for (const f of [
    'A0',
    'C1',
    'Ds1',
    'Fs1',
    'A1',
    'C2',
    'Ds2',
    'Fs2',
    'A2',
    'C3',
    'Ds3',
    'Fs3',
    'A3',
    'C4',
    'Ds4',
    'Fs4',
    'A4',
    'C5',
    'Ds5',
    'Fs5',
    'A5',
    'C6',
    'Ds6',
    'Fs6',
    'A6',
    'C7',
    'Ds7',
    'Fs7',
    'A7',
    'C8',
  ]) {
    const wav = join(CACHE_DIR, `${f}.wav`)
    if (!existsSync(wav))
      execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16', '-c', '1', join(PIANO_DIR, `${f}.mp3`), wav])
    const m = /^([A-G])(s?)(\d)$/.exec(f)!
    const midi = 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] ? 1 : 0)
    out.push({ midi, ...readWav(wav) })
  }
  pianoCache = out.sort((a, b) => a.midi - b.midi)
  return pianoCache
}

/** 정해진 값으로 늘 같은 난수를 내는 간단한 생성기 */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** 여러 음을 하나의 모노 소리로 만든다 */
export function render(notes: RNote[], seed = 1): Float32Array {
  const end = Math.max(...notes.map((n) => n.start + n.dur)) + 1.5
  const out = new Float32Array(Math.ceil(end * SR))
  const piano = notes.some((n) => n.timbre === 'piano') ? loadPiano() : []
  const rand = rng(seed)
  for (const n of notes) {
    const i0 = Math.round(n.start * SR)
    if (n.timbre === 'piano') {
      let s = piano[0]
      for (const c of piano) if (Math.abs(c.midi - n.midi) < Math.abs(s.midi - n.midi)) s = c
      const step = (2 ** ((n.midi - s.midi) / 12) * s.rate) / SR
      const rel = 0.25
      const len = Math.ceil((n.dur + rel) * SR)
      const gain = 0.6 * n.vel
      for (let i = 0; i < len && i0 + i < out.length; i++) {
        const pos = i * step
        const k = Math.floor(pos)
        if (k + 1 >= s.data.length) break
        const t = i / SR
        const env = t > n.dur ? Math.max(0, 1 - (t - n.dur) / rel) : 1
        out[i0 + i] += gain * env * (s.data[k] * (1 - (pos - k)) + s.data[k + 1] * (pos - k))
      }
    } else {
      // 현악(톱니파 계열, 느린 시작, 떨림)과 플루트(맑은 소리, 숨소리)를 더하기 합성으로 흉내 낸다
      const strings = n.timbre === 'strings'
      const attack = strings ? 0.09 : 0.05
      const rel = strings ? 0.2 : 0.12
      const harmonics = strings ? [1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.14, 0.12] : [1, 0.25, 0.08]
      const f0 = hz(n.midi)
      const phase = rand() * Math.PI * 2
      const len = Math.ceil((n.dur + rel) * SR)
      for (let i = 0; i < len && i0 + i < out.length; i++) {
        const t = i / SR
        const env = Math.min(1, t / attack) * (t > n.dur ? Math.max(0, 1 - (t - n.dur) / rel) : 1)
        const vib = 1 + (strings ? 0.003 : 0.002) * Math.sin(2 * Math.PI * 5.5 * t + phase)
        let v = 0
        for (let h = 0; h < harmonics.length; h++) {
          const f = f0 * (h + 1)
          if (f < SR / 2) v += harmonics[h] * Math.sin(2 * Math.PI * f * vib * t + phase * (h + 1))
        }
        if (!strings) v += 0.02 * (rand() * 2 - 1)
        out[i0 + i] += 0.12 * n.vel * env * v
      }
    }
  }
  let peak = 0
  for (const v of out) peak = Math.max(peak, Math.abs(v))
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.9 / peak
  return out
}
