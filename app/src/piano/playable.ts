import type { QNote } from '../midi/quantize'
import type { Hand } from './types'

export interface PlayableResult {
  kept: QNote[]
  removedByCount: number
  removedBySpan: number
}

interface Item {
  n: QNote
  alive: boolean
}

/**
 * 한 손으로 칠 수 있도록 정리한다.
 *  - 동시에 울리는 음이 maxNotes개를 넘으면 중요도가 낮은 음부터 제거
 *  - 가장 높은 음과 낮은 음의 폭이 maxSpan(반음 수)을 넘으면 폭을 벌리는 음부터 제거
 * 중요도: 선율(오른손의 가장 높은 음) > 베이스(왼손의 가장 낮은 음) > 안쪽 화음.
 * 안쪽 화음은 같은 음이름의 옥타브 중복 → 세기(velocity)가 약한 음 → 기준음에서 먼 음 순으로 제거한다.
 */
export function enforcePlayable(notes: QNote[], hand: Hand, maxNotes: number, maxSpan: number): PlayableResult {
  const items: Item[] = notes.map((n) => ({ n, alive: true })).sort((a, b) => a.n.start - b.n.start)
  const starts = [...new Set(items.map((i) => i.n.start))]

  let removedByCount = 0
  let removedBySpan = 0
  let active: Item[] = []
  let next = 0

  for (const t of starts) {
    active = active.filter((a) => a.alive && a.n.end > t)
    while (next < items.length && items[next].n.start === t) active.push(items[next++])

    for (;;) {
      const cur = active.filter((a) => a.alive)
      if (cur.length <= 1) break
      const byPitch = [...cur].sort((a, b) => a.n.midi - b.n.midi)
      const lowest = byPitch[0]
      const highest = byPitch[byPitch.length - 1]
      // 오른손은 가장 높은 음(선율), 왼손은 가장 낮은 음(베이스)이 기준음
      const anchor = hand === 'R' ? highest : lowest

      if (highest.n.midi - lowest.n.midi > maxSpan) {
        const victim = hand === 'R' ? lowest : highest
        victim.alive = false
        removedBySpan++
        continue
      }
      if (cur.length > maxNotes) {
        const candidates = cur.filter((a) => a !== anchor)
        const pcOf = (m: number) => ((m % 12) + 12) % 12
        const score = (a: Item) => {
          const dup = cur.some((b) => b !== a && pcOf(b.n.midi) === pcOf(a.n.midi)) ? 1 : 0
          return { dup, vel: a.n.velocity, dist: Math.abs(a.n.midi - anchor.n.midi) }
        }
        candidates.sort((a, b) => {
          const x = score(a)
          const y = score(b)
          return y.dup - x.dup || x.vel - y.vel || y.dist - x.dist
        })
        candidates[0].alive = false
        removedByCount++
        continue
      }
      break
    }
  }
  return { kept: items.filter((i) => i.alive).map((i) => i.n), removedByCount, removedBySpan }
}
