import type { AudioNote } from '../../src/midi/types'

export const ONSET_TOLERANCE = 0.08
export const GRID = 0.05

export interface Score {
  /** 프레임별 음높이 F1 (옥타브까지 맞아야 함) */
  pitch: number
  /** 프레임별 음이름 F1 (옥타브 무시) */
  chroma: number
  /** 음 시작 F1: 같은 높이의 음이 ±80ms 안에 시작 */
  onset: number
  /** 정답 음 중 못 찾은 비율 */
  miss: number
  /** 찾은 음 중 정답에 없는 비율 */
  extra: number
  count: number
}

const f1 = (p: number, r: number) => (p + r ? (2 * p * r) / (p + r) : 0)

function frameSets(
  notes: { midi: number; start: number; end: number }[],
  frames: number,
  chroma: boolean,
): Set<number>[] {
  const sets = Array.from({ length: frames }, () => new Set<number>())
  for (const n of notes) {
    const a = Math.ceil(n.start / GRID - 0.5)
    const b = Math.floor(n.end / GRID - 0.5)
    for (let i = Math.max(0, a); i <= Math.min(frames - 1, b); i++) sets[i].add(chroma ? n.midi % 12 : n.midi)
  }
  return sets
}

export function score(truth: { midi: number; start: number; dur: number }[], found: AudioNote[]): Score {
  const T = truth.map((n) => ({ midi: n.midi, start: n.start, end: n.start + n.dur }))
  const D = found.map((n) => ({ midi: n.midi, start: n.startSec, end: n.startSec + n.durationSec }))
  const frames = Math.ceil(Math.max(...T.map((n) => n.end), ...D.map((n) => n.end)) / GRID) + 1
  const frameF1 = (chroma: boolean) => {
    const a = frameSets(T, frames, chroma)
    const b = frameSets(D, frames, chroma)
    let tp = 0
    let na = 0
    let nb = 0
    for (let i = 0; i < frames; i++) {
      na += a[i].size
      nb += b[i].size
      for (const x of a[i]) if (b[i].has(x)) tp++
    }
    return f1(nb ? tp / nb : 0, na ? tp / na : 0)
  }
  // 음 시작 맞추기: 같은 높이에서 시작 시각이 가장 가까운 것끼리 하나씩 짝짓는다
  const used = new Set<number>()
  let hit = 0
  for (const t of T) {
    let best = -1
    let bestD = ONSET_TOLERANCE + 1e-9
    D.forEach((d, i) => {
      if (used.has(i) || d.midi !== t.midi) return
      const dist = Math.abs(d.start - t.start)
      if (dist < bestD) {
        bestD = dist
        best = i
      }
    })
    if (best >= 0) {
      used.add(best)
      hit++
    }
  }
  const prec = D.length ? hit / D.length : 0
  const rec = T.length ? hit / T.length : 0
  return {
    pitch: frameF1(false),
    chroma: frameF1(true),
    onset: f1(prec, rec),
    miss: 1 - rec,
    extra: 1 - prec,
    count: D.length,
  }
}
