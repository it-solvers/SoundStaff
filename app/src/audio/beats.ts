import { onsetEnvelope } from './tempo'

/**
 * 박 추적의 기본값. 정답 악보(시험곡)와 비교해 맞췄다.
 * - 박 간격은 기준(추정 템포의 박 주기)의 0.9~2배로 제한한다. 아래쪽을 좁게 막아야 느려지는 구간(rit.)에서 박을 하나 더 끼워 넣어 박 번호가 한 박씩 밀리는 일이 없다.
 *   (하한 0.5·0.75에서는 음이름 F1 0.745~0.90, 0.9에서는 0.947. 같은 곡에서 박 지도를 정확히 넣었을 때의 상한은 0.953)
 * - tightness가 크면(50 이상) 박 간격이 거의 일정해져 느려짐을 따라가지 못하고, 작으면(10) 따라간다.
 */
export const BEAT_TIGHTNESS = 10
export const BEAT_MIN_RATIO = 0.9
export const BEAT_MAX_RATIO = 2

/**
 * 박 추적(beat tracking): 온셋 곡선에서 박의 시각을 찾는다. 연주가 느려지거나(rit.) 빨라져도 박을 따라간다.
 * 동적 계획법(Ellis 2007): 박마다 "온셋이 센 곳일수록 좋고, 앞 박과의 간격이 기준 박 주기에서 벗어날수록 나쁘다"로 점수를 매겨
 * 가장 점수가 높은 박의 연결을 찾는다. 간격은 기준의 1/2~2배 안에서 움직일 수 있다.
 * @param tightness 클수록 박 간격을 일정하게 유지한다 (100 = 간격이 10% 바뀌면 약 0.9점 감점)
 * @returns 박의 시각(초) 오름차순. 못 찾으면 빈 배열
 */
export function trackBeatsFromEnvelope(
  env: Float32Array,
  hopSec: number,
  bpm: number,
  tightness = BEAT_TIGHTNESS,
  minRatio = BEAT_MIN_RATIO,
  maxRatio = BEAT_MAX_RATIO,
): number[] {
  const N = env.length
  const period = 60 / bpm / hopSec
  if (N < period * 4 || !Number.isFinite(period) || period < 2) return []
  let mean = 0
  for (const v of env) mean += v
  mean /= N
  let varSum = 0
  for (const v of env) varSum += (v - mean) ** 2
  const std = Math.sqrt(varSum / N) || 1
  const e = Float64Array.from(env, (v) => v / std)

  const lo = Math.max(1, Math.round(period * minRatio))
  const hi = Math.round(period * maxRatio)
  const pen = new Float64Array(hi + 1)
  for (let tau = lo; tau <= hi; tau++) pen[tau] = -tightness * Math.log(tau / period) ** 2

  const score = new Float64Array(N)
  const back = new Int32Array(N).fill(-1)
  for (let t = 0; t < N; t++) {
    let best = -Infinity
    let bi = -1
    for (let tau = lo; tau <= hi; tau++) {
      const p = t - tau
      if (p < 0) break
      const v = score[p] + pen[tau]
      if (v > best) {
        best = v
        bi = p
      }
    }
    if (bi >= 0 && best > 0) {
      score[t] = e[t] + best
      back[t] = bi
    } else score[t] = e[t]
  }
  // 마지막 박: 점수가 가장 높은 프레임. 박이 이어질수록 점수가 쌓이므로 가장 긴 박 연결의 끝이 되고, 끝의 무음(점수가 쌓이지 않는 구간)에는 영향을 받지 않는다
  let end = 0
  for (let t = 1; t < N; t++) if (score[t] >= score[end]) end = t
  const frames: number[] = []
  for (let t = end; t >= 0; t = back[t]) {
    frames.push(t)
    if (back[t] < 0) break
  }
  frames.reverse()
  // 소리가 시작한 근거가 없는 앞뒤 박(곡 앞뒤의 무음에 이어 붙은 박)은 자른다
  const supported = (f: number) => {
    for (let i = Math.max(0, f - 2); i <= Math.min(N - 1, f + 2); i++) if (e[i] >= SUPPORT_LEVEL) return true
    return false
  }
  while (frames.length && !supported(frames[frames.length - 1])) frames.pop()
  while (frames.length && !supported(frames[0])) frames.shift()
  return frames.map((f) => f * hopSec)
}

/** 박 근처(앞뒤 2프레임)에 이 세기(표준편차 단위) 이상의 온셋이 있어야 박으로 인정한다 */
const SUPPORT_LEVEL = 0.3

