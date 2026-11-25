/**
 * 핑거스타일 기타의 표기: 엄지로 치는 베이스 음은 아래 줄기, 나머지 손가락의 음은 위 줄기로 나눈다.
 * MIDI에는 어느 손가락인지 없으므로 음높이로 추정한다.
 */
import { toSingleVoice, type MeasureSpec, type QNote } from '../midi/quantize'

/** 어쿠스틱 기타(나일론·스틸). 일렉 기타는 보통 한 성부로 적는다 */
export const isAcousticGuitar = (program: number) => program === 24 || program === 25

/** 이 높이(G3) 이하에서 그때 가장 낮은 음을 베이스로 본다 */
export const BASS_TOP_MIDI = 55

export function splitThumb(notes: QNote[], grid: MeasureSpec[]): { upper: QNote[]; lower: QNote[] } {
  const lowest = new Map<number, number>()
  for (const n of notes) lowest.set(n.start, Math.min(lowest.get(n.start) ?? 128, n.midi))
  const isBass = (n: QNote) => n.midi <= BASS_TOP_MIDI && n.midi === lowest.get(n.start)
  const measureOf = (step: number) => grid.findLastIndex((m) => m.startStep <= step)
  // 베이스와 그 밖의 음이 함께 있는 마디만 두 성부로 나눈다 (낮은 선율뿐인 마디는 한 성부)
  const kinds = new Map<number, Set<boolean>>()
  for (const n of notes) {
    const m = measureOf(n.start)
    kinds.set(m, (kinds.get(m) ?? new Set()).add(isBass(n)))
  }
  const toLower = (n: QNote) => isBass(n) && kinds.get(measureOf(n.start))!.size === 2
  const upper = toSingleVoice(notes.filter((n) => !toLower(n)))
  // 베이스는 울리게 두되 다음 베이스나 마디 끝에서 끊는다
  const lower = toSingleVoice(notes.filter(toLower)).map((n) => {
    const m = grid[measureOf(n.start)]
    return { ...n, end: Math.min(n.end, m.startStep + m.length) }
  })
  return { upper, lower }
}
