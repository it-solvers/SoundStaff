import type { Estimate } from './types'

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** in-place radix-2 FFT */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

/** 스펙트럼 플럭스 기반 온셋 강도 곡선 (프레임 1024, 홉 256). 소리가 새로 시작되는 순간이 높게 나온다. */
export function onsetEnvelope(pcm: Float32Array, sampleRate: number): { env: Float32Array; hopSec: number } {
  const N = 1024
  const HOP = 256
  const frames = Math.max(0, Math.floor((pcm.length - N) / HOP))
  const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)))
  const bins = 200 // 약 4.3kHz까지
  const prev = new Float64Array(bins)
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  const flux = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) {
      re[i] = pcm[f * HOP + i] * win[i]
      im[i] = 0
    }
    fft(re, im)
    let sum = 0
    for (let b = 1; b < bins; b++) {
      const mag = Math.log1p(10 * Math.hypot(re[b], im[b]))
      const d = mag - prev[b]
      if (d > 0) sum += d
      prev[b] = mag
    }
    flux[f] = sum
  }
  // 이동 평균(약 0.4초)을 뺀 뒤 음수는 0으로: 지속음의 기저 에너지 제거
  const w = Math.max(3, Math.round(0.4 / (HOP / sampleRate)))
  const env = new Float32Array(frames)
  let acc = 0
  for (let i = 0; i < frames; i++) {
    acc += flux[i]
    if (i >= w) acc -= flux[i - w]
    env[i] = Math.max(0, flux[i] - acc / Math.min(i + 1, w))
  }
  return { env, hopSec: HOP / sampleRate }
}

function autocorr(env: Float32Array, lagFrames: number): number {
  const l0 = Math.floor(lagFrames)
  const frac = lagFrames - l0
  const at = (l: number) => {
    let s = 0
    for (let i = 0; i + l < env.length; i++) s += env[i] * env[i + l]
    return s / Math.max(1, env.length - l)
  }
  return at(l0) * (1 - frac) + at(l0 + 1) * frac
}

/**
 * 파형의 온셋 곡선으로 템포를 추정한다 (음표 간격보다 정확했다: 같은 곡에서 파형 방식은 정답, 음표 방식은 1.5배 오답).
 * 1단계: 박 주기와 그 배수 주기의 자기상관 합(하모닉 합)이 가장 큰 템포(50~140 BPM)를 찾는다.
 * 2단계: 옥타브(÷2, ×2) 모호성은 "박 주기 자기상관 × 일반적인 템포 분포(95 BPM 부근)"로 고른다.
 * 같은 박이 두 템포(예: 70과 140)로 해석되는 모호성은 남으므로 화면의 ÷2·×2 입력으로 고칠 수 있다.
 */
export function estimateBpmFromAudio(pcm: Float32Array, sampleRate: number): Estimate<number> | null {
  if (pcm.length < sampleRate * 4) return null
  const { env, hopSec } = onsetEnvelope(pcm, sampleRate)
  if (env.length < 100) return null

  const scores: { bpm: number; score: number }[] = []
  for (let bpm = 50; bpm <= 140; bpm += 0.5) {
    const lag = 60 / bpm / hopSec
    let s = 0
    for (let k = 1; k <= 4; k++) s += autocorr(env, lag * k) / k
    scores.push({ bpm, score: s })
  }
  const best = scores.reduce((a, c) => (c.score > a.score ? c : a))
  const mean = scores.reduce((a, c) => a + c.score, 0) / scores.length

  const prior = (t: number) => Math.exp(-0.5 * (Math.log2(t / 95) / 0.6) ** 2)
  const candidates = [best.bpm / 2, best.bpm, best.bpm * 2].filter((t) => t >= 56 && t <= 150)
  const pick = candidates.reduce(
    (a, t) => {
      const v = autocorr(env, 60 / t / hopSec) * prior(t)
      return v > a.v ? { t, v } : a
    },
    { t: best.bpm, v: -1 },
  )
  return { value: Math.round(pick.t), confidence: clamp01((best.score - mean) / (best.score || 1)) }
}

/** 음표 시작점이 박 주기에 일관되게 놓이는 정도(위상 일치도)로 템포를 추정한다. 파형 추정이 어려울 때의 보조 수단. */
export function estimateBpmFromNotes(onsetsSec: number[], weights?: number[]): Estimate<number> {
  if (onsetsSec.length < 4) return { value: 120, confidence: 0 }
  const w = weights ?? onsetsSec.map(() => 1)
  const coherence = (period: number) => {
    let re = 0
    let im = 0
    let ws = 0
    onsetsSec.forEach((t, i) => {
      const a = (2 * Math.PI * t) / period
      re += w[i] * Math.cos(a)
      im += w[i] * Math.sin(a)
      ws += w[i]
    })
    return Math.hypot(re, im) / ws
  }
  let best = { bpm: 100, score: -Infinity }
  let sum = 0
  let count = 0
  for (let bpm = 50; bpm <= 140; bpm += 0.5) {
    const beat = 60 / bpm
    let score = 0.5 * coherence(beat * 2)
    for (let k = 1; k <= 4; k++) score += coherence(beat / k)
    sum += score
    count++
    if (score > best.score) best = { bpm, score }
  }
  return { value: Math.round(best.bpm), confidence: clamp01((best.score - sum / count) / best.score) }
}
