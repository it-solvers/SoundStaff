/** 드러머가 실제로 칠 수 있는 악보로: 아주 빠른 연타는 롤로, 손은 동시에 두 개까지 */
import type { QNote } from '../midi/quantize'
import type { NoteEvent } from '../midi/types'

/** 한 박(4분음표)의 이 비율보다 촘촘하게 */
const ROLL_GAP = 1 / 6
/** 이 수 이상 이어서 치면 롤로 본다 */
const ROLL_HITS = 8

export interface Roll {
  midi: number
  /** 16분음표 칸 */
  start: number
  end: number
}

/** 같은 타악기의 아주 빠른 연타를 롤로 묶고, 나머지 타격을 돌려준다 */
export function findRolls(notes: NoteEvent[], ppq: number): { rolls: Roll[]; rest: NoteEvent[] } {
  const byMidi = new Map<number, NoteEvent[]>()
  for (const n of [...notes].sort((a, b) => a.ticks - b.ticks)) {
    const list = byMidi.get(n.midi)
    if (list) list.push(n)
    else byMidi.set(n.midi, [n])
  }
  const rolls: Roll[] = []
  const inRoll = new Set<NoteEvent>()
  const step = ppq / 4
  for (const [midi, list] of byMidi) {
    let from = 0
    for (let i = 1; i <= list.length; i++) {
      if (i < list.length && list[i].ticks - list[i - 1].ticks < ppq * ROLL_GAP) continue
      if (i - from >= ROLL_HITS) {
        const start = Math.round(list[from].ticks / step)
        // 마지막 타격이 박 머리에 닿으면 그 자리에도 롤을 적는다 (end는 그 칸의 다음)
        const last = Math.floor(list[i - 1].ticks / step + 0.25)
        rolls.push({ midi, start, end: Math.max(start, last) + 1 })
        for (let k = from; k < i; k++) inRoll.add(list[k])
      }
      from = i
    }
  }
  return { rolls, rest: notes.filter((n) => !inRoll.has(n)) }
}

/**
 * 롤을 적을 위치들: 롤의 시작, 그 안의 박 머리, 그리고 다른 타격이 있는 자리.
 * (타악기 음표는 다음 타격까지만 적으므로, 다른 타격 자리에도 롤을 이어 적어야 끊기지 않는다)
 */
export function rollHits(roll: Roll, others: Iterable<number>): QNote[] {
  const at = new Set([roll.start])
  for (let s = Math.floor(roll.start / 4) * 4 + 4; s < roll.end; s += 4) at.add(s)
  for (const s of others) if (s > roll.start && s < roll.end) at.add(s)
  return [...at]
    .sort((a, b) => a - b)
    .map((start) => ({ start, end: start + 1, midi: roll.midi, velocity: 0.7, roll: true }))
}

/** 손이 모자랄 때 남길 순서 (작을수록 먼저): 스네어, 크래시, 톰, 그 밖, 라이드, 하이햇 */
function priority(midi: number): number {
  if (midi === 37 || midi === 38 || midi === 40) return 0
  if (midi === 49 || midi === 52 || midi === 55 || midi === 57) return 1
  if ([41, 43, 45, 47, 48, 50].includes(midi)) return 2
  if (midi === 51 || midi === 53 || midi === 59) return 4
  if (midi === 42 || midi === 46) return 5
  return 3
}

/** 같은 때 손으로 치는 악기가 셋 이상이면 둘만 남긴다 (필인에서 드러머가 하이햇을 빼는 것처럼) */
export function limitHands(notes: QNote[], isFoot: (midi: number) => boolean): { notes: QNote[]; dropped: number } {
  const byStart = new Map<number, QNote[]>()
  for (const n of notes) {
    if (isFoot(n.midi)) continue
    const list = byStart.get(n.start)
    if (list) list.push(n)
    else byStart.set(n.start, [n])
  }
  const dropped = new Set<QNote>()
  for (const list of byStart.values()) {
    const order = [...list].sort((a, b) => Number(!!b.roll) - Number(!!a.roll) || priority(a.midi) - priority(b.midi))
    for (const n of order.slice(2)) dropped.add(n)
  }
  return { notes: notes.filter((n) => !dropped.has(n)), dropped: dropped.size }
}
