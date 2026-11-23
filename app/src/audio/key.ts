import type { KeyMode } from '../midi/keys'
import type { AudioNote } from '../midi/types'
import type { Estimate } from './types'

// Krumhansl-Kessler 조성 프로파일 (C 기준)
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
const MAJOR_FIFTHS = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5] // C, D♭, D, E♭, E, F, F♯, G, A♭, A, B♭, B

export interface KeyGuess {
  fifths: number
  mode: KeyMode
}

function corr(a: number[], b: number[]): number {
  const n = a.length
  const ma = a.reduce((x, y) => x + y, 0) / n
  const mb = b.reduce((x, y) => x + y, 0) / n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return num / Math.sqrt(da * db || 1)
}

/** 음이름별로 (길이 × 세기)를 모은 분포를 24개 조성 프로파일과 비교해 조성을 추정한다. */
export function estimateKey(notes: AudioNote[]): Estimate<KeyGuess> {
  const hist = new Array<number>(12).fill(0)
  for (const n of notes) hist[((Math.round(n.midi) % 12) + 12) % 12] += n.durationSec * Math.max(0.1, n.velocity)
  if (hist.every((v) => v === 0)) return { value: { fifths: 0, mode: 'major' }, confidence: 0 }

  const cands: { fifths: number; mode: KeyMode; score: number }[] = []
  for (let tonic = 0; tonic < 12; tonic++) {
    const rot = hist.map((_, i) => hist[(i + tonic) % 12])
    cands.push({ fifths: MAJOR_FIFTHS[tonic], mode: 'major', score: corr(rot, MAJOR) })
    // 단조의 조표 = 나란한 장조(단3도 위)의 조표
    cands.push({ fifths: MAJOR_FIFTHS[(tonic + 3) % 12], mode: 'minor', score: corr(rot, MINOR) })
  }
  cands.sort((a, b) => b.score - a.score)
  const best = cands[0]
  // 조표가 다른 2위와의 차이를 확신도로 쓴다 (나란한 장·단조는 조표가 같으므로 제외)
  const other = cands.find((c) => c.fifths !== best.fifths) ?? cands[1]
  return {
    value: { fifths: best.fifths, mode: best.mode },
    confidence: Math.max(0, Math.min(1, (best.score - other.score) * 4)),
  }
}
