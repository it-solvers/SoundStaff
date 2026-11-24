import type { AudioNote } from '../midi/types'

/** 주파수 분석 창 크기(샘플). 22.05kHz에서 약 0.37초이고 낮은 음의 반음 간격(저음 4Hz)을 가르는 데 쓴다. */
export const FFT_SIZE = 8192
/** 분석 간격(샘플, 약 0.093초) */
export const HOP_SIZE = 2048
/** 살펴보는 음 높이 범위 (피아노 E1 ~ C7) */
export const LOW_MIDI = 28
export const HIGH_MIDI = 96

/** 그 프레임에서 가장 센 음 대비 이 비율 이상이어야 "실제로 들리는 음"으로 본다 */
export const AUDIBLE_RATIO = 0.25
/** 찾은 음이 이 비율에도 못 미치는 프레임이 대부분이면 근거 없는 음이다 */
export const WEAK_RATIO = 0.08
/** 빠진 음을 새로 넣으려면 이만큼(프레임 수) 이어서 들려야 한다 (약 0.28초) */
export const MIN_ADD_FRAMES = 3
/** 새로 넣는 음의 세기. 낮게 줘서 주된 음 표시에서 회색(덜 주된 음)이 되게 한다 */
export const ADDED_VELOCITY = 0.3

export interface Salience {
  /** 프레임 중심 시각(초) */
  times: number[]
  /** 프레임별 음 높이(LOW_MIDI~HIGH_MIDI)마다 기본음 근처의 크기 */
  mag: Float32Array[]
  /** 프레임별 가장 센 크기 */
  max: Float32Array
}

/** 제자리 FFT (길이는 2의 거듭제곱) */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let b = n >> 1
    for (; j & b; b >>= 1) j ^= b
    j ^= b
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len
    const wr = Math.cos(a)
    const wi = Math.sin(a)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const u = i + k
        const v = u + len / 2
        const tr = re[v] * cr - im[v] * ci
        const ti = re[v] * ci + im[v] * cr
        re[v] = re[u] - tr
        im[v] = im[u] - ti
        re[u] += tr
        im[u] += ti
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}

/** 음 높이(MIDI) → 주파수(Hz) */
export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

/** 소리를 짧은 구간으로 나눠 음 높이마다 얼마나 센지 잰다. */
export function computeSalience(
  pcm: Float32Array,
  sampleRate: number,
  onProgress?: (fraction: number) => void,
): Salience {
  const hann = Float64Array.from(
    { length: FFT_SIZE },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)),
  )
  const bins = Array.from({ length: HIGH_MIDI - LOW_MIDI + 1 }, (_, i) => {
    const f = midiToHz(LOW_MIDI + i)
    return {
      lo: Math.max(1, Math.floor((f * 2 ** (-0.4 / 12) * FFT_SIZE) / sampleRate)),
      hi: Math.ceil((f * 2 ** (0.4 / 12) * FFT_SIZE) / sampleRate),
    }
  })
  const times: number[] = []
  const mag: Float32Array[] = []
  const max: number[] = []
  const re = new Float64Array(FFT_SIZE)
  const im = new Float64Array(FFT_SIZE)
  const total = Math.max(1, Math.floor((pcm.length - FFT_SIZE) / HOP_SIZE) + 1)
  for (let s0 = 0; s0 + FFT_SIZE <= pcm.length; s0 += HOP_SIZE) {
    if (onProgress && mag.length % 50 === 0) onProgress(Math.min(1, mag.length / total))
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = pcm[s0 + i] * hann[i]
      im[i] = 0
    }
    fft(re, im)
    const row = new Float32Array(bins.length)
    let mx = 0
    bins.forEach((b, i) => {
      let v = 0
      for (let k = b.lo; k <= b.hi; k++) v = Math.max(v, Math.hypot(re[k], im[k]))
      row[i] = v
      if (v > mx) mx = v
    })
    times.push((s0 + FFT_SIZE / 2) / sampleRate)
    mag.push(row)
    max.push(mx)
  }
  return { times, mag, max: Float32Array.from(max) }
}

const idx = (m: number) => m - LOW_MIDI
/** 낮은 음의 배음(옥타브·옥타브+5도·2옥타브 …)이 될 수 있는 간격(반음) */
const HARMONIC_GAPS = [12, 19, 24, 28, 31]

/**
 * 한 프레임에서 실제로 울리는 음 높이를 찾는다: 이웃 반음보다 크고, 가장 센 음의 AUDIBLE_RATIO 이상이며,
 * 훨씬 센 낮은 음의 배음일 가능성이 있으면 뺀다.
 */
