import type { QNote } from '../midi/quantize'
import { assignHands } from './handSplit'
import { enforcePlayable } from './playable'
import { DEFAULT_REDUCE_OPTIONS, type ReduceOptions, type ReduceResult, type SourceNote, type TrackInput } from './types'

/**
 * 여러 트랙을 피아노 한 대(오른손·왼손)로 합친다. (기획서 8.2)
 * 1) 모든 트랙의 음표를 모은다  2) 같은 시작·같은 높이는 하나로  3) 손 나누기  4) 손마다 연주 가능성 정리
 */
export function reduceToPiano(tracks: TrackInput[], options: ReduceOptions = DEFAULT_REDUCE_OPTIONS): ReduceResult {
  const all: SourceNote[] = tracks.flatMap((t, track) => t.notes.map((n) => ({ ...n, track })))
  const input = all.length

  // 중복 제거: 같은 시작·같은 높이 → 더 길게, 더 세게 남긴다
  const byKey = new Map<string, SourceNote>()
  let duplicatesMerged = 0
  for (const n of all) {
    const key = `${n.start}:${n.midi}`
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, { ...n })
    } else {
      duplicatesMerged++
      prev.end = Math.max(prev.end, n.end)
      prev.velocity = Math.max(prev.velocity, n.velocity)
    }
  }
  const unique = [...byKey.values()].sort((a, b) => a.start - b.start || b.midi - a.midi)

  const { hands, pinned } = assignHands(unique, tracks, options.splitMidi)
  const right: QNote[] = []
  const left: QNote[] = []
  unique.forEach((n, i) => (hands[i] === 'R' ? right : left).push({ start: n.start, end: n.end, midi: n.midi, velocity: n.velocity }))

  const r = enforcePlayable(right, 'R', options.maxNotesPerHand, options.maxSpan)
  const l = enforcePlayable(left, 'L', options.maxNotesPerHand, options.maxSpan)

  return {
    right: r.kept,
    left: l.kept,
    report: {
      input,
      duplicatesMerged,
      removedByCount: r.removedByCount + l.removedByCount,
      removedBySpan: r.removedBySpan + l.removedBySpan,
      removed: r.removedByCount + r.removedBySpan + l.removedByCount + l.removedBySpan,
      right: r.kept.length,
      left: l.kept.length,
      pinnedTracks: pinned,
    },
  }
}