/** 온셋 곡선의 프레임 시각과 실제 소리가 시작한 시각의 차이(초): 분석 창(1024표본)의 절반 */
export const ENVELOPE_LATENCY_SECONDS = 0.5 * (1024 / 22050)

/** 파형에서 박의 시각(초)을 찾는다 */
export function trackBeats(pcm: Float32Array, sampleRate: number, bpm: number): number[] {
  const { env, hopSec } = onsetEnvelope(pcm, sampleRate)
  return trackBeatsFromEnvelope(env, hopSec, bpm).map((t) => t + ENVELOPE_LATENCY_SECONDS)
}

/**
 * 추적한 박 시각을 악보 박 번호에 맞춘다: 시각 0에 가장 가까운 박을 0번 박(첫 마디 첫 박)으로 삼고 그 앞의 박은 버린다.
 * 박이 8개 미만이면 null. 반환값 times[i]는 i번 박의 시각(초)이다.
 */
export function anchorBeats(beats: number[]): number[] | null {
  if (beats.length < 8) return null
  let j = 0
  for (let i = 1; i < beats.length; i++) if (Math.abs(beats[i]) < Math.abs(beats[j])) j = i
  const times = beats.slice(j)
  return times.length >= 8 ? times : null
}

/** 시각(초)을 박 위치(4분음표 단위, 소수 가능)로 바꾼다. 박 사이는 직선으로 잇고, 앞뒤는 가까운 박 간격으로 늘려 잡는다 */
export function beatPosition(times: number[], sec: number): number {
  const n = times.length
  if (sec <= times[0]) return (sec - times[0]) / (times[1] - times[0])
  if (sec >= times[n - 1]) return n - 1 + (sec - times[n - 1]) / (times[n - 1] - times[n - 2])
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (times[mid] <= sec) lo = mid
    else hi = mid
  }
  return lo + (sec - times[lo]) / (times[hi] - times[lo])
}

/** 마디(4박)마다의 템포(BPM). 연주가 느려지거나 빨라진 정도를 알려 준다 */
export function measureTempos(times: number[], beatsPerMeasure = 4): number[] {
  const out: number[] = []
  for (let i = 0; i + beatsPerMeasure < times.length; i += beatsPerMeasure) {
    out.push((60 * beatsPerMeasure) / (times[i + beatsPerMeasure] - times[i]))
  }
  return out
}

/** 마디 템포가 이 비율 이상 바뀌어야 새 템포 표시를 넣는다 (자잘한 흔들림은 표시하지 않는다) */
export const TEMPO_MARK_CHANGE = 0.06

/**
 * 박 지도가 쓸모 있는지 판단한다: 마디 템포가 전체 템포에서 TEMPO_MARK_CHANGE 이상 벗어나는 마디가 없으면
 * (일정한 템포) 박 지도를 쓰지 않고 null을 돌려 기존처럼 일정한 템포로 처리한다.
 */
export function usefulBeatTimes(beats: number[], bpm: number): number[] | null {
  const times = anchorBeats(beats)
  if (!times) return null
  // 안전장치: 추적한 박 간격의 중앙값이 추정 템포의 박 주기와 8% 넘게 다르면 추정 템포나 추적이 어긋난 것이므로 쓰지 않는다
  const iv = times
    .slice(1)
    .map((t, i) => t - times[i])
    .sort((a, b) => a - b)
  if (Math.abs(iv[iv.length >> 1] / (60 / bpm) - 1) > 0.08) return null
  const tempos = measureTempos(times)
  if (tempos.length < 2) return null
  const sorted = [...tempos].sort((a, b) => a - b)
  const median = sorted[sorted.length >> 1]
  return tempos.some((v) => Math.abs(v / median - 1) >= TEMPO_MARK_CHANGE) ? times : null
}

/** 템포가 눈에 띄게 바뀐 마디에만 템포 표시를 만든다: [{ beat: 마디 시작 박 번호, bpm }] (첫 마디는 항상 포함) */
export function tempoMarks(times: number[], beatsPerMeasure = 4): { beat: number; bpm: number }[] {
  const tempos = measureTempos(times, beatsPerMeasure)
  const marks: { beat: number; bpm: number }[] = []
  tempos.forEach((bpm, i) => {
    const last = marks[marks.length - 1]
    if (!last || Math.abs(bpm / last.bpm - 1) >= TEMPO_MARK_CHANGE)
      marks.push({ beat: i * beatsPerMeasure, bpm: Math.round(bpm) })
  })
  return marks
}