export function audiblePitches(s: Salience, f: number, ratio = AUDIBLE_RATIO): Set<number> {
  const row = s.mag[f]
  const floor = s.max[f] * ratio
  const out = new Set<number>()
  if (s.max[f] < 1e-4) return out
  for (let m = LOW_MIDI + 1; m < HIGH_MIDI; m++) {
    const v = row[idx(m)]
    if (v < floor || v < row[idx(m - 1)] || v < row[idx(m + 1)]) continue
    const harmonic = HARMONIC_GAPS.some((g) => m - g >= LOW_MIDI && row[idx(m - g)] > v * 1.5)
    if (!harmonic) out.add(m)
  }
  return out
}

export interface RefineResult {
  notes: AudioNote[]
  added: number
  removed: number
  /** 소리가 이어지는 만큼 앞뒤를 늘린 음 수 */
  extended: number
}

/**
 * AI가 찾은 음을 소리의 주파수 분석으로 바로잡는다 (음원 분석 보정).
 * ① 근거 없는 음 빼기: 찾은 음이 울리는 동안 그 높이의 소리가 거의 안 들리면(대부분의 프레임이 WEAK_RATIO 미만) 뺀다.
 * ② 빠진 음 넣기: 같은 높이가 MIN_ADD_FRAMES 프레임 이상 이어서 실제로 들리는데 찾은 음이 없으면 낮은 세기(ADDED_VELOCITY)로 넣는다.
 * 찾은 음의 시작·길이는 바꾸지 않는다. 한 프레임 건너뛴 짧은 끊김은 이어진 것으로 본다.
 */
export function refineNotes(
  pcm: Float32Array,
  sampleRate: number,
  notes: AudioNote[],
  onProgress?: (fraction: number) => void,
): RefineResult {
  const s = computeSalience(pcm, sampleRate, onProgress)
  const frames = s.times.length
  if (!frames) return { notes, added: 0, removed: 0, extended: 0 }
  const hop = HOP_SIZE / sampleRate
  const frameOf = (t: number) => Math.min(frames - 1, Math.max(0, Math.round((t - s.times[0]) / hop)))

  // ① 근거 없는 음 빼기
  const kept: AudioNote[] = []
  let removed = 0
  let extended = 0
  for (const n of notes) {
    if (n.midi < LOW_MIDI || n.midi > HIGH_MIDI) {
      kept.push({ ...n })
      continue
    }
    const a = frameOf(n.startSec)
    const b = Math.max(a, frameOf(n.startSec + n.durationSec))
    let weak = 0
    let total = 0
    for (let f = a; f <= b; f++) {
      if (s.max[f] < 1e-4) continue
      total++
      if (s.mag[f][idx(n.midi)] < s.max[f] * WEAK_RATIO) weak++
    }
    if (total > 0 && weak / total > 0.6) removed++
    else kept.push({ ...n })
  }

  // ② 빠진 음 넣기: 높이마다 "들리는데 찾은 음이 없는" 프레임을 이어 본다
  const covered = Array.from({ length: frames }, () => new Map<number, AudioNote>())
  for (const n of kept) {
    const a = frameOf(n.startSec)
    const b = Math.max(a, frameOf(n.startSec + n.durationSec))
    for (let f = a; f <= b; f++) covered[f].set(n.midi, n)
  }
  const audible = Array.from({ length: frames }, (_, f) => audiblePitches(s, f))
  const added: AudioNote[] = []
  for (let m = LOW_MIDI + 1; m < HIGH_MIDI; m++) {
    let start = -1
    let last = -1
    const flush = () => {
      if (start >= 0 && last - start + 1 >= MIN_ADD_FRAMES) {
        const startSec = Math.max(0, s.times[start] - hop / 2)
        const endSec = s.times[last] + hop / 2
        // 이미 찾은 같은 높이의 음 바로 앞뒤에 붙은 조각은 그 음이 번지는 부분이라 새 음 대신 그 음을 늘린다
        const before = [start - 2, start - 1].map((g) => (g >= 0 ? covered[g].get(m) : undefined)).find(Boolean)
        const after = [last + 1, last + 2].map((g) => (g < frames ? covered[g].get(m) : undefined)).find(Boolean)
        if (before || after) {
          if (before) before.durationSec = Math.max(before.durationSec, endSec - before.startSec)
          if (after) {
            const end = after.startSec + after.durationSec
            after.startSec = Math.min(after.startSec, startSec)
            after.durationSec = end - after.startSec
          }
          extended++
        } else added.push({ startSec, durationSec: endSec - startSec, midi: m, velocity: ADDED_VELOCITY })
      }
      start = -1
    }
    for (let f = 0; f < frames; f++) {
      const missing = audible[f].has(m) && !covered[f].has(m)
      if (missing) {
        if (start < 0) start = f
        last = f
      } else if (start >= 0 && !(f - last <= 2 && audible[f].has(m))) {
        // 한 프레임 건너뛴 끊김은 이어 붙인다 (찾은 음이 이미 있는 프레임이면 거기서 끊는다)
        if (f - last > 1) flush()
      }
    }
    flush()
  }
  const all = [...kept, ...added].sort((a, b) => a.startSec - b.startSec || b.midi - a.midi)
  return { notes: all, added: added.length, removed, extended }
}
