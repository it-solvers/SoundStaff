import type { Hand, SourceNote, TrackInput } from './types'

/** 같은 트랙의 음이 거의 겹치지 않으면(한 줄 선율) 단선율로 본다. 1칸(16분음표) 이하의 겹침은 이어 연주로 인정. */
function isMonophonic(notes: { start: number; end: number }[]): boolean {
  const s = [...notes].sort((a, b) => a.start - b.start)
  for (let i = 0; i + 1 < s.length; i++) if (s[i + 1].start < s[i].end - 1) return false
  return true
}

export interface HandAssignment {
  /** 음표마다 손 (입력 순서와 동일) */
  hands: Hand[]
  pinned: { name: string; hand: Hand }[]
}

/**
 * 오른손/왼손 나누기.
 * 기본: 가온 도(splitMidi) 이상은 오른손, 미만은 왼손.
 * 보정: 한 줄짜리 선율 트랙이 경계 부근(한 옥타브 남짓 안)에서 경계를 넘나들면 선율이 두 손으로 끊기므로,
 *       그 트랙 전체를 중앙값 기준 한 손에 둔다. 화음·폭이 넓은 트랙은 음마다 나눈다.
 */
export function assignHands(notes: SourceNote[], tracks: TrackInput[], splitMidi: number): HandAssignment {
  const pinnedHand = new Map<number, Hand>()
  const pinned: { name: string; hand: Hand }[] = []

  tracks.forEach((t, idx) => {
    if (!t.notes.length) return
    const pitches = t.notes.map((n) => n.midi).sort((a, b) => a - b)
    const lo = pitches[0]
    const hi = pitches[pitches.length - 1]
    const straddles = lo < splitMidi && hi >= splitMidi
    if (straddles && hi - lo <= 14 && isMonophonic(t.notes)) {
      const median = pitches[Math.floor(pitches.length / 2)]
      const hand: Hand = median >= splitMidi ? 'R' : 'L'
      pinnedHand.set(idx, hand)
      pinned.push({ name: t.name, hand })
    }
  })

  const hands = notes.map((n) => pinnedHand.get(n.track) ?? (n.midi >= splitMidi ? 'R' : 'L'))
  return { hands, pinned }
}
