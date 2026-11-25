/**
 * 3연음 (4분음표 한 박을 셋으로 나눈 리듬).
 * 악보의 위치 단위는 16분음표 칸(1박 = 4칸)이다. 3연음 박의 위치만 4/3칸의 배수(1/3 단위의 수)가 되고,
 * 나머지는 정수다. 셋잇단 8분음표(4/3칸)와 4분음표(8/3칸)를 지원한다. 16분 셋잇단·5연음 등은 지원하지 않는다.
 */
import type { NoteEvent, TimeSignatureChange } from './types'

export const BEAT_STEPS = 4
export const TRIPLET_STEP = BEAT_STEPS / 3

/** 1/3칸 단위로 맞춰 소수 계산의 오차를 없앤다 */
export const snapThird = (step: number) => Math.round(step * 3) / 3
/** 이 위치가 든 4분음표 박의 시작 칸 */
export const beatOf = (step: number) => Math.floor(snapThird(step) / BEAT_STEPS) * BEAT_STEPS

/** 4분음표를 박으로 쓰는 박자(2/4, 3/4, 4/4, 2/2 …)에서만 찾는다. 6/8 같은 박자는 이미 셋씩 나뉜다 */
export const tripletsAllowed = (signatures: TimeSignatureChange[]) => signatures.every((s) => s.denominator <= 4)

/** 박 안의 위치(0~1)를 후보 자리에 맞출 때의 거리 */
const distance = (x: number, parts: number) => Math.abs(x - Math.round(x * parts) / parts)

/** 연주 흔들림을 받아 주는 폭 (박에 대한 비율). 1/3·2/3와 1/4·3/4는 0.083 떨어져 있다 */
const TOLERANCE = 0.065
/** 박 끝에서 이만큼 앞선 음은 다음 박의 음을 조금 일찍 친 것으로 본다 */
const EARLY = 0.1

/**
 * 3연음으로 적을 박(시작 칸)들. 그 박에서 시작하는 모든 음이 셋으로 나눈 자리에 가깝고,
 * 1/3 또는 2/3 자리에 음이 있으며, 16분음표 자리보다 셋 자리가 더 잘 맞을 때다.
 */
export function findTripletBeats(notes: NoteEvent[], ppq: number): Set<number> {
  const onsets = new Map<number, number[]>()
  for (const n of notes) {
    const quarters = n.ticks / ppq
    const beat = Math.floor(quarters + EARLY)
    const list = onsets.get(beat)
    if (list) list.push(quarters - beat)
    else onsets.set(beat, [quarters - beat])
  }
  const out = new Set<number>()
  for (const [beat, list] of onsets) {
    if (!list.every((x) => distance(x, 3) <= TOLERANCE)) continue
    const inside = list.filter((x) => x > 0.2 && x < 0.8)
    if (!inside.length) continue
    const total = (parts: number) => list.reduce((a, x) => a + distance(x, parts), 0)
    if (total(3) + 0.005 * inside.length < total(4)) out.add(beat * BEAT_STEPS)
  }
  return out
}
