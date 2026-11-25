/**
 * 흩어진 타악기 트랙(큰북·스네어·심벌이 따로 있는 MIDI)을 연주자가 보는 보표로 모은다:
 * 드럼 세트 연주자 한 사람이 치는 악기는 한 보표, 손 타악기(탬버린 등)는 따로 한 보표.
 */
import type { NoteEvent, TrackInfo } from '../midi/types'

export type DrumGroup = 'kit' | 'hand'

/** 드럼 세트(큰북·스네어·톰·하이햇·심벌)인가. 54 탬버린, 56 카우벨, 58 비브라슬랩, 60번 이후는 손 타악기다 */
export const drumGroup = (midi: number): DrumGroup =>
  midi <= 59 && midi !== 54 && midi !== 56 && midi !== 58 ? 'kit' : 'hand'

export interface DrumSource {
  track: TrackInfo
  /** 악보에 적을 수 있는 음 */
  known: NoteEvent[]
}

export interface DrumStaffSource {
  group: DrumGroup
  /** 이 보표에 모인 원본 트랙 (원래 순서) */
  sources: DrumSource[]
}

/** 트랙들을 보표별로 다시 나눈다. 음이 없는 보표는 만들지 않는다 */
export function groupDrums(drums: DrumSource[]): DrumStaffSource[] {
  return (['kit', 'hand'] as const).flatMap((group) => {
    const sources = drums
      .map(({ track, known }) => ({ track, known: known.filter((n) => drumGroup(n.midi) === group) }))
      .filter((s) => s.known.length)
    return sources.length ? [{ group, sources }] : []
  })
}
