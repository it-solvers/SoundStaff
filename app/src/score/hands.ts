/**
 * 건반악기의 양손 나누기. MIDI에는 어느 손인지 없으므로, 같은 때 시작하는 음들을 낮은 쪽(왼손)과 높은 쪽(오른손)으로
 * 가르는 여러 방법 중 연주하기 가장 자연스러운 흐름을 고른다:
 * 한 손이 한 번에 닿는 폭(한 옥타브 남짓)과 손가락 수를 지키고, 손이 덜 움직이며, 되도록 제 음역에 머문다.
 */
import type { QNote } from '../midi/quantize'

/** 손이 처음 놓인다고 보는 자리 */
const HOME = { left: 48, right: 72 }
/** 오른손·왼손이 이 높이를 넘어가면 점점 어색하다고 본다 */
const MIDDLE = 60
const OCTAVE = 12
/** 한 손으로 닿는 가장 넓은 폭 (10도) */
const REACH = 16
/** 동시에 따라가 보는 후보 수 */
const BEAM = 24

interface Hypothesis {
  cost: number
  left: number
  right: number
  /** 이 시점에서 왼손이 맡은 음의 수와 앞 시점의 후보 */
  split: number
  prev: Hypothesis | null
}

/** 한 손이 이 음들(낮은 음부터)을 칠 때의 어려움 */
function handCost(pitches: number[], position: number, side: 'left' | 'right'): number {
  if (!pitches.length) return 0
  const low = pitches[0]
  const high = pitches[pitches.length - 1]
  const center = (low + high) / 2
  const span = high - low
  // 손을 벌릴수록 조금씩 힘들다: 멀리 떨어진 두 음은 되도록 두 손이 나눠 친다
  let cost = span * 0.3 + Math.max(0, span - OCTAVE) * 2 + (span > REACH ? 60 : 0)
  if (pitches.length > 5) cost += 60
  cost += Math.abs(center - position) * 0.35
  cost += Math.max(0, side === 'left' ? center - MIDDLE : MIDDLE - center) * 0.5
  return cost
}

/** 친 손은 그 자리로 옮기고, 쉬는 손은 천천히 제자리로 돌아온다 */
const moved = (pitches: number[], position: number, home: number) =>
  pitches.length ? (pitches[0] + pitches[pitches.length - 1]) / 2 : position * 0.85 + home * 0.15

export function splitHands(notes: QNote[]): { left: QNote[]; right: QNote[] } {
  const byStart = new Map<number, QNote[]>()
  for (const n of notes) {
    const list = byStart.get(n.start)
    if (list) list.push(n)
    else byStart.set(n.start, [n])
  }
  const onsets = [...byStart.keys()].sort((a, b) => a - b).map((s) => byStart.get(s)!.sort((a, b) => a.midi - b.midi))

  let beam: Hypothesis[] = [{ cost: 0, ...HOME, split: 0, prev: null }]
  for (const chord of onsets) {
    const pitches = chord.map((n) => n.midi)
    const next: Hypothesis[] = []
    for (const h of beam) {
      for (let k = 0; k <= pitches.length; k++) {
        const low = pitches.slice(0, k)
        const high = pitches.slice(k)
        next.push({
          cost: h.cost + handCost(low, h.left, 'left') + handCost(high, h.right, 'right'),
          left: moved(low, h.left, HOME.left),
          right: moved(high, h.right, HOME.right),
          split: k,
          prev: h,
        })
      }
    }
    beam = next.sort((a, b) => a.cost - b.cost).slice(0, BEAM)
  }

  const left: QNote[] = []
  const right: QNote[] = []
  let h: Hypothesis | null = beam[0]
  for (let i = onsets.length - 1; i >= 0 && h; i--, h = h.prev) {
    left.push(...onsets[i].slice(0, h.split))
    right.push(...onsets[i].slice(h.split))
  }
  const order = (a: QNote, b: QNote) => a.start - b.start || b.midi - a.midi
  return { left: left.sort(order), right: right.sort(order) }
}
